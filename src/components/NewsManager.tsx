"use client";

import { useMemo } from "react";
import {
  NewsletterDraft,
  NewsSelectionSection,
} from "@/lib/types";
import { isEventSection } from "@/lib/openai-client";
import SelectionManager from "@/components/SelectionManager";

interface NewsManagerProps {
  draft: NewsletterDraft;
  onSave: (payload: Partial<NewsletterDraft>) => Promise<void>;
}

/**
 * Orchestrates two selection panels over the same draft:
 *   - "News":  non-event sections (e.g. Internal News)
 *   - "Events": event sections grouped by category (Upcoming Internal/External,
 *     Last Month Internal/External). Events were previously auto-sorted by date
 *     only; they can now be curated and reordered within each category.
 *
 * Both panels share `SelectionManager`. The rendered `sections` are derived from
 * BOTH selections on every save, so the two stay consistent. `isEventSection`
 * (shared with the cover-image prompt builder) decides which selection owns a
 * section.
 */

type SectionPredicate = (title: string) => boolean;

const isNewsSection: SectionPredicate = (title) => !isEventSection(title);

/** Build a selection (everything included, existing order) from the draft's
 *  sections matching `predicate`. */
function deriveFromSections(
  draft: NewsletterDraft,
  predicate: SectionPredicate
): NewsSelectionSection[] {
  return draft.sections
    .filter((section) => predicate(section.title))
    .map((section) => ({
      title: section.title,
      items: section.items.map((item) => ({ ...item, included: true })),
    }));
}

/**
 * A persisted selection is only trustworthy if its *included* items still match
 * the rendered `sections` for the same category. The review/refine view can
 * regenerate `sections` independently, which would make a stored selection
 * stale. Compare the set of included item titles per section (scoped to
 * `predicate`) against `sections`.
 */
function selectionMatchesSections(
  selection: NewsSelectionSection[],
  draft: NewsletterDraft,
  predicate: SectionPredicate
): boolean {
  const includedKeys = new Set<string>();
  for (const section of selection) {
    for (const item of section.items) {
      if (item.included) includedKeys.add(`${section.title}::${item.title}`);
    }
  }
  const sectionKeys = new Set<string>();
  for (const section of draft.sections) {
    if (!predicate(section.title)) continue;
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
 * Builds the editable selection for one category. Prefers the persisted `source`
 * selection when it is still consistent with `sections`; otherwise derives it
 * fresh from `sections` (everything included, existing order).
 */
function buildInitialSelection(
  draft: NewsletterDraft,
  source: NewsSelectionSection[] | undefined,
  predicate: SectionPredicate
): NewsSelectionSection[] {
  if (
    source &&
    source.length > 0 &&
    selectionMatchesSections(source, draft, predicate)
  ) {
    return source.map((section) => ({
      title: section.title,
      items: section.items.map((item) => ({ ...item })),
    }));
  }
  return deriveFromSections(draft, predicate);
}

/**
 * Derives the rendered `sections` from the original draft plus both managed
 * selections: each section is rebuilt from whichever selection owns it (event
 * vs news), keeping only `included` items in order and stripping the editor-only
 * `included` flag. Sections in neither selection pass through untouched.
 */
function deriveSections(
  draft: NewsletterDraft,
  newsSelection: NewsSelectionSection[],
  eventSelection: NewsSelectionSection[]
) {
  const managedByTitle = new Map<string, NewsSelectionSection>();
  for (const section of [...newsSelection, ...eventSelection]) {
    managedByTitle.set(section.title, section);
  }

  return draft.sections.map((section) => {
    const managed = managedByTitle.get(section.title);
    if (!managed) return section;
    return {
      title: section.title,
      items: managed.items
        .filter((item) => item.included)
        .map(({ included: _included, ...item }) => item),
    };
  });
}

export default function NewsManager({ draft, onSave }: NewsManagerProps) {
  const initialNews = useMemo(
    () => buildInitialSelection(draft, draft.newsSelection, isNewsSection),
    [draft]
  );
  const initialEvents = useMemo(
    () => buildInitialSelection(draft, draft.eventSelection, isEventSection),
    [draft]
  );

  const hasNews = initialNews.some((s) => s.items.length > 0);
  const hasEvents = initialEvents.some((s) => s.items.length > 0);

  if (!hasNews && !hasEvents) return null;

  // Saving either panel re-derives `sections` from both selections so the
  // rendered newsletter stays consistent. We persist BOTH selections every time
  // so a freshly-rebuilt (previously stale) counterpart selection is also saved
  // rather than silently dropped. The panel being saved supplies its fresh
  // selection; the other keeps its current initial value.
  const saveNews = (newsSelection: NewsSelectionSection[]) =>
    onSave({
      sections: deriveSections(draft, newsSelection, initialEvents),
      newsSelection,
      eventSelection: initialEvents,
    });

  const saveEvents = (eventSelection: NewsSelectionSection[]) =>
    onSave({
      sections: deriveSections(draft, initialNews, eventSelection),
      newsSelection: initialNews,
      eventSelection,
    });

  return (
    <>
      {hasNews && (
        <SelectionManager
          title="News"
          description="Choose which news to include and reorder them. Deselected news is removed from the newsletter."
          initial={initialNews}
          onSave={saveNews}
        />
      )}
      {hasEvents && (
        <SelectionManager
          title="Events"
          description="Choose which events to include and reorder them within each category. Deselected events are removed from the newsletter."
          initial={initialEvents}
          onSave={saveEvents}
        />
      )}
    </>
  );
}
