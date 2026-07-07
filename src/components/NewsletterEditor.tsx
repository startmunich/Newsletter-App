"use client";

import { useState } from "react";
import { NewsletterDraft } from "@/lib/types";

interface Props {
  draft: NewsletterDraft;
  onUpdate: (draft: NewsletterDraft) => void;
}

export function NewsletterEditor({ draft, onUpdate }: Props) {
  const [localDraft, setLocalDraft] = useState<NewsletterDraft>(draft);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const updateField = <K extends keyof NewsletterDraft>(
    field: K,
    value: NewsletterDraft[K]
  ) => {
    setLocalDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (
    sectionIndex: number,
    itemIndex: number,
    field: string,
    value: string
  ) => {
    setLocalDraft((prev) => {
      const sections = [...prev.sections];
      const items = [...sections[sectionIndex].items];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      sections[sectionIndex] = { ...sections[sectionIndex], items };
      return { ...prev, sections };
    });
  };

  const handleReRender = () => {
    onUpdate(localDraft);
  };

  return (
    <div className="space-y-4">
      {/* Subject & Preheader */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Subject line
          </label>
          <input
            type="text"
            value={localDraft.subject}
            onChange={(e) => updateField("subject", e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-magenta"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Preheader
          </label>
          <input
            type="text"
            value={localDraft.preheader}
            onChange={(e) => updateField("preheader", e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-magenta"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Intro
          </label>
          <textarea
            value={localDraft.intro}
            onChange={(e) => updateField("intro", e.target.value)}
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-magenta resize-y"
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {localDraft.sections.map((section, sIdx) => (
          <div
            key={sIdx}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleSection(sIdx)}
              className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
            >
              <span className="text-sm font-medium text-navy">
                {section.title}
              </span>
              <span className="text-xs text-gray-400">
                {section.items.length} item{section.items.length !== 1 ? "s" : ""}{" "}
                {expandedSections.has(sIdx) ? "▾" : "▸"}
              </span>
            </button>

            {expandedSections.has(sIdx) && (
              <div className="p-3 space-y-3 border-t border-gray-200">
                {section.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    className="bg-white border border-gray-100 rounded-lg p-3 space-y-2"
                  >
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) =>
                        updateItem(sIdx, iIdx, "title", e.target.value)
                      }
                      placeholder="Item title"
                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-magenta"
                    />
                    <textarea
                      value={item.summary}
                      onChange={(e) =>
                        updateItem(sIdx, iIdx, "summary", e.target.value)
                      }
                      placeholder="Summary"
                      rows={2}
                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-magenta resize-y"
                    />
                    {item.url && (
                      <input
                        type="text"
                        value={item.url}
                        onChange={(e) =>
                          updateItem(sIdx, iIdx, "url", e.target.value)
                        }
                        placeholder="URL"
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-magenta"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleReRender}
        className="w-full py-2.5 px-4 bg-navy text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
      >
        Re-render preview
      </button>
    </div>
  );
}
