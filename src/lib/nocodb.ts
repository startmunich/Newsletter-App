import { PreviewState, CoverImage } from "./types";

const NOCODB_BASE_URL = "https://ndb.startmunich.de";

export type NocoAttachment = {
  url?: string;
  title: string;
  mimetype: string;
  size: number;
  path?: string;
  signedPath?: string;
  signedUrl?: string;
};

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

  // Strip base64 data URIs from rendered HTML (they can be millions of chars)
  if (copy.html) {
    copy.html = copy.html.replace(/src="data:[^"]{100,}"/g, 'src=""');
  }

  return JSON.stringify(copy);
}

function deserializeFromStorage(json: string, record?: Record<string, unknown>): PreviewState {
  const data = JSON.parse(json) as PreviewState;
  // Fix Date objects serialized as strings
  if (data.createdAt) data.createdAt = new Date(data.createdAt);
  if (data.updatedAt) data.updatedAt = new Date(data.updatedAt);
  if (data.sentAt) data.sentAt = new Date(data.sentAt);
  if (data.testEmailSentAt) data.testEmailSentAt = new Date(data.testEmailSentAt);

  // Populate imageUrl from attachment columns
  if (record) {
    for (let i = 0; i < 3; i++) {
      const col = record[`Attachment ${i}`];
      if (Array.isArray(col) && col.length > 0) {
        const att = col[0] as NocoAttachment;
        let url = att.signedUrl || att.signedPath || att.url || "";
        if (url && !url.startsWith("http")) {
          url = `${NOCODB_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
        }
        if (url) {
          if (!data.structured) continue;
          if (!data.structured.coverImages) {
            data.structured.coverImages = [];
          }
          // Ensure the array has an entry at index i
          while (data.structured.coverImages.length <= i) {
            data.structured.coverImages.push({ index: data.structured.coverImages.length, prompt: "", imageBase64: "" });
          }
          data.structured.coverImages[i].imageUrl = url;
        }
      }
    }
  }

  return data;
}

export async function nocoUploadAttachment(
  base64: string,
  filename: string
): Promise<NocoAttachment> {
  const apiKey = process.env.NOCODB_API_KEY;
  const buffer = Buffer.from(base64, "base64");
  const blob = new Blob([buffer], { type: "image/png" });

  const formData = new FormData();
  formData.append("file", blob, filename);

  const response = await fetch(
    `${NOCODB_BASE_URL}/api/v2/storage/upload?path=noco/newsletter-covers`,
    {
      method: "POST",
      headers: { "xc-token": apiKey! },
      body: formData,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NocoDB upload ${response.status}: ${text}`);
  }

  const result = (await response.json()) as NocoAttachment[];
  return result[0];
}

export async function nocoGetAll(): Promise<Array<{ rowId: number; preview: PreviewState }>> {
  const data = await nocoFetch("/records?limit=200&sort=-UpdatedAt") as {
    list: Array<Record<string, unknown>>;
  };

  return (data.list || [])
    .filter((r) => typeof r.JSON === "string" && r.JSON)
    .map((r) => ({
      rowId: r.Id as number,
      preview: deserializeFromStorage(r.JSON as string, r),
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
    preview: deserializeFromStorage(records[0].JSON as string, records[0]),
  };
}

function buildAttachmentFields(attachments?: (NocoAttachment | null)[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (!attachments) return fields;
  for (let i = 0; i < 3; i++) {
    const entry = attachments[i];
    if (entry === null) {
      fields[`Attachment ${i}`] = [];
    } else if (entry !== undefined) {
      fields[`Attachment ${i}`] = [entry];
    }
  }
  return fields;
}

export async function nocoCreate(
  key: string,
  preview: PreviewState,
  attachments?: (NocoAttachment | null)[]
): Promise<number> {
  const data = await nocoFetch("/records", {
    method: "POST",
    body: JSON.stringify({
      Title: key,
      JSON: serializeForStorage(preview),
      ...buildAttachmentFields(attachments),
    }),
  }) as { Id: number };

  return data.Id;
}

export async function nocoUpdate(
  rowId: number,
  preview: PreviewState,
  attachments?: (NocoAttachment | null)[]
): Promise<void> {
  await nocoFetch("/records", {
    method: "PATCH",
    body: JSON.stringify({
      Id: rowId,
      JSON: serializeForStorage(preview),
      ...buildAttachmentFields(attachments),
    }),
  });
}

export async function nocoDelete(rowId: number): Promise<void> {
  await nocoFetch("/records", {
    method: "DELETE",
    body: JSON.stringify({ Id: rowId }),
  });
}
