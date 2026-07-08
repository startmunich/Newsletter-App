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

  const inputClass = "w-full rounded-lg border border-[#2a2a42] bg-[#0a0a14] px-3 py-2 text-sm text-[#f1f1f5] placeholder-[#3a3a57] focus:outline-none focus:ring-1 focus:ring-magenta/40 focus:border-magenta/60 transition-colors";

  return (
    <div className="space-y-4">
      {/* Subject & Preheader */}
      <div className="bg-[#111124] border border-[#2a2a42] rounded-2xl p-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-1.5">
            Subject line
          </label>
          <input
            type="text"
            value={localDraft.subject}
            onChange={(e) => updateField("subject", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-1.5">
            Preheader
          </label>
          <input
            type="text"
            value={localDraft.preheader}
            onChange={(e) => updateField("preheader", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-1.5">
            Intro
          </label>
          <textarea
            value={localDraft.intro}
            onChange={(e) => updateField("intro", e.target.value)}
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {localDraft.sections.map((section, sIdx) => (
          <div
            key={sIdx}
            className="border border-[#2a2a42] rounded-xl overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleSection(sIdx)}
              className="w-full text-left px-4 py-3 bg-[#111124] hover:bg-[#1a1a2e] flex items-center justify-between transition-colors"
            >
              <span className="text-sm font-medium text-[#f1f1f5]">
                {section.title}
              </span>
              <span className="text-xs text-[#5c5c7a]">
                {section.items.length} item{section.items.length !== 1 ? "s" : ""}{" "}
                {expandedSections.has(sIdx) ? "▾" : "▸"}
              </span>
            </button>

            {expandedSections.has(sIdx) && (
              <div className="p-3 space-y-3 border-t border-[#2a2a42] bg-[#0d0d1e]">
                {section.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    className="bg-[#111124] border border-[#2a2a42] rounded-xl p-3 space-y-2"
                  >
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) =>
                        updateItem(sIdx, iIdx, "title", e.target.value)
                      }
                      placeholder="Item title"
                      className={`${inputClass} font-medium`}
                    />
                    <textarea
                      value={item.summary}
                      onChange={(e) =>
                        updateItem(sIdx, iIdx, "summary", e.target.value)
                      }
                      placeholder="Summary"
                      rows={2}
                      className={`${inputClass} resize-y`}
                    />
                    {item.url && (
                      <input
                        type="text"
                        value={item.url}
                        onChange={(e) =>
                          updateItem(sIdx, iIdx, "url", e.target.value)
                        }
                        placeholder="URL"
                        className={`${inputClass} text-xs text-[#5c5c7a]`}
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
        className="w-full py-2.5 px-4 bg-navy border border-[#2a2a42] text-[#f1f1f5] text-sm font-medium rounded-xl hover:bg-[#111124] hover:border-[#3a3a57] transition-colors"
      >
        Re-render preview
      </button>
    </div>
  );
}
