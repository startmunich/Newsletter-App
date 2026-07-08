import { PreviewState, CoverImage } from "./types";
import { extractSubjectLine, renderNewsletterHtml, renderNewsletterText } from "./renderer";

const NOCODB_BASE_URL = "https://ndb.startmunich.de";

function getNocoConfig(): { apiKey: string; tableId: string } | null {
  const apiKey = process.env.NOCODB_API_KEY;
  const tableId = process.env.TABLE_ID;

  if (!apiKey || !tableId) return null;
  return { apiKey, tableId };
}

export function isNocoConfigured(): boolean {
  return Boolean(getNocoConfig());
}

async function nocoFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const config = getNocoConfig();
  if (!config) {
    throw new Error("NocoDB is not configured");
  }

  const url = `${NOCODB_BASE_URL}/api/v2/tables/${config.tableId}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "xc-token": config.apiKey,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NocoDB ${response.status}: ${text}`);
  }

  return response.json();
}

// Keep cover-image data in structured state so selected covers survive restarts.
// Strip duplicated base64 from rendered HTML and non-cover generated images to keep payloads smaller.
function serializeForStorage(preview: PreviewState): string {
  const copy = JSON.parse(JSON.stringify(preview)) as PreviewState;

  if (copy.structured?.internalNewsMeme?.images) {
    copy.structured.internalNewsMeme.images = copy.structured.internalNewsMeme.images.map(
      (img) => ({ ...img, imageBase64: undefined })
    );
  }

  // Strip base64 data URIs from rendered HTML (they can be millions of chars)
  if (copy.html) {
    copy.html = copy.html.replace(/src="data:[^"]{100,}"/g, 'src=""');
  }

  return JSON.stringify(copy);
}

function deserializeFromStorage(json: string): PreviewState {
  const data = JSON.parse(json) as PreviewState;
  // Fix Date objects serialized as strings
  if (data.createdAt) data.createdAt = new Date(data.createdAt);
  if (data.updatedAt) data.updatedAt = new Date(data.updatedAt);
  if (data.sentAt) data.sentAt = new Date(data.sentAt);
  if (data.testEmailSentAt) data.testEmailSentAt = new Date(data.testEmailSentAt);
  if (
    data.structured?.coverImages?.some((img: CoverImage) => img.imageBase64) &&
    data.structured.selectedCoverImageIndex !== undefined
  ) {
    data.html = renderNewsletterHtml(data.structured);
    data.text = renderNewsletterText(data.structured);
    data.subject = extractSubjectLine(data.structured);
    data.preheader = data.structured.preheader;
  }
  return data;
}

export async function nocoGetAll(): Promise<Array<{ rowId: number; preview: PreviewState }>> {
  if (!getNocoConfig()) return [];

  const data = await nocoFetch("/records?limit=200&sort=-UpdatedAt") as {
    list: Array<Record<string, unknown>>;
  };

  return (data.list || [])
    .filter((r) => typeof r.JSON === "string" && r.JSON)
    .map((r) => ({
      rowId: r.Id as number,
      preview: deserializeFromStorage(r.JSON as string),
    }));
}

export async function nocoGetByKey(
  key: string
): Promise<{ rowId: number; preview: PreviewState } | null> {
  if (!getNocoConfig()) return null;

  const data = await nocoFetch(
    `/records?where=(Title,eq,${encodeURIComponent(key)})&limit=1`
  ) as { list: Array<Record<string, unknown>> };

  const records = data.list || [];
  if (records.length === 0 || typeof records[0].JSON !== "string") return null;

  return {
    rowId: records[0].Id as number,
    preview: deserializeFromStorage(records[0].JSON as string),
  };
}

export async function nocoCreate(key: string, preview: PreviewState): Promise<number> {
  if (!getNocoConfig()) return 0;

  const data = await nocoFetch("/records", {
    method: "POST",
    body: JSON.stringify({
      Title: key,
      JSON: serializeForStorage(preview),
    }),
  }) as { Id: number };

  return data.Id;
}

export async function nocoUpdate(rowId: number, preview: PreviewState): Promise<void> {
  if (!getNocoConfig()) return;

  await nocoFetch("/records", {
    method: "PATCH",
    body: JSON.stringify({
      Id: rowId,
      JSON: serializeForStorage(preview),
    }),
  });
}

export async function nocoDelete(rowId: number): Promise<void> {
  if (!getNocoConfig()) return;

  await nocoFetch("/records", {
    method: "DELETE",
    body: JSON.stringify({ Id: rowId }),
  });
}
