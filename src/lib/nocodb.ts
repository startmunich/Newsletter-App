import { PreviewState, CoverImage } from "./types";

const NOCODB_BASE_URL = "https://ndb.startmunich.de";

async function nocoFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const apiKey = process.env.NOCODB_API_KEY;
  const tableId = process.env.TABLE_ID;
  const url = `${NOCODB_BASE_URL}/api/v2/tables/${tableId}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "xc-token": apiKey!,
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

// Strip large base64 image data before storing to avoid huge payloads.
// Images are ephemeral (regenerated on demand) and kept in memory only.
function serializeForStorage(preview: PreviewState): string {
  const copy = JSON.parse(JSON.stringify(preview)) as PreviewState;

  if (copy.structured?.coverImages) {
    copy.structured.coverImages = copy.structured.coverImages.map((img: CoverImage) => ({
      ...img,
      imageBase64: "",
    }));
  }

  if (copy.structured?.internalNewsMeme?.images) {
    copy.structured.internalNewsMeme.images = copy.structured.internalNewsMeme.images.map(
      (img) => ({ ...img, imageBase64: undefined })
    );
  }

  // Also strip from html/text (they may contain embedded base64 img tags)
  // Keep structured data but strip rendered html if it contains images
  // Actually keep html as-is — NocoDB can handle text fields

  return JSON.stringify(copy);
}

function deserializeFromStorage(json: string): PreviewState {
  const data = JSON.parse(json) as PreviewState;
  // Fix Date objects serialized as strings
  if (data.createdAt) data.createdAt = new Date(data.createdAt);
  if (data.updatedAt) data.updatedAt = new Date(data.updatedAt);
  if (data.sentAt) data.sentAt = new Date(data.sentAt);
  if (data.testEmailSentAt) data.testEmailSentAt = new Date(data.testEmailSentAt);
  return data;
}

export async function nocoGetAll(): Promise<Array<{ rowId: number; preview: PreviewState }>> {
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
  await nocoFetch("/records", {
    method: "PATCH",
    body: JSON.stringify({
      Id: rowId,
      JSON: serializeForStorage(preview),
    }),
  });
}
