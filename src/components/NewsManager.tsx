"use client";

import { useMemo, useState } from "react";
import {
  NewsletterDraft,
  NewsSelectionItem,
  NewsSelectionSection,
} from "@/lib/types";
import { isEventSection } from "@/lib/openai-client";

interface NewsManagerProps {
  draft: NewsletterDraft;
  onSave: (payload: Partial<NewsletterDraft>) => Promise<void>;
}

/**
 * Event sections (upcoming / last month, internal / external) are ordered by
 * date automatically (Luma returns them sorted) and are NOT manually managed
 * here. Only non-event sections (e.g. Internal News) can be selected/reordered.
 * `isEventSection` is shared with the cover-image prompt builder in openai-client.
 */

function deriveFromSections(draft: NewsletterDraft): NewsSelectionSection[] {
  return draft.sections
    .filter((section) => !isEventSection(section.title))
    .map((section) => ({
      title: section.title,
      items: section.items.map((item) => ({ ...item, included: true })),
    }));
}

/**
 * The persisted `newsSelection` is only trustworthy if its *included* items
 * still match the rendered `sections`. The review/refine view can regenerate
 * or edit `sections` independently, which would make a stored selection stale.
 * We compare the set of included item titles per section against `sections`.
 */
function selectionMatchesSections(
  selection: NewsSelectionSection[],
  draft: NewsletterDraft
): boolean {
  const includedKeys = new Set<string>();
  for (const section of selection) {
    for (const item of section.items) {
      if (item.included) includedKeys.add(`${section.title}::${item.title}`);
    }
  }
  // Only compare against non-event sections — event sections aren't managed here.
  const sectionKeys = new Set<string>();
  for (const section of draft.sections) {
    if (isEventSection(section.title)) continue;
    for (const item of section.items) {
      sectionKeys.add(`${section.title}::${item.title}`);
    }
  }
  if (includedKeys.size !== sectionKeys.size) return false;
  for (const key of sectionKeys) {
    if (!includedKeys.has(key)) return false;
  }
  return true;
}

/**
 * Builds the editable news state. Prefers the persisted `newsSelection` when it
 * is still consistent with `sections`; otherwise derives it fresh from
 * `sections` (everything included, existing order).
 */
function buildInitialSelection(draft: NewsletterDraft): NewsSelectionSection[] {
  if (
    draft.newsSelection &&
    draft.newsSelection.length > 0 &&
    selectionMatchesSections(draft.newsSelection, draft)
  ) {
    return draft.newsSelection.map((section) => ({
      title: section.title,
      items: section.items.map((item) => ({ ...item })),
    }));
  }

  return deriveFromSections(draft);
}

/**
 * Derives the rendered `sections` from the original draft plus the managed
 * (non-event) selection: event sections pass through untouched in their
 * original position; non-event sections use the selected items in order.
 */
function deriveSections(draft: NewsletterDraft, selection: NewsSelectionSection[]) {
  const managedByTitle = new Map(selection.map((s) => [s.title, s]));

  return draft.sections.map((section) => {
    if (isEventSection(section.title)) return section;
    const managed = managedByTitle.get(section.title);
    if (!managed) return section;
    return {
      title: section.title,
      items: managed.items
        .filter((item) => item.included)
        // Strip the editor-only `included` flag from rendered items.
        .map(({ included: _included, ...item }) => item),
    };
  });
}

function selectionsEqual(
  a: NewsSelectionSection[],
  b: NewsSelectionSection[]
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function NewsManager({ draft, onSave }: NewsManagerProps) {
  const initial = useMemo(() => buildInitialSelection(draft), [draft]);
  const [selection, setSelection] = useState<NewsSelectionSection[]>(initial);
  const [savedSnapshot, setSavedSnapshot] =
    useState<NewsSelectionSection[]>(initial);
  const [saving, setSaving] = useState(false);

  const dirty = !selectionsEqual(selection, savedSnapshot);

  const totalItems = selection.reduce((sum, s) => sum + s.items.length, 0);

  // Nothing to manage (no non-event news items at all) — hide the panel entirely.
  if (totalItems === 0) return null;

  const includedItems = selection.reduce(
    (sum, s) => sum + s.items.filter((i) => i.included).length,
    0
  );

  const updateSection = (
    sectionIndex: number,
    updater: (items: NewsSelectionItem[]) => NewsSelectionItem[]
  ) => {
    setSelection((prev) =>
      prev.map((section, i) =>
        i === sectionIndex
          ? { ...section, items: updater(section.items) }
          : section
      )
    );
  };

  const toggleItem = (sectionIndex: number, itemIndex: number) => {
    updateSection(sectionIndex, (items) =>
      items.map((item, i) =>
        i === itemIndex ? { ...item, included: !item.included } : item
      )
    );
  };

  const moveItem = (
    sectionIndex: number,
    itemIndex: number,
    direction: -1 | 1
  ) => {
    const target = itemIndex + direction;
    updateSection(sectionIndex, (items) => {
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[itemIndex], next[target]] = [next[target], next[itemIndex]];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        sections: deriveSections(draft, selection),
        newsSelection: selection,
      });
      setSavedSnapshot(selection.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) })));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelection(savedSnapshot.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) })));
  };

  return (
    <div className="mb-8 max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-[#f1f1f5]">News</h2>
          <p className="text-[#a0a0b8] text-xs mt-1">
            Choose which news to include and reorder them. Deselected news is
            removed from the newsletter. {includedItems}/{totalItems} included.
          </p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-1.5 bg-[#2a2a42] text-[#f1f1f5] text-sm font-medium rounded-lg hover:bg-[#3a3a52] disabled:opacity-50 transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-1.5 bg-[#D0006F] text-white text-sm font-semibold rounded-lg hover:bg-[#a80055] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Selection"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {selection.map((section, sectionIndex) => (
          <div key={`${section.title}-${sectionIndex}`}>
            <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
              {section.title}
            </div>
            {section.items.length === 0 ? (
              <p className="text-[#606078] text-sm italic">No news in this section.</p>
            ) : (
              <div className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <div
                    key={`${item.title}-${itemIndex}`}
                    className={`flex items-start gap-3 bg-[#1a1a2e] border rounded-lg p-3 transition-colors ${
                      item.included
                        ? "border-[#2a2a42]"
                        : "border-[#2a2a42] opacity-50"
                    }`}
                  >
                    <button
                      onClick={() => toggleItem(sectionIndex, itemIndex)}
                      aria-label={item.included ? "Deselect news" : "Select news"}
                      className={`mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                        item.included
                          ? "bg-[#D0006F] border-[#D0006F] text-white"
                          : "border-[#3a3a52] text-transparent hover:border-[#4a4a62]"
                      }`}
                    >
                      ✓
                    </button>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[#f1f1f5] truncate">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#a0a0b8] line-clamp-2">
                        {item.summary}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => moveItem(sectionIndex, itemIndex, -1)}
                        disabled={itemIndex === 0}
                        aria-label="Move up"
                        className="w-6 h-6 flex items-center justify-center rounded bg-[#2a2a42] text-[#f1f1f5] text-xs hover:bg-[#3a3a52] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveItem(sectionIndex, itemIndex, 1)}
                        disabled={itemIndex === section.items.length - 1}
                        aria-label="Move down"
                        className="w-6 h-6 flex items-center justify-center rounded bg-[#2a2a42] text-[#f1f1f5] text-xs hover:bg-[#3a3a52] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
