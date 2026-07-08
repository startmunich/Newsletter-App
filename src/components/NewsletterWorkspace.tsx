"use client";

import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FileText,
  FileUp,
  Loader2,
  Mail,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  Trash2,
  Wand2,
} from "lucide-react";
import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractSubjectLine, renderNewsletterHtml, renderNewsletterText } from "@/lib/renderer";
import { CoverImage, JobState, NewsletterDraft, NewsletterItem, PreviewState } from "@/lib/types";

type Notice = {
  tone: "ok" | "warn" | "error";
  text: string;
};

type PreviewMode = "desktop" | "mobile";

const emptyItem: NewsletterItem = {
  title: "New update",
  summary: "",
  tag: "Internal News",
  url: "",
  imageUrl: "",
  imageAlt: "",
};

function replaceAt<T>(items: T[], index: number, next: T) {
  return items.map((item, itemIndex) => (itemIndex === index ? next : item));
}

function fileSummary(files: File[]) {
  if (!files.length) return "No files";
  if (files.length === 1) return files[0].name;
  return `${files.length} files`;
}

function statusText(status?: PreviewState["status"]) {
  return status === "sent" ? "Sent" : "Draft";
}

export function NewsletterWorkspace() {
  const [sourceText, setSourceText] = useState("");
  const [meetingTranscript, setMeetingTranscript] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [draft, setDraft] = useState<NewsletterDraft | null>(null);
  const [recentPreviews, setRecentPreviews] = useState<PreviewState[]>([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [approving, setApproving] = useState(false);
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [revising, setRevising] = useState(false);
  const [coverJobId, setCoverJobId] = useState<string | null>(null);
  const [coverImages, setCoverImages] = useState<CoverImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rendered = useMemo(() => {
    if (!draft) return null;
    return {
      subject: extractSubjectLine(draft),
      preheader: draft.preheader,
      html: renderNewsletterHtml(draft),
      text: renderNewsletterText(draft),
    };
  }, [draft]);

  const activeSection = draft?.sections[activeSectionIndex] ?? draft?.sections[0];
  const canGenerate = sourceText.trim().length > 0 || meetingTranscript.trim().length > 0;
  const isSent = preview?.status === "sent";

  const loadRecentPreviews = useCallback(async () => {
    try {
      const response = await fetch("/api/preview-list");
      if (!response.ok) return;
      const data = (await response.json()) as PreviewState[];
      setRecentPreviews(data);
    } catch {
      /* recent list is non-critical */
    }
  }, []);

  const loadPreview = useCallback(async (key: string) => {
    const response = await fetch(`/api/preview-data/${key}`);
    if (!response.ok) throw new Error("Preview not found");
    const nextPreview = (await response.json()) as PreviewState;
    setPreview(nextPreview);
    setDraft(nextPreview.structured);
    setActiveSectionIndex(0);
    setCoverImages(nextPreview.structured.coverImages ?? []);
    setCoverJobId(nextPreview.coverImageJobId ?? null);
    return nextPreview;
  }, []);

  useEffect(() => {
    loadRecentPreviews();
  }, [loadRecentPreviews]);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    const pollJob = async () => {
      try {
        const response = await fetch(`/api/generate/${jobId}`);
        if (!response.ok) throw new Error("Failed to fetch job");

        const nextJob = (await response.json()) as JobState;
        if (cancelled) return;
        setJob(nextJob);

        if (nextJob.status === "done" && nextJob.previewKey) {
          const nextPreview = await loadPreview(nextJob.previewKey);
          if (cancelled) return;
          setGenerating(false);
          setJobId(null);
          setNotice({ tone: "ok", text: "Newsletter generated." });
          setCoverJobId(nextPreview.coverImageJobId ?? null);
          await loadRecentPreviews();
        }

        if (nextJob.status === "error") {
          setGenerating(false);
          setJobId(null);
          setNotice({ tone: "error", text: nextJob.error || "Generation failed." });
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ tone: "error", text: error instanceof Error ? error.message : "Generation status failed." });
        }
      }
    };

    pollJob();
    const interval = window.setInterval(pollJob, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [jobId, loadPreview, loadRecentPreviews]);

  useEffect(() => {
    if (!coverJobId) return;
    if (draft?.coverImages && draft.coverImages.length > 0) return;

    let cancelled = false;
    const pollCoverJob = async () => {
      try {
        const response = await fetch(`/api/generate-cover-images/${coverJobId}`);
        if (!response.ok) return;
        const coverJob = await response.json();
        if (cancelled) return;

        if (coverJob.images?.length) {
          setCoverImages(coverJob.images);
          setDraft((current) =>
            current
              ? {
                  ...current,
                  coverImages: coverJob.images,
                  selectedCoverImageIndex: current.selectedCoverImageIndex ?? 0,
                }
              : current
          );
        }

        if (coverJob.status === "done" && preview?.key) {
          const refreshed = await loadPreview(preview.key);
          if (!cancelled) {
            setCoverJobId(null);
            setCoverImages(refreshed.structured.coverImages ?? []);
          }
        }

        if (coverJob.status === "error") {
          setCoverJobId(null);
          setNotice({ tone: "warn", text: coverJob.error || "Cover image generation failed." });
        }
      } catch {
        /* transient poll issue */
      }
    };

    pollCoverJob();
    const interval = window.setInterval(pollCoverJob, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [coverJobId, draft?.coverImages, loadPreview, preview?.key]);

  function setFilesFromInput(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files || []).filter((file) => file.type === "application/pdf");
    setFiles((current) => [...current, ...selected]);
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(event.dataTransfer.files).filter((file) => file.type === "application/pdf");
    setFiles((current) => [...current, ...droppedFiles]);
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    if (!canGenerate) {
      setNotice({ tone: "warn", text: "Add source text or a transcript first." });
      return;
    }

    setGenerating(true);
    setNotice(null);
    setJob(null);
    setPreview(null);
    setDraft(null);
    setCoverImages([]);

    const formData = new FormData();
    formData.append("sourceText", sourceText);
    formData.append("meetingTranscript", meetingTranscript);
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to start generation.");
      setJobId(data.jobId);
      setNotice({ tone: "ok", text: "Generation started." });
    } catch (error) {
      setGenerating(false);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to start generation." });
    }
  }

  function updateDraft(updater: (current: NewsletterDraft) => NewsletterDraft) {
    setDraft((current) => (current ? updater(current) : current));
  }

  function updateDraftField<K extends keyof NewsletterDraft>(field: K, value: NewsletterDraft[K]) {
    updateDraft((current) => ({ ...current, [field]: value }));
  }

  function updateItem(itemIndex: number, patch: Partial<NewsletterItem>) {
    if (!activeSection) return;
    updateDraft((current) => ({
      ...current,
      sections: replaceAt(current.sections, activeSectionIndex, {
        ...current.sections[activeSectionIndex],
        items: replaceAt(current.sections[activeSectionIndex].items, itemIndex, {
          ...current.sections[activeSectionIndex].items[itemIndex],
          ...patch,
        }),
      }),
    }));
  }

  function addItem() {
    if (!activeSection) return;
    updateDraft((current) => ({
      ...current,
      sections: replaceAt(current.sections, activeSectionIndex, {
        ...current.sections[activeSectionIndex],
        items: [
          ...current.sections[activeSectionIndex].items,
          {
            ...emptyItem,
            tag: activeSection.title,
            url: activeSection.title.toLowerCase().includes("event") ? "https://lu.ma/startmunich" : "",
          },
        ],
      }),
    }));
  }

  function removeItem(itemIndex: number) {
    if (!activeSection) return;
    updateDraft((current) => ({
      ...current,
      sections: replaceAt(current.sections, activeSectionIndex, {
        ...current.sections[activeSectionIndex],
        items: current.sections[activeSectionIndex].items.filter((_, index) => index !== itemIndex),
      }),
    }));
  }

  async function persistDraft(showNotice = false) {
    if (!preview || !draft) throw new Error("No draft to save.");
    setSaving(true);

    try {
      const response = await fetch(`/api/preview-data/${preview.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed.");
      setPreview(data);
      setDraft(data.structured);
      if (showNotice) setNotice({ tone: "ok", text: "Draft saved." });
      await loadRecentPreviews();
      return data as PreviewState;
    } catch (error) {
      if (showNotice) setNotice({ tone: "error", text: error instanceof Error ? error.message : "Save failed." });
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    setNotice(null);
    try {
      await persistDraft(true);
    } catch {
      /* persistDraft already surfaced the error */
    }
  }

  async function sendTestEmail() {
    if (!preview || !testEmail.trim()) return;
    setSendingTest(true);
    setNotice(null);

    try {
      await persistDraft();
      const response = await fetch("/api/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: preview.key, email: testEmail.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Test email failed.");
      setPreview((current) =>
        current
          ? {
              ...current,
              testEmailSentAt: new Date(),
              testEmailTo: data.email || testEmail.trim(),
            }
          : current
      );
      setNotice({ tone: "ok", text: `Test email sent to ${data.email || testEmail.trim()}.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Test email failed." });
    } finally {
      setSendingTest(false);
    }
  }

  async function approveNewsletter() {
    if (!preview) return;
    setApproving(true);
    setNotice(null);

    try {
      await persistDraft();
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: preview.key }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Send failed.");
      const refreshed = await loadPreview(preview.key);
      setNotice({ tone: "ok", text: `Newsletter sent. Campaign ID: ${data.brevoCampaignId || refreshed.brevoCampaignId}.` });
      await loadRecentPreviews();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Send failed." });
    } finally {
      setApproving(false);
    }
  }

  async function reviseDraft() {
    if (!preview || !revisionPrompt.trim()) return;
    setRevising(true);
    setNotice(null);

    try {
      await persistDraft();
      const response = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: preview.key, feedback: revisionPrompt.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Revision failed.");
      await loadPreview(data.newKey);
      setRevisionPrompt("");
      setNotice({ tone: "ok", text: "Revision created." });
      await loadRecentPreviews();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Revision failed." });
    } finally {
      setRevising(false);
    }
  }

  async function selectCoverImage(imageIndex: number) {
    if (!preview || !draft) return;
    setDraft({ ...draft, selectedCoverImageIndex: imageIndex });

    try {
      const response = await fetch("/api/select-cover-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewKey: preview.key, imageIndex }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cover selection failed.");
      await loadPreview(preview.key);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Cover selection failed." });
    }
  }

  async function copyHtml() {
    if (!rendered) return;
    await navigator.clipboard.writeText(rendered.html);
    setNotice({ tone: "ok", text: "HTML copied." });
  }

  function downloadHtml() {
    if (!rendered || !draft) return;
    const blob = new Blob([rendered.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `start-newsletter-${draft.month.toLowerCase().replace(/\s+/g, "-")}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#f3f4f6] text-[#111827]">
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-[#d9dde5] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-7">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center bg-[#00002c] text-sm font-black text-white">ST</div>
              <div>
                <h1 className="text-lg font-black text-[#00002c]">START Newsletter</h1>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d0006f]">Monthly draft desk</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#00002c]">
              {preview ? <span className="border border-[#cfd5df] bg-white px-3 py-2">{statusText(preview.status)}</span> : null}
              <button
                type="button"
                onClick={saveDraft}
                disabled={!draft || !preview || saving || isSent}
                className="inline-flex h-10 items-center gap-2 bg-[#eef1f6] px-4 font-bold text-[#00002c] hover:bg-[#dde3ed] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>
        </header>

        {notice ? (
          <div
            className={[
              "mx-5 mt-4 flex items-start gap-2 border px-4 py-3 text-sm font-medium lg:mx-7",
              notice.tone === "ok" ? "border-[#9bd8c5] bg-[#ecfdf7] text-[#064e3b]" : "",
              notice.tone === "warn" ? "border-[#f2c56b] bg-[#fffbeb] text-[#7c4a03]" : "",
              notice.tone === "error" ? "border-[#f3a3a3] bg-[#fff1f2] text-[#8a1230]" : "",
            ].join(" ")}
          >
            {notice.tone === "ok" ? <Check className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
            <span>{notice.text}</span>
          </div>
        ) : null}

        <div className="grid flex-1 gap-4 p-5 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:p-7">
          <section className="min-h-0 border border-[#d9dde5] bg-white">
            <div className="border-b border-[#e5e7eb] px-4 py-3">
              <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#00002c]">Sources</h2>
            </div>

            <form onSubmit={handleGenerate} className="space-y-5 p-4">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#00002c]">Newsletter source text</span>
                <textarea
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  className="h-40 w-full resize-none border border-[#cfd5df] bg-[#fbfcfe] p-3 text-sm leading-6 outline-none focus:border-[#d0006f]"
                  disabled={generating}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-[#00002c]">Meeting transcript</span>
                <textarea
                  value={meetingTranscript}
                  onChange={(event) => setMeetingTranscript(event.target.value)}
                  className="h-40 w-full resize-none border border-[#cfd5df] bg-[#fbfcfe] p-3 text-sm leading-6 outline-none focus:border-[#d0006f]"
                  disabled={generating}
                />
              </label>

              <div>
                <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={setFilesFromInput} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  className={[
                    "flex w-full cursor-pointer items-center justify-between border px-3 py-3 text-left text-sm font-bold text-[#00002c]",
                    isDragOver ? "border-[#d0006f] bg-[#fff5fa]" : "border-[#cfd5df] bg-white hover:border-[#d0006f]",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <FileUp className="h-4 w-4" />
                    PDF attachments
                  </span>
                  <span className="max-w-40 truncate text-xs font-medium text-[#6b7280]">{fileSummary(files)}</span>
                </button>

                {files.length ? (
                  <div className="mt-2 space-y-2">
                    {files.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between border border-[#e5e7eb] bg-[#fbfcfe] px-3 py-2 text-xs">
                        <span className="truncate text-[#374151]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                          className="grid h-7 w-7 place-items-center text-[#8a1230] hover:bg-[#ffe4e6]"
                          aria-label="Remove attachment"
                          title="Remove attachment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={generating || !canGenerate}
                className="inline-flex h-11 w-full items-center justify-center gap-2 bg-[#00002c] px-4 text-sm font-black text-white hover:bg-[#11115a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Generate
              </button>
            </form>

            {job ? (
              <div className="border-t border-[#e5e7eb] p-4">
                <h3 className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-[#00002c]">Progress</h3>
                <div className="space-y-3">
                  {job.steps.map((step) => (
                    <div key={step.name} className="flex items-start gap-3 text-sm">
                      <span
                        className={[
                          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center border text-[10px]",
                          step.status === "done" ? "border-[#9bd8c5] bg-[#ecfdf7] text-[#064e3b]" : "",
                          step.status === "running" ? "border-[#d0006f] text-[#d0006f]" : "",
                          step.status === "error" ? "border-[#f3a3a3] bg-[#fff1f2] text-[#8a1230]" : "",
                          step.status === "pending" ? "border-[#cfd5df] text-[#9ca3af]" : "",
                        ].join(" ")}
                      >
                        {step.status === "done" ? "✓" : step.status === "running" ? "..." : ""}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-[#00002c]">{step.name}</p>
                        {step.message ? <p className="text-xs text-[#6b7280]">{step.message}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-t border-[#e5e7eb] p-4">
              <h3 className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-[#00002c]">Recent</h3>
              <div className="space-y-2">
                {recentPreviews.length ? (
                  recentPreviews.slice(0, 8).map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={async () => {
                        try {
                          await loadPreview(item.key);
                          setNotice({ tone: "ok", text: "Draft loaded." });
                        } catch (error) {
                          setNotice({ tone: "error", text: error instanceof Error ? error.message : "Failed to load draft." });
                        }
                      }}
                      className={[
                        "block w-full border px-3 py-2 text-left text-sm hover:border-[#d0006f]",
                        preview?.key === item.key ? "border-[#d0006f] bg-[#fff5fa]" : "border-[#e5e7eb] bg-[#fbfcfe]",
                      ].join(" ")}
                    >
                      <span className="block truncate font-bold text-[#00002c]">{item.name || item.monthGenerated || item.structured.month || "Untitled"}</span>
                      <span className="block truncate text-xs text-[#6b7280]">{statusText(item.status)} · {item.subject}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm font-medium text-[#6b7280]">No drafts yet.</p>
                )}
              </div>
            </div>
          </section>

          <section className="min-h-0 border border-[#d9dde5] bg-white">
            <div className="border-b border-[#e5e7eb] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#00002c]">Draft & preview</h2>
                  {preview && rendered ? <p className="mt-1 text-xs font-semibold text-[#6b7280]">Version {preview.approvalVersion} · {rendered.subject}</p> : null}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("desktop")}
                    className={["grid h-9 w-9 place-items-center", previewMode === "desktop" ? "bg-[#00002c] text-white" : "bg-[#eef1f6] text-[#00002c]"].join(" ")}
                    title="Desktop preview"
                    aria-label="Desktop preview"
                  >
                    <Monitor className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("mobile")}
                    className={["grid h-9 w-9 place-items-center", previewMode === "mobile" ? "bg-[#00002c] text-white" : "bg-[#eef1f6] text-[#00002c]"].join(" ")}
                    title="Mobile preview"
                    aria-label="Mobile preview"
                  >
                    <Smartphone className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {!draft || !rendered ? (
              <div className="grid min-h-[620px] place-items-center p-8 text-center">
                <div>
                  <FileText className="mx-auto mb-4 h-10 w-10 text-[#9ca3af]" />
                  <p className="text-base font-black text-[#00002c]">No draft loaded</p>
                </div>
              </div>
            ) : (
              <div className="grid min-h-[calc(100vh-170px)] gap-0 xl:grid-cols-[minmax(360px,0.95fr)_minmax(390px,1.05fr)]">
                <div className="min-h-0 overflow-auto border-b border-[#e5e7eb] p-4 xl:border-b-0 xl:border-r">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#00002c]">Subject</span>
                      <input
                        value={draft.subject}
                        onChange={(event) => updateDraftField("subject", event.target.value)}
                        disabled={isSent}
                        className="h-11 w-full border border-[#cfd5df] bg-[#fbfcfe] px-3 text-sm outline-none focus:border-[#d0006f] disabled:opacity-60"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-[#00002c]">Preheader</span>
                      <input
                        value={draft.preheader}
                        onChange={(event) => updateDraftField("preheader", event.target.value)}
                        disabled={isSent}
                        className="h-11 w-full border border-[#cfd5df] bg-[#fbfcfe] px-3 text-sm outline-none focus:border-[#d0006f] disabled:opacity-60"
                      />
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-sm font-bold text-[#00002c]">Intro</span>
                    <textarea
                      value={draft.intro}
                      onChange={(event) => updateDraftField("intro", event.target.value)}
                      disabled={isSent}
                      className="h-28 w-full resize-none border border-[#cfd5df] bg-[#fbfcfe] p-3 text-sm leading-6 outline-none focus:border-[#d0006f] disabled:opacity-60"
                    />
                  </label>

                  {draft.clarificationNeeded ? (
                    <div className="mt-4 border border-[#f2c56b] bg-[#fffbeb] p-3 text-sm font-semibold text-[#7c4a03]">
                      {draft.clarificationQuestion || "Clarification needed."}
                    </div>
                  ) : null}

                  {coverImages.length ? (
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#00002c]">Cover</h3>
                        {coverJobId ? <span className="text-xs font-semibold text-[#d0006f]">Generating</span> : null}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {coverImages.map((image) => (
                          <button
                            type="button"
                            key={image.index}
                            onClick={() => selectCoverImage(image.index)}
                            className={[
                              "border bg-[#fbfcfe] p-1 text-left",
                              draft.selectedCoverImageIndex === image.index ? "border-[#d0006f]" : "border-[#d9dde5]",
                            ].join(" ")}
                            title={image.prompt}
                          >
                            <img src={`data:image/png;base64,${image.imageBase64}`} alt={`Cover ${image.index + 1}`} className="aspect-square w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-black text-[#00002c]">{activeSection?.title}</h3>
                    <button
                      type="button"
                      onClick={addItem}
                      disabled={isSent}
                      className="inline-flex h-9 items-center gap-2 bg-[#eef1f6] px-3 text-sm font-bold text-[#00002c] hover:bg-[#dde3ed] disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {draft.sections.map((section, index) => (
                      <button
                        type="button"
                        key={`${section.title}-${index}`}
                        onClick={() => setActiveSectionIndex(index)}
                        className={[
                          "px-3 py-1.5 text-xs font-bold",
                          activeSectionIndex === index ? "bg-[#d0006f] text-white" : "bg-[#eef1f6] text-[#00002c] hover:bg-[#dde3ed]",
                        ].join(" ")}
                      >
                        {section.title}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 space-y-4">
                    {activeSection?.items.length ? (
                      activeSection.items.map((item, itemIndex) => (
                        <div key={`${activeSection.title}-${itemIndex}`} className="border border-[#d9dde5] bg-[#fbfcfe] p-4">
                          <div className="flex items-start gap-3">
                            <label className="block flex-1">
                              <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#d0006f]">Title</span>
                              <input
                                value={item.title}
                                onChange={(event) => updateItem(itemIndex, { title: event.target.value })}
                                disabled={isSent}
                                className="h-10 w-full border border-[#cfd5df] bg-white px-3 text-sm font-bold outline-none focus:border-[#d0006f] disabled:opacity-60"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => removeItem(itemIndex)}
                              disabled={isSent}
                              className="mt-7 grid h-10 w-10 place-items-center bg-[#f2f4f8] text-[#8a1230] hover:bg-[#ffe4e6] disabled:opacity-50"
                              aria-label="Remove item"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <label className="mt-3 block">
                            <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#d0006f]">Summary</span>
                            <textarea
                              value={item.summary}
                              onChange={(event) => updateItem(itemIndex, { summary: event.target.value })}
                              disabled={isSent}
                              className="h-28 w-full resize-none border border-[#cfd5df] bg-white p-3 text-sm leading-6 outline-none focus:border-[#d0006f] disabled:opacity-60"
                            />
                          </label>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input
                              value={item.url}
                              onChange={(event) => updateItem(itemIndex, { url: event.target.value })}
                              placeholder="URL"
                              disabled={isSent}
                              className="h-10 border border-[#cfd5df] bg-white px-3 text-sm outline-none focus:border-[#d0006f] disabled:opacity-60"
                            />
                            <input
                              value={item.imageUrl}
                              onChange={(event) => updateItem(itemIndex, { imageUrl: event.target.value })}
                              placeholder="Image URL"
                              disabled={isSent}
                              className="h-10 border border-[#cfd5df] bg-white px-3 text-sm outline-none focus:border-[#d0006f] disabled:opacity-60"
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="border border-dashed border-[#cfd5df] bg-[#fbfcfe] p-8 text-center text-sm font-semibold text-[#6b7280]">
                        No items in this section.
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-h-0 overflow-auto bg-[#f3f4f6] p-4">
                  <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                    <input
                      value={testEmail}
                      onChange={(event) => setTestEmail(event.target.value)}
                      placeholder="test@startmunich.de"
                      disabled={sendingTest || isSent}
                      className="h-10 border border-[#cfd5df] bg-white px-3 text-sm outline-none focus:border-[#d0006f] disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={sendTestEmail}
                      disabled={!testEmail.trim() || sendingTest || isSent}
                      className="inline-flex h-10 items-center justify-center gap-2 bg-[#00002c] px-3 text-sm font-bold text-white hover:bg-[#11115a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={approveNewsletter}
                      disabled={!preview?.testEmailSentAt || approving || isSent}
                      className="inline-flex h-10 items-center justify-center gap-2 bg-[#d0006f] px-3 text-sm font-black text-white hover:bg-[#aa005b] disabled:cursor-not-allowed disabled:bg-[#e7a6c9]"
                    >
                      {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send
                    </button>
                  </div>

                  <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
                    <input
                      value={revisionPrompt}
                      onChange={(event) => setRevisionPrompt(event.target.value)}
                      placeholder="AI revision"
                      disabled={revising || isSent}
                      className="h-10 border border-[#cfd5df] bg-white px-3 text-sm outline-none focus:border-[#d0006f] disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={reviseDraft}
                      disabled={!revisionPrompt.trim() || revising || isSent}
                      className="inline-flex h-10 items-center justify-center gap-2 bg-[#eef1f6] px-3 text-sm font-bold text-[#00002c] hover:bg-[#dde3ed] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {revising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Revise
                    </button>
                  </div>

                  <div className="mb-3 flex gap-2">
                    <button
                      type="button"
                      onClick={downloadHtml}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 bg-[#eef1f6] px-3 text-sm font-bold text-[#00002c] hover:bg-[#dde3ed]"
                    >
                      <Download className="h-4 w-4" />
                      HTML
                    </button>
                    <button
                      type="button"
                      onClick={copyHtml}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 bg-[#eef1f6] px-3 text-sm font-bold text-[#00002c] hover:bg-[#dde3ed]"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                  </div>

                  <div className="overflow-auto bg-[#e7ebf1] p-3">
                    <div
                      className={[
                        "mx-auto bg-white shadow-sm transition-[width]",
                        previewMode === "mobile" ? "w-[360px] max-w-full" : "w-full",
                      ].join(" ")}
                    >
                      <iframe title="Newsletter email preview" srcDoc={rendered.html} className="h-[720px] w-full border-0 bg-white" sandbox="" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
