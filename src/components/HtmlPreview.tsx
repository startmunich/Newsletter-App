"use client";

interface Props {
  previewKey: string;
  refreshKey?: number;
}

export function HtmlPreview({ previewKey, refreshKey = 0 }: Props) {
  const iframeSrc = `/api/preview/${previewKey}?v=${refreshKey}`;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500">Email Preview</span>
        <a
          href={`/review/${previewKey}/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-magenta hover:underline"
        >
          Open full screen ↗
        </a>
      </div>
      <div className="flex-1 bg-gray-100 p-2">
        <iframe
          src={iframeSrc}
          className="w-full h-full min-h-[600px] bg-white rounded border border-gray-200"
          title="Newsletter preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
