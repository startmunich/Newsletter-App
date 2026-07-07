"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { NewsletterEditor } from "@/components/NewsletterEditor";
import { HtmlPreview } from "@/components/HtmlPreview";
import { ActionBar } from "@/components/ActionBar";
import { NewsletterDraft, PreviewState } from "@/lib/types";

export default function ReviewPage() {
  const params = useParams();
  const previewKey = params.key as string;
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
      } catch {
        setError("Failed to load preview");
      } finally {
        setLoading(false);
      }
    }
    fetchMetadata();
  }, [previewKey, refreshKey]);

  const handleDraftUpdate = async (draft: NewsletterDraft) => {
    try {
      const res = await fetch(`/api/preview/${previewKey}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (res.ok) {
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error("Failed to update draft:", err);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading preview...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="bg-navy text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Newsletter Review</h1>
          {preview && (
            <p className="text-sm text-magenta">
              Version {preview.approvalVersion} &bull; {preview.subject}
            </p>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {preview?.status === "sent" ? "✓ Sent" : "Reviewing"}
        </span>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: Editor */}
        <div className="w-full lg:w-1/2 border-r border-gray-200 overflow-y-auto p-4">
          {preview?.structured ? (
            <NewsletterEditor
              draft={preview.structured}
              onUpdate={handleDraftUpdate}
            />
          ) : (
            <p className="text-gray-500 text-center py-8">
              Structured data not available for editing
            </p>
          )}
        </div>

        {/* Right: Preview */}
        <div className="w-full lg:w-1/2 overflow-y-auto">
          <HtmlPreview previewKey={previewKey} refreshKey={refreshKey} />
        </div>
      </div>

      {/* Bottom: Actions */}
      <ActionBar
        previewKey={previewKey}
        testEmailSent={!!preview?.testEmailSentAt}
        approvalVersion={preview?.approvalVersion || 1}
        status={preview?.status || "reviewing"}
      />
    </main>
  );
}
