interface LumaEvent {
  name: string;
  date: string;
  location: string;
  description: string;
  url: string;
  imageUrl?: string;
  imageAlt?: string;
}

interface LumaApiEvent {
  event: {
    name?: string;
    start_at?: string;
    end_at?: string;
    geo_address_info?: { full_address?: string };
    description?: string;
    url?: string;
    api_id?: string;
    cover_url?: string;
  };
}

export async function fetchLumaEvents(
  calendarId: string,
  after: string,
  before: string,
  apiKey: string
): Promise<LumaEvent[]> {
  const url = new URL("https://public-api.luma.com/v1/calendar/list-events");
  url.searchParams.set("series_mode", "sessions");
  url.searchParams.set("after", after);
  url.searchParams.set("before", before);
  url.searchParams.set("calendar_api_id", calendarId);
  url.searchParams.set("pagination_limit", "100");

  const response = await fetch(url.toString(), {
    headers: {
      "x-luma-api-key": apiKey,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Luma API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const entries: LumaApiEvent[] = data.entries || [];

  return entries.map((entry) => {
    const evt = entry.event;
    const description = evt.description || "";
    const truncated =
      description.length > 180
        ? description.substring(0, 180).replace(/\s+\S*$/, "") + "..."
        : description;

    return {
      name: evt.name || "Untitled Event",
      date: evt.start_at || "",
      location: evt.geo_address_info?.full_address || "TBA",
      description: truncated,
      url: evt.url || `https://lu.ma/${evt.api_id || ""}`,
      imageUrl: evt.cover_url,
      imageAlt: evt.name || "Event image",
    };
  });
}

function formatEventList(events: LumaEvent[]): string {
  if (events.length === 0) return "  (none)\n";

  return events
    .map((e) => {
      const dateStr = e.date
        ? new Date(e.date).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Date TBA";
      const imageInfo = e.imageUrl ? `\n    Image: ${e.imageUrl}` : "";
      return `  - ${e.name}\n    Date: ${dateStr}\n    Location: ${e.location}\n    Description: ${e.description}\n    URL: ${e.url}${imageInfo}`;
    })
    .join("\n\n");
}

export function buildLumaEventDigest(
  externalUpcoming: LumaEvent[],
  internalUpcoming: LumaEvent[],
  externalLastMonth: LumaEvent[],
  internalLastMonth: LumaEvent[]
): string {
  let digest = "=== LUMA EVENT DATA ===\n\n";

  digest += "## Upcoming External Events\n";
  digest += formatEventList(externalUpcoming);
  digest += "\n\n";

  digest += "## Upcoming Internal Events\n";
  digest += formatEventList(internalUpcoming);
  digest += "\n\n";

  digest += "## Last Month External Events\n";
  digest += formatEventList(externalLastMonth);
  digest += "\n\n";

  digest += "## Last Month Internal Events\n";
  digest += formatEventList(internalLastMonth);
  digest += "\n";

  return digest;
}
