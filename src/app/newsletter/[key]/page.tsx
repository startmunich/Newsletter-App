"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { PreviewState, CoverImage, NewsletterDraft } from "@/lib/types";
import { isEventSection } from "@/lib/openai-client";
import { Sidebar } from "@/components/Sidebar";
import CoverImageGeneratorModal from "@/components/CoverImageGeneratorModal";
import NewsManager from "@/components/NewsManager";
import Link from "next/link";

export default function NewsletterDetailPage() {
  const params = useParams();
  const key = params.key as string;

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailMode, setEmailMode] = useState<"test" | "general">("test");
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Batch send state (general modal)
  type Recipient = { id: string; name: string; email: string; batch: string | null };
  type SkippedMember = { id: string; name: string; batch: string | null };
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [skipped, setSkipped] = useState<SkippedMember[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [recipientsLoaded, setRecipientsLoaded] = useState(false);

  // Alpha notice state
  const DEFAULT_ALPHA_TEXT =
    "This newsletter is still in alpha. If you notice anything off or run into issues, please reach out to XXX.";
  const [alphaEnabled, setAlphaEnabled] = useState(true);
  const [alphaText, setAlphaText] = useState(DEFAULT_ALPHA_TEXT);
  const [alphaSaving, setAlphaSaving] = useState(false);

  // Cover image state
  const [coverImages, setCoverImages] = useState<CoverImage[]>([]);
  const [showCoverImageTitle, setShowCoverImageTitle] = useState(true);
  const [coverTitleSaving, setCoverTitleSaving] = useState(false);
  const [coverJobStatus, setCoverJobStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [coverJobError, setCoverJobError] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const coverPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCoverPoll = () => {
    if (coverPollRef.current) {
      clearInterval(coverPollRef.current);
      coverPollRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopCoverPoll();
  }, []);

  const startPollingJob = useCallback((jobId: string) => {
    stopCoverPoll();
    coverPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate-cover-images/${jobId}`);
        if (!res.ok) return;
        const job = await res.json();

        if (job.images?.length > 0) {
          setCoverImages(job.images);
        }

        if (job.status === "done") {
          stopCoverPoll();
          setCoverJobStatus("done");
          // Refresh the full preview so HTML is in sync
          const r = await fetch(`/api/preview-data/${key}`);
          if (r.ok) setPreview(await r.json());
        } else if (job.status === "error") {
          stopCoverPoll();
          setCoverJobStatus("error");
          setCoverJobError(job.error || "Image generation failed");
        }
      } catch {
        /* transient */
      }
    }, 2000);
  }, [key]);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const response = await fetch(`/api/preview-data/${key}`);
        if (response.ok) {
          const data: PreviewState = await response.json();
          setPreview(data);

          // Initialize alpha notice controls from the stored draft (default on).
          if (data.structured.alphaNotice) {
            setAlphaEnabled(data.structured.alphaNotice.enabled);
            setAlphaText(data.structured.alphaNotice.text || DEFAULT_ALPHA_TEXT);
          }

          // Cover image title caption toggle (default on).
          setShowCoverImageTitle(data.structured.showCoverImageTitle ?? true);

          // If cover images already exist, show them
          if (data.structured.coverImages && data.structured.coverImages.length > 0) {
            setCoverImages(data.structured.coverImages);
            setCoverJobStatus("done");
          } else if (data.coverImageJobId) {
            // Auto-generation is in flight — start polling
            setCoverJobStatus("running");
            startPollingJob(data.coverImageJobId);
          }
        }
      } catch (error) {
        console.error("Failed to fetch preview:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [key, startPollingJob]);

  const handleCoverImageSelected = async (image: CoverImage) => {
    if (!preview) return;
    // Toggle: clicking the already-selected image deselects it (no cover image).
    const nextIndex =
      preview.structured.selectedCoverImageIndex === image.index ? null : image.index;
    try {
      const response = await fetch(`/api/preview-data/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCoverImageIndex: nextIndex }),
      });
      if (!response.ok) throw new Error("Failed to save selection");
      const updated = await response.json();
      setPreview(updated);
    } catch (error) {
      console.error("Failed to select cover image:", error);
    }
  };

  const handleSaveAlphaNotice = async (next: { enabled: boolean; text: string }) => {
    setAlphaSaving(true);
    try {
      const response = await fetch(`/api/preview-data/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alphaNotice: next }),
      });
      if (!response.ok) throw new Error("Failed to save alpha notice");
      const updated = await response.json();
      setPreview(updated);
    } catch (error) {
      console.error("Failed to save alpha notice:", error);
    } finally {
      setAlphaSaving(false);
    }
  };

  const handleToggleCoverImageTitle = async (next: boolean) => {
    setShowCoverImageTitle(next);
    setCoverTitleSaving(true);
    try {
      const response = await fetch(`/api/preview-data/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showCoverImageTitle: next }),
      });
      if (!response.ok) throw new Error("Failed to save cover image title setting");
      const updated = await response.json();
      setPreview(updated);
    } catch (error) {
      console.error("Failed to save cover image title setting:", error);
    } finally {
      setCoverTitleSaving(false);
    }
  };

  const handleSaveNews = async (payload: Partial<NewsletterDraft>) => {
    const response = await fetch(`/api/preview-data/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Failed to save news selection");
    const updated = await response.json();
    setPreview(updated);
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) return;
    setSending(true);
    try {
      const response = await fetch("/api/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, email: testEmail.trim() }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok) {
        alert("Test email sent successfully!");
        setShowEmailModal(false);
        setTestEmail("");
      } else {
        alert(data?.error || "Failed to send test email");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error sending test email");
    } finally {
      setSending(false);
    }
  };

  // Load available batches when the general (send newsletter) modal opens.
  useEffect(() => {
    if (!showEmailModal || emailMode !== "general" || availableBatches.length > 0) return;
    let cancelled = false;
    setLoadingBatches(true);
    (async () => {
      try {
        const res = await fetch("/api/members");
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && Array.isArray(data?.batches)) {
          setAvailableBatches(data.batches);
        }
      } catch {
        /* transient */
      } finally {
        if (!cancelled) setLoadingBatches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showEmailModal, emailMode, availableBatches.length]);

  const toggleBatch = (batch: string) => {
    setRecipientsLoaded(false);
    setRecipients([]);
    setSkipped([]);
    setSelectedBatches((prev) =>
      prev.includes(batch) ? prev.filter((b) => b !== batch) : [...prev, batch]
    );
  };

  const handleLoadRecipients = async () => {
    if (selectedBatches.length === 0) return;
    setLoadingRecipients(true);
    setRecipientsError(null);
    try {
      const res = await fetch(`/api/members?batches=${encodeURIComponent(selectedBatches.join(","))}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to load recipients");
      setRecipients(data.members || []);
      setSkipped(data.skipped || []);
      setRecipientsLoaded(true);
    } catch (error) {
      setRecipientsError(error instanceof Error ? error.message : "Failed to load recipients");
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleCopyEmails = async () => {
    const emails = recipients.map((r) => r.email).join(", ");
    try {
      await navigator.clipboard.writeText(emails);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleSendGeneral = async (force = false) => {
    if (selectedBatches.length === 0 || !recipientsLoaded || recipients.length === 0) return;
    setSending(true);
    try {
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, batches: selectedBatches, force }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok) {
        alert(
          `Newsletter sent successfully${
            data?.recipientCount ? ` to ${data.recipientCount} recipients` : ""
          }!`
        );
        setShowEmailModal(false);
        const r = await fetch(`/api/preview-data/${key}`);
        if (r.ok) setPreview(await r.json());
      } else if (data?.alreadySent && !force) {
        // Already sent once. Let the user knowingly re-send (e.g. a different
        // batch was selected) instead of hard-blocking them.
        const confirmed = window.confirm(
          `This newsletter was already sent. Send it again to the ` +
            `${recipients.length} selected recipient${
              recipients.length === 1 ? "" : "s"
            }?`
        );
        if (confirmed) {
          await handleSendGeneral(true);
          return;
        }
      } else {
        alert(data?.error || "Failed to send newsletter");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error sending newsletter");
    } finally {
      setSending(false);
    }
  };

  const selectedIndex = preview?.structured.selectedCoverImageIndex;
  const isGenerating = coverJobStatus === "running";

  // One cover image is generated per news item (event sections excluded). Used
  // to size the progress text and skeleton/empty placeholders.
  const newsCount = (preview?.structured.sections || [])
    .filter((section) => !isEventSection(section.title))
    .reduce((sum, section) => sum + (section.items?.length || 0), 0);
  // Fall back to whatever images already exist if we can't derive a count yet.
  const expectedImageCount = newsCount > 0 ? newsCount : coverImages.length;

  return (
    <div className="flex h-screen bg-navy">
      <Sidebar activeKey={key} />

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#a0a0b8]">Loading newsletter...</p>
          </div>
        ) : !preview ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#a0a0b8]">Newsletter not found</p>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Left panel */}
            <div className="flex-1 overflow-y-auto p-8">
              {/* Header */}
              <div className="mb-8">
                <Link href="/" className="text-magenta hover:text-[#ff4db8] text-sm font-medium block mb-6">
                  ← Back
                </Link>
                <h1 className="text-3xl font-bold text-[#f1f1f5] mb-2">
                  {preview.monthGenerated || preview.structured.month}
                </h1>
                <p className="text-[#a0a0b8]">{preview.structured.subject}</p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 mb-8 max-w-2xl">
                <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                  <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">Status</div>
                  <div className="text-lg font-bold text-[#f1f1f5]">
                    {preview.status === "sent" ? "✓ Sent" : "◦ Draft"}
                  </div>
                </div>
                <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                  <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">Created</div>
                  <div className="text-lg font-bold text-[#f1f1f5]">
                    {new Date(preview.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {preview.status === "sent" && (
                  <>
                    <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                      <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">Sent At</div>
                      <div className="text-lg font-bold text-[#f1f1f5]">
                        {preview.sentAt ? new Date(preview.sentAt).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                      <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">Recipients</div>
                      <div className="text-lg font-bold text-[#f1f1f5]">{preview.sentRecipientCount || "—"}</div>
                    </div>
                    {preview.sentBatches && preview.sentBatches.length > 0 && (
                      <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                        <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">Batches</div>
                        <div className="flex flex-wrap gap-1.5">
                          {preview.sentBatches.map((batch) => (
                            <span
                              key={batch}
                              className="inline-block px-2 py-0.5 bg-[#2a2a42] text-[#f1f1f5] text-xs font-medium rounded"
                            >
                              {batch}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mb-10 flex-wrap">
                <button
                  onClick={() => { setEmailMode("test"); setShowEmailModal(true); }}
                  className="px-5 py-2 bg-[#2a2a42] text-[#f1f1f5] font-medium rounded-lg hover:bg-[#3a3a52] transition-colors text-sm"
                >
                  Send Test Mail
                </button>
                <button
                  onClick={() => { setEmailMode("general"); setShowEmailModal(true); }}
                  className="px-5 py-2 bg-[#D0006F] text-white font-medium rounded-lg hover:bg-[#a80055] transition-colors text-sm"
                >
                  Send Newsletter
                </button>
                <Link
                  href={`/review/${key}`}
                  className="px-5 py-2 bg-[#2a2a42] text-[#f1f1f5] font-medium rounded-lg hover:bg-[#3a3a52] transition-colors text-sm"
                >
                  Edit & Preview
                </Link>
              </div>

              {/* Alpha Notice Section — toggle only; text is edited in the edit view */}
              <div className="mb-8 max-w-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#f1f1f5]">Alpha Notice</h2>
                    <p className="text-[#a0a0b8] text-xs mt-1">
                      Show the alpha banner at the top of the newsletter. Edit its text in the edit view.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-sm text-[#a0a0b8]">
                      {alphaSaving ? "Saving…" : alphaEnabled ? "Shown" : "Hidden"}
                    </span>
                    <input
                      type="checkbox"
                      checked={alphaEnabled}
                      disabled={alphaSaving}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setAlphaEnabled(enabled);
                        handleSaveAlphaNotice({ enabled, text: alphaText });
                      }}
                      className="w-4 h-4 accent-[#D0006F] cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Cover Image Section — always visible */}
              <div className="mb-8 max-w-2xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#f1f1f5]">Cover Image</h2>
                    {isGenerating && (
                      <p className="text-[#a0a0b8] text-xs mt-1 flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full border-2 border-[#D0006F] border-t-transparent animate-spin" />
                        Generating in background... ({coverImages.length}/{expectedImageCount} ready)
                      </p>
                    )}
                    {coverJobStatus === "done" && coverImages.length > 0 && (
                      <p className="text-[#a0a0b8] text-xs mt-1">Click an image to use it as the newsletter cover.</p>
                    )}
                    {coverJobStatus === "error" && (
                      <p className="text-red-400 text-xs mt-1">{coverJobError}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-sm text-[#a0a0b8]">
                        {coverTitleSaving ? "Saving…" : "Show image title"}
                      </span>
                      <input
                        type="checkbox"
                        checked={showCoverImageTitle}
                        disabled={coverTitleSaving}
                        onChange={(e) => handleToggleCoverImageTitle(e.target.checked)}
                        className="w-4 h-4 accent-[#D0006F] cursor-pointer"
                      />
                    </label>
                    <button
                      onClick={() => setShowRegenerateModal(true)}
                      className="px-4 py-1.5 bg-[#2a2a42] text-[#f1f1f5] text-sm font-medium rounded-lg hover:bg-[#3a3a52] transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                {/* Image grid */}
                <div className="grid grid-cols-3 gap-4">
                  {coverImages.map((image) => {
                    const isSelected = selectedIndex === image.index;
                    const typeLabel = image.label || `News ${image.index + 1}`;
                    return (
                      <div key={image.index} className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider line-clamp-1" title={typeLabel}>{typeLabel}</span>
                        <button
                          onClick={() => handleCoverImageSelected(image)}
                          title={isSelected ? "Click to deselect" : "Click to select"}
                          className={`group relative rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected ? "border-[#D0006F] ring-2 ring-[#D0006F]/30" : "border-[#2a2a42] hover:border-[#4a4a62]"
                          }`}
                        >
                          <img
                            src={image.imageUrl || `data:image/png;base64,${image.imageBase64}`}
                            alt={`Cover option ${typeLabel}`}
                            className="w-full aspect-square object-cover"
                          />
                          {isSelected && (
                            <span className="absolute top-2 right-2 bg-[#D0006F] text-white text-xs font-semibold px-2 py-0.5 rounded">
                              <span className="group-hover:hidden">✓</span>
                              <span className="hidden group-hover:inline">✕</span>
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}

                  {/* Skeleton placeholders while generating */}
                  {isGenerating &&
                    Array.from({ length: Math.max(0, expectedImageCount - coverImages.length) }).map((_, i) => (
                      <div key={`skeleton-${i}`} className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">News {coverImages.length + i + 1}</span>
                        <div className="w-full aspect-square rounded-lg bg-[#2a2a42] animate-pulse flex items-center justify-center">
                          <span className="text-[#3a3a52] text-xs">Generating…</span>
                        </div>
                      </div>
                    ))}

                  {/* Empty state: never generated */}
                  {coverJobStatus === "idle" && coverImages.length === 0 &&
                    Array.from({ length: Math.max(1, expectedImageCount) }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">News {i + 1}</span>
                        <div className="w-full aspect-square rounded-lg border-2 border-dashed border-[#2a2a42] flex items-center justify-center">
                          <span className="text-[#3a3a52] text-xs">No image</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* News Section — select & reorder */}
              <NewsManager
                key={preview.updatedAt?.toString()}
                draft={preview.structured}
                onSave={handleSaveNews}
              />
            </div>

            {/* Right: Newsletter Preview */}
            <div className="w-1/2 border-l border-[#2a2a42] overflow-y-auto p-8 bg-[#0a0a14]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-[#f1f1f5]">Preview</h2>
                {/* Device toggle */}
                <div className="flex items-center gap-1 bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-1">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      previewDevice === "desktop"
                        ? "bg-[#D0006F] text-white"
                        : "text-[#a0a0b8] hover:text-[#f1f1f5]"
                    }`}
                  >
                    Desktop
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      previewDevice === "mobile"
                        ? "bg-[#D0006F] text-white"
                        : "text-[#a0a0b8] hover:text-[#f1f1f5]"
                    }`}
                  >
                    Mobile
                  </button>
                </div>
              </div>

              {previewDevice === "desktop" ? (
                <div
                  className="bg-white rounded-lg overflow-hidden shadow-lg p-6 prose prose-sm max-w-none h-[calc(100vh-140px)] overflow-y-auto"
                  style={{ userSelect: "text", WebkitUserSelect: "text" }}
                >
                  <div dangerouslySetInnerHTML={{ __html: preview.html }} />
                </div>
              ) : (
                // Mobile: render inside a 375px-wide iframe so the newsletter's own
                // responsive @media rules fire and show the true phone layout.
                <div className="flex justify-center h-[calc(100vh-140px)] overflow-y-auto">
                  <iframe
                    src={`/api/preview/${key}`}
                    title="Mobile preview"
                    sandbox="allow-same-origin"
                    className="bg-white rounded-[24px] shadow-lg border-[6px] border-[#1a1a2e]"
                    style={{ width: "375px", minWidth: "375px", height: "812px" }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={`bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-8 w-full mx-4 ${
              emailMode === "test" ? "max-w-md" : "max-w-lg"
            }`}
          >
            <h3 className="text-lg font-bold text-[#f1f1f5] mb-4">
              {emailMode === "test" ? "Send Test Email" : "Send Newsletter"}
            </h3>
            {emailMode === "test" ? (
              <>
                <p className="text-[#a0a0b8] text-sm mb-4">Send a test email to verify the newsletter looks correct.</p>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-[#2a2a42] border border-[#3a3a52] rounded-lg text-[#f1f1f5] placeholder-[#606078] focus:outline-none focus:border-[#D0006F] mb-4"
                />
              </>
            ) : (
              <div className="mb-4">
                <p className="text-[#a0a0b8] text-sm mb-3">
                  Select the member batches to send this newsletter to. Emails are derived from
                  member names ({"<initial>.<surname>@startmunich.de"}).
                </p>

                {/* Batch selector */}
                <div className="mb-4">
                  <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                    Batches
                  </div>
                  {loadingBatches ? (
                    <p className="text-[#606078] text-sm">Loading batches…</p>
                  ) : availableBatches.length === 0 ? (
                    <p className="text-[#606078] text-sm">No batches available.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {availableBatches.map((batch) => {
                        const checked = selectedBatches.includes(batch);
                        return (
                          <label
                            key={batch}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                              checked
                                ? "bg-[#D0006F]/15 border-[#D0006F] text-[#f1f1f5]"
                                : "bg-[#2a2a42] border-[#3a3a52] text-[#a0a0b8] hover:border-[#4a4a62]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleBatch(batch)}
                              className="accent-[#D0006F]"
                            />
                            {batch}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Preview recipients */}
                <button
                  onClick={handleLoadRecipients}
                  disabled={selectedBatches.length === 0 || loadingRecipients}
                  className="px-4 py-1.5 bg-[#2a2a42] text-[#f1f1f5] text-sm font-medium rounded-lg hover:bg-[#3a3a52] disabled:opacity-40 transition-colors mb-3"
                >
                  {loadingRecipients ? "Loading…" : "Preview recipients"}
                </button>

                {recipientsError && (
                  <p className="text-red-400 text-sm mb-3">{recipientsError}</p>
                )}

                {recipientsLoaded && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#f1f1f5] font-semibold">
                        {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
                      </span>
                      {recipients.length > 0 && (
                        <button
                          onClick={handleCopyEmails}
                          className="text-xs text-[#D0006F] hover:text-[#ff4db8] font-medium"
                        >
                          Copy all emails
                        </button>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-[#2a2a42] divide-y divide-[#2a2a42]">
                      {recipients.map((r) => (
                        <div key={r.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                          <span className="text-[#a0a0b8] truncate mr-2">{r.name}</span>
                          <span className="text-[#f1f1f5] font-mono text-xs truncate">{r.email}</span>
                        </div>
                      ))}
                    </div>
                    {skipped.length > 0 && (
                      <p className="text-amber-400/90 text-xs mt-2">
                        ⚠ {skipped.length} member{skipped.length === 1 ? "" : "s"} skipped (no email
                        could be derived): {skipped.map((s) => s.name).join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-4">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 px-4 py-2 bg-[#2a2a42] text-[#f1f1f5] font-medium rounded-lg hover:bg-[#3a3a52] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={emailMode === "test" ? handleSendTest : () => handleSendGeneral()}
                disabled={
                  sending ||
                  (emailMode === "test"
                    ? !testEmail.trim()
                    : !recipientsLoaded || recipients.length === 0)
                }
                className="flex-1 px-4 py-2 bg-[#D0006F] text-white font-medium rounded-lg hover:bg-[#a80055] disabled:opacity-50 transition-colors"
              >
                {sending
                  ? "Sending..."
                  : emailMode === "general" && recipientsLoaded
                    ? `Send to ${recipients.length}`
                    : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      <CoverImageGeneratorModal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        previewKey={key}
        onImageSelected={(image) => {
          handleCoverImageSelected(image);
          setShowRegenerateModal(false);
        }}
        onJobStarted={(jobId) => {
          setCoverJobStatus("running");
          setCoverImages([]);
          setCoverJobError(null);
          startPollingJob(jobId);
        }}
      />
    </div>
  );
}
