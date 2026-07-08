"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HtmlPreview } from "@/components/HtmlPreview";
import { ActionBar } from "@/components/ActionBar";
import { Sidebar } from "@/components/Sidebar";
import { CoverImageSelector } from "@/components/CoverImageSelector";
import { PreviewState, CoverImage } from "@/lib/types";

export default function ReviewPage() {
  const params = useParams();
  const previewKey = params.key as string;
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedHtml, setEditedHtml] = useState("");
  const [selectedCoverImageIndex, setSelectedCoverImageIndex] = useState<number | undefined>();

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const res = await fetch(`/api/preview/${previewKey}/metadata`);
        if (!res.ok) {
          setError("Preview not found");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setPreview(data);
        setSelectedCoverImageIndex(data.structured?.selectedCoverImageIndex ?? 0);
      } catch {
        setError("Failed to load preview");
      } finally {
        setLoading(false);
      }
    }
    fetchMetadata();
  }, [previewKey, refreshKey]);

  const handleRefine = async () => {
    if (!refinementPrompt.trim()) return;

    setRefining(true);
    try {
      const res = await fetch(`/api/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: previewKey,
          feedback: refinementPrompt,
        }),
      });

      if (res.ok) {
        setRefinementPrompt("");
        setRefreshKey((k) => k + 1);
      } else {
        alert("Failed to refine newsletter");
      }
    } catch (err) {
      console.error("Failed to refine:", err);
      alert("Error refining newsletter");
    } finally {
      setRefining(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = editedHtml.trim()
        ? { html: editedHtml }
        : { draft: preview?.structured };

      const res = await fetch(`/api/preview/${previewKey}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("Draft saved successfully!");
      } else {
        alert("Failed to save draft");
      }
    } catch (err) {
      console.error("Failed to save:", err);
      alert("Error saving draft");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a0a14]">
        <div className="animate-pulse text-[#5c5c7a]">Loading preview...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a0a14]">
        <div className="text-red-400">{error}</div>
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a14]">
      <Sidebar activeKey={previewKey} />
      <main className="flex-1 flex flex-col">
        <header className="bg-[#111124] border-b border-[#2a2a42] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center border border-[#2a2a42]">
              <span className="text-magenta font-bold text-xs">S</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#f1f1f5]">Newsletter Review</h1>
              {preview && (
                <p className="text-xs text-[#a0a0b8]">
                  Version {preview.approvalVersion} &bull; {preview.subject}
                </p>
              )}
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full border ${preview?.status === "sent" ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-[#2a2a42] text-[#5c5c7a]"}`}>
            {preview?.status === "sent" ? "✓ Sent" : "Reviewing"}
          </span>
        </header>

        <div className="flex-1 flex">
          {/* Left: Refinement Panel */}
          <div className="w-1/3 border-r border-[#2a2a42] overflow-y-auto p-6 bg-[#0a0a14]">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-[#f1f1f5] mb-4">Refine Newsletter</h2>
              <textarea
                value={refinementPrompt}
                onChange={(e) => setRefinementPrompt(e.target.value)}
                placeholder="Describe what you'd like to change or improve..."
                className="w-full h-32 px-4 py-3 bg-[#1a1a2e] border border-[#2a2a42] rounded-lg text-[#f1f1f5] placeholder-[#606078] focus:outline-none focus:border-magenta resize-none"
              />
              <button
                onClick={handleRefine}
                disabled={refining || !refinementPrompt.trim()}
                className="w-full mt-4 px-4 py-2 bg-magenta text-white font-medium rounded-lg hover:bg-[#ff4db8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {refining ? "Refining..." : "Refine"}
              </button>
            </div>

            <div className="border-t border-[#2a2a42] pt-6">
              {preview?.structured.coverImages && preview.structured.coverImages.length > 0 && (
                <CoverImageSelector
                  images={preview.structured.coverImages}
                  selectedIndex={selectedCoverImageIndex}
                  previewKey={previewKey}
                  onSelect={(index) => {
                    setSelectedCoverImageIndex(index);
                    setRefreshKey((k) => k + 1);
                  }}
                />
              )}
            </div>

            <div className="border-t border-[#2a2a42] pt-6">
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="w-full px-4 py-2 bg-[#2a2a42] text-[#f1f1f5] font-medium rounded-lg hover:bg-[#3a3a52] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
            </div>
          </div>

          {/* Right: Editable Preview */}
          <div className="w-2/3 overflow-y-auto">
            <HtmlPreview
              previewKey={previewKey}
              refreshKey={refreshKey}
              editable={true}
              onHtmlChange={setEditedHtml}
            />
          </div>
        </div>

        {/* Bottom: Actions */}
        <ActionBar
          previewKey={previewKey}
          testEmailSent={!!preview?.testEmailSentAt}
          approvalVersion={preview?.approvalVersion || 1}
          status={preview?.status || "reviewing"}
          hideTestEmail={true}
        />
      </main>
    </div>
  );
}
