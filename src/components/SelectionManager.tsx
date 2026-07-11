"use client";

import { useEffect, useState } from "react";
import { NewsSelectionItem, NewsSelectionSection } from "@/lib/types";

interface SelectionManagerProps {
  title: string;
  description: string;
  /** Initial selection (all items, their order, and inclusion flags). */
  initial: NewsSelectionSection[];
  /** Persist the edited selection. Parent derives rendered `sections` from it. */
  onSave: (selection: NewsSelectionSection[]) => Promise<void>;
}

function selectionsEqual(
  a: NewsSelectionSection[],
  b: NewsSelectionSection[]
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function cloneSelection(
  selection: NewsSelectionSection[]
): NewsSelectionSection[] {
  return selection.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) }));
}

/**
 * Presentational panel to select which items to include and reorder them within
 * each section. Shared by the News and Events managers — the only differences
 * are the header copy and which sections the parent feeds in. Deselected items
 * are removed from the rendered newsletter; order within a section is preserved.
 */
export default function SelectionManager({
  title,
  description,
  initial,
  onSave,
}: SelectionManagerProps) {
  const [selection, setSelection] = useState<NewsSelectionSection[]>(initial);
  const [savedSnapshot, setSavedSnapshot] =
    useState<NewsSelectionSection[]>(initial);
  const [saving, setSaving] = useState(false);

  // Re-sync when the parent supplies a fresh initial selection (e.g. after the
  // draft is regenerated and the stored selection is rebuilt).
  useEffect(() => {
    setSelection(initial);
    setSavedSnapshot(initial);
  }, [initial]);

  const dirty = !selectionsEqual(selection, savedSnapshot);

  const totalItems = selection.reduce((sum, s) => sum + s.items.length, 0);

  // Nothing to manage — hide the panel entirely.
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
      await onSave(selection);
      setSavedSnapshot(cloneSelection(selection));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelection(cloneSelection(savedSnapshot));
  };

  return (
    <div className="mb-8 max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-[#f1f1f5]">{title}</h2>
          <p className="text-[#a0a0b8] text-xs mt-1">
            {description} {includedItems}/{totalItems} included.
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
              <p className="text-[#606078] text-sm italic">
                No items in this section.
              </p>
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
                      aria-label={item.included ? "Deselect item" : "Select item"}
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
