"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { PreviewState, CoverImage } from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import CoverImageGeneratorModal from "@/components/CoverImageGeneratorModal";
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

  // Cover image state
  const [coverImages, setCoverImages] = useState<CoverImage[]>([]);
  const [coverJobStatus, setCoverJobStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [coverJobError, setCoverJobError] = useState<string | null>(null);
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState("");
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

  const startPollingJob = (jobId: string) => {
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
  };

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const response = await fetch(`/api/preview-data/${key}`);
        if (response.ok) {
          const data: PreviewState = await response.json();
          setPreview(data);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const handleCoverImageSelected = async (image: CoverImage) => {
    if (!preview) return;
    try {
      const response = await fetch(`/api/preview-data/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedCoverImageIndex: image.index }),
      });
      if (!response.ok) throw new Error("Failed to save selection");
      const updated = await response.json();
      setPreview(updated);
    } catch (error) {
      console.error("Failed to select cover image:", error);
    }
  };

  const handleStartRegenerate = async () => {
    if (!regeneratePrompt.trim()) return;
    setCoverJobStatus("running");
    setCoverImages([]);
    setCoverJobError(null);
    setShowRegeneratePrompt(false);

    try {
      const response = await fetch("/api/generate-cover-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewKey: key, prompt: regeneratePrompt }),
      });
      if (!response.ok) throw new Error("Failed to start generation");
      const { jobId } = await response.json();
      startPollingJob(jobId);
    } catch (err) {
      setCoverJobStatus("error");
      setCoverJobError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const openRegeneratePrompt = async () => {
    // Load default prompt if not yet set
    if (!regeneratePrompt) {
      try {
        const res = await fetch(`/api/generate-cover-images?previewKey=${encodeURIComponent(key)}`);
        if (res.ok) {
          const data = await res.json();
          setRegeneratePrompt(data.defaultPrompt || "");
        }
      } catch { /* ignore */ }
    }
    setShowRegeneratePrompt(true);
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

  const handleSendGeneral = async () => {
    setSending(true);
    try {
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok) {
        alert("Newsletter sent successfully!");
        setShowEmailModal(false);
        const r = await fetch(`/api/preview-data/${key}`);
        if (r.ok) setPreview(await r.json());
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

              {/* Cover Image Section — always visible */}
              <div className="mb-8 max-w-2xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#f1f1f5]">Cover Image</h2>
                    {isGenerating && (
                      <p className="text-[#a0a0b8] text-xs mt-1 flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full border-2 border-[#D0006F] border-t-transparent animate-spin" />
                        Generating in background... ({coverImages.length}/3 ready)
                      </p>
                    )}
                    {coverJobStatus === "done" && coverImages.length > 0 && (
                      <p className="text-[#a0a0b8] text-xs mt-1">Click an image to use it as the newsletter cover.</p>
                    )}
                    {coverJobStatus === "error" && (
                      <p className="text-red-400 text-xs mt-1">{coverJobError}</p>
                    )}
                  </div>
                  <button
                    onClick={openRegeneratePrompt}
                    className="px-4 py-1.5 bg-[#2a2a42] text-[#f1f1f5] text-sm font-medium rounded-lg hover:bg-[#3a3a52] transition-colors"
                  >
                    Regenerate
                  </button>
                </div>

                {/* Inline regenerate prompt editor */}
                {showRegeneratePrompt && (
                  <div className="mb-4 bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                    <label className="block text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                      Prompt
                    </label>
                    <textarea
                      value={regeneratePrompt}
                      onChange={(e) => setRegeneratePrompt(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-[#2a2a42] border border-[#3a3a52] rounded-lg text-[#f1f1f5] placeholder-[#606078] focus:outline-none focus:border-[#D0006F] resize-y text-sm mb-3"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowRegeneratePrompt(false)}
                        className="px-4 py-1.5 bg-[#2a2a42] text-[#f1f1f5] text-sm rounded-lg hover:bg-[#3a3a52] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleStartRegenerate}
                        disabled={!regeneratePrompt.trim()}
                        className="px-4 py-1.5 bg-[#D0006F] text-white text-sm font-semibold rounded-lg hover:bg-[#a80055] disabled:opacity-50 transition-colors"
                      >
                        Generate Images
                      </button>
                    </div>
                  </div>
                )}

                {/* Image grid */}
                <div className="grid grid-cols-3 gap-4">
                  {coverImages.map((image) => {
                    const isSelected = selectedIndex === image.index;
                    const typeLabel = image.index === 0 ? "Meme" : image.index === 1 ? "Photo" : "Creative";
                    return (
                      <div key={image.index} className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">{typeLabel}</span>
                        <button
                          onClick={() => handleCoverImageSelected(image)}
                          className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected ? "border-[#D0006F] ring-2 ring-[#D0006F]/30" : "border-[#2a2a42] hover:border-[#4a4a62]"
                          }`}
                        >
                          <img
                            src={`data:image/png;base64,${image.imageBase64}`}
                            alt={`Cover option ${typeLabel}`}
                            className="w-full aspect-square object-cover"
                          />
                          {isSelected && (
                            <span className="absolute top-2 right-2 bg-[#D0006F] text-white text-xs font-semibold px-2 py-0.5 rounded">
                              ✓
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}

                  {/* Skeleton placeholders while generating */}
                  {isGenerating &&
                    ["Meme", "Photo", "Creative"].slice(coverImages.length).map((label, i) => (
                      <div key={`skeleton-${i}`} className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">{label}</span>
                        <div className="w-full aspect-square rounded-lg bg-[#2a2a42] animate-pulse flex items-center justify-center">
                          <span className="text-[#3a3a52] text-xs">Generating…</span>
                        </div>
                      </div>
                    ))}

                  {/* Empty state: never generated */}
                  {coverJobStatus === "idle" && coverImages.length === 0 &&
                    ["Meme", "Photo", "Creative"].map((label, i) => (
                      <div key={`empty-${i}`} className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">{label}</span>
                        <div className="w-full aspect-square rounded-lg border-2 border-dashed border-[#2a2a42] flex items-center justify-center">
                          <span className="text-[#3a3a52] text-xs">No image</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Right: Newsletter Preview */}
            <div className="w-1/2 border-l border-[#2a2a42] overflow-y-auto p-8 bg-[#0a0a14]">
              <h2 className="text-lg font-bold text-[#f1f1f5] mb-4">Preview</h2>
              <div
                className="bg-white rounded-lg overflow-hidden shadow-lg p-6 prose prose-sm max-w-none h-[calc(100vh-140px)] overflow-y-auto"
                style={{ userSelect: "text", WebkitUserSelect: "text" }}
              >
                <div dangerouslySetInnerHTML={{ __html: preview.html }} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-8 max-w-md w-full mx-4">
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
              <p className="text-[#a0a0b8] text-sm mb-4">
                Send this newsletter to all subscribers. This will mark the draft as sent.
              </p>
            )}
            <div className="flex gap-4">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 px-4 py-2 bg-[#2a2a42] text-[#f1f1f5] font-medium rounded-lg hover:bg-[#3a3a52] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={emailMode === "test" ? handleSendTest : handleSendGeneral}
                disabled={sending || (emailMode === "test" && !testEmail.trim())}
                className="flex-1 px-4 py-2 bg-[#D0006F] text-white font-medium rounded-lg hover:bg-[#a80055] disabled:opacity-50 transition-colors"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
