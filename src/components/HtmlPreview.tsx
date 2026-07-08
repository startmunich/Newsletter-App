"use client";

import { memo, useState, useEffect, useRef } from "react";

interface Props {
  previewKey: string;
  refreshKey?: number;
  editable?: boolean;
  onHtmlChange?: (html: string) => void;
}

function HtmlPreviewComponent({ previewKey, refreshKey = 0, editable = false, onHtmlChange }: Props) {
  const iframeSrc = `/api/preview/${previewKey}?v=${refreshKey}`;
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [loading, setLoading] = useState(editable);
  const editableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editable) {
      async function fetchHtml() {
        try {
          const res = await fetch(`/api/preview/${previewKey}`);
          const html = await res.text();
          setHtmlContent(html);
          onHtmlChange?.(html);
        } catch (err) {
          console.error("Failed to load HTML:", err);
        } finally {
          setLoading(false);
        }
      }
      fetchHtml();
    }
  }, [previewKey, refreshKey, editable, onHtmlChange]);

  if (editable && loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-[#111124] border-b border-[#2a2a42]">
          <span className="text-xs text-[#5c5c7a]">Email Preview (Editable)</span>
        </div>
        <div className="flex-1 bg-[#0a0a14] p-3 flex items-center justify-center">
          <div className="animate-pulse text-[#5c5c7a]">Loading...</div>
        </div>
      </div>
    );
  }

  if (editable) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-[#111124] border-b border-[#2a2a42]">
          <span className="text-xs text-[#5c5c7a]">Email Preview - Click to edit text</span>
          <a
            href={`/review/${previewKey}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-magenta hover:text-magenta-light transition-colors"
          >
            Open full screen ↗
          </a>
        </div>
        <div className="flex-1 bg-[#0a0a14] p-3 overflow-y-auto">
          <div
            ref={editableRef}
            className="w-full bg-white rounded-xl p-6 prose prose-sm max-w-none"
            contentEditable={true}
            suppressContentEditableWarning={true}
            onInput={(e) => {
              const nextHtml = e.currentTarget.innerHTML;
              onHtmlChange?.(nextHtml);
            }}
            style={{
              userSelect: "text",
              WebkitUserSelect: "text",
              outline: "none",
            }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-[#111124] border-b border-[#2a2a42]">
        <span className="text-xs text-[#5c5c7a]">Email Preview</span>
        <a
          href={`/review/${previewKey}/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-magenta hover:text-magenta-light transition-colors"
        >
          Open full screen ↗
        </a>
      </div>
      <div className="flex-1 bg-[#0a0a14] p-3">
        <iframe
          src={iframeSrc}
          className="w-full h-full min-h-[600px] bg-white rounded-xl border border-[#2a2a42]"
          title="Newsletter preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}

export const HtmlPreview = memo(HtmlPreviewComponent);
