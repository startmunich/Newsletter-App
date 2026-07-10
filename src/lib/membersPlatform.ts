const MEMBERS_PLATFORM_BASE = "https://my.startmunich.de/api/v1";

// Batch codes we can query the public/members endpoint with: YYYY-WS / YYYY-SS.
// Bare-year batches (e.g. "2019") and null batches don't fit the documented
// query format, so we don't offer them as selectable options.
const BATCH_PATTERN = /^\d{4}-(WS|SS)$/;

export interface Member {
  id: string;
  name: string;
  batch: string | null;
}

interface MembersResponse {
  data?: Member[];
}

/**
 * Fetch member profiles for the given batches via the members-platform public
 * API. Cancelled/excluded members are already omitted server-side.
 */
export async function fetchMembersByBatches(
  batches: string[],
  apiKey: string
): Promise<Member[]> {
  const url = new URL(`${MEMBERS_PLATFORM_BASE}/public/members`);
  url.searchParams.set("batches", batches.join(","));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Members platform API error: ${response.status} ${response.statusText}`
    );
  }

  const data: MembersResponse = await response.json();
  return data.data ?? [];
}

/**
 * Fetch the distinct, selectable batch codes (YYYY-WS / YYYY-SS), most recent
 * first. Uses the internal/members endpoint which returns every member.
 */
export async function fetchAvailableBatches(apiKey: string): Promise<string[]> {
  const response = await fetch(`${MEMBERS_PLATFORM_BASE}/internal/members`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Members platform API error: ${response.status} ${response.statusText}`
    );
  }

  const data: MembersResponse = await response.json();
  const members = data.data ?? [];

  const batches = new Set<string>();
  for (const member of members) {
    if (member.batch && BATCH_PATTERN.test(member.batch)) {
      batches.add(member.batch);
    }
  }

  // Descending sort => most recent batches first (e.g. 2026-SS before 2025-WS).
  return [...batches].sort((a, b) => b.localeCompare(a));
}

/** Transliterate German umlauts/ß and strip remaining accents to plain ascii. */
function stripAccents(input: string): string {
  return input
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks
    .replace(/[^a-z]/g, ""); // drop anything not a-z (hyphens, apostrophes, ...)
}

/**
 * Derive a START email from a member name using the convention
 * `<first-initial>.<surname>@startmunich.de`, e.g. "Lisa Schowalter" =>
 * "l.schowalter@startmunich.de". The last whitespace-separated token is treated
 * as the surname. Returns null when the name can't yield a valid local part
 * (single token, or surname strips to empty).
 */
export function deriveStartEmail(name: string): string | null {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const initial = stripAccents(tokens[0].toLowerCase()).charAt(0);
  const surname = stripAccents(tokens[tokens.length - 1].toLowerCase());

  if (!initial || !surname) return null;

  return `${initial}.${surname}@startmunich.de`;
}
