import { NewsletterDraft, NewsletterSection, NewsletterItem } from "./types";

const NAVY = "#00002C";
const MAGENTA = "#D0006F";
const WHITE = "#ffffff";
const LIGHT_GRAY = "#f5f5f5";
const BORDER_GRAY = "#e0e0e0";

// Past-event sections can get long and get cut off on mobile, so we only show
// the latest few and link out to the member platform for the rest.
const MAX_PAST_EVENTS = 3;
const EVENTS_DASHBOARD_URL = "https://my.startmunich.de/dashboard/events";

// Default text for the alpha notice banner. Shown by default; text and
// visibility are configurable per newsletter on the overview page.
export const DEFAULT_ALPHA_NOTICE_TEXT =
  "This newsletter is still in alpha. If you notice anything off or run into issues, please reach out to XXX.";

function normalizeSectionTitle(title: string): string {
  const normalized = title.toLowerCase().trim();
  if (normalized.includes("internal news") && !normalized.includes("event")) return "Internal News";
  if (normalized.includes("upcoming") && normalized.includes("internal")) return "Upcoming Events - Internal";
  if (normalized.includes("upcoming") && normalized.includes("external")) return "Upcoming Events - External";
  if (normalized.includes("last month") && normalized.includes("internal")) return "Last Month Internal Events";
  if (normalized.includes("last month") && normalized.includes("external")) return "Last Month External Events";
  return title;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// A summary may contain a bullet list where each item is on its own line
// prefixed with "- " (see the draft prompt). Render such lines as a real <ul>
// and everything else as prose paragraphs, so lists don't collapse into one
// run-on sentence. Returns email-safe HTML (each segment individually escaped).
function renderSummaryHtml(summary: string, color: string): string {
  const lines = summary.split("\n");
  const segments: string[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    const items = bulletBuffer
      .map(
        (b) =>
          `<li style="margin: 0 0 4px 0;">${escapeHtml(b)}</li>`
      )
      .join("");
    segments.push(
      `<ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 14px; line-height: 1.5; color: ${color};">${items}</ul>`
    );
    bulletBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]);
    } else {
      flushBullets();
      segments.push(
        `<p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${color};">${escapeHtml(line)}</p>`
      );
    }
  }
  flushBullets();

  return segments.join("");
}

function renderInternalNewsItem(item: NewsletterItem): string {
  return `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid ${BORDER_GRAY};">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: ${NAVY};">${escapeHtml(item.title)}</h3>
        ${renderSummaryHtml(item.summary, "#333333")}
      </td>
    </tr>`;
}

function renderEventItem(item: NewsletterItem, isPastEvent: boolean = false): string {
  let titleElement: string;

  if (isPastEvent && item.url) {
    // Past events: make title a clickable link to Luma
    titleElement = `<a href="${escapeHtml(item.url)}" target="_blank" style="color: ${NAVY}; text-decoration: none; cursor: pointer;"><h3 style="margin: 0 0 6px 0; font-size: 17px; font-weight: 700; color: ${NAVY}; line-height: 1.3; text-decoration: underline;">${escapeHtml(item.title)}</h3></a>`;
  } else {
    // Upcoming events: just render the title normally
    titleElement = `<h3 style="margin: 0 0 6px 0; font-size: 17px; font-weight: 700; color: ${NAVY}; line-height: 1.3;">${escapeHtml(item.title)}</h3>`;
  }

  const ctaButton = !isPastEvent && item.url
    ? `<a href="${escapeHtml(item.url)}" target="_blank" style="display: inline-block; background-color: ${MAGENTA}; color: ${WHITE}; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; margin-top: 10px;">Register &rarr;</a>`
    : "";

  // Image and text are laid out as inline-block "columns" (rather than fixed
  // table cells) so a media query can stack them on narrow screens — see the
  // .event-* rules in the <head> <style> block.
  const imageColumn = item.imageUrl
    ? `<div class="event-img-col" style="display: inline-block; vertical-align: top; width: 160px;">
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt || item.title)}" width="160" style="width: 160px; height: 160px; object-fit: cover; border-radius: 8px; display: block;" />
      </div>`
    : "";

  const textColumn = `
    <div class="event-text-col" style="display: inline-block; vertical-align: top; width: ${item.imageUrl ? "calc(100% - 176px)" : "100%"}; padding-left: ${item.imageUrl ? "16px" : "0"}; box-sizing: border-box;">
      ${titleElement}
      ${renderSummaryHtml(item.summary, "#444444")}
      ${ctaButton}
    </div>`;

  return `
    <tr>
      <td style="padding: 20px 0; border-bottom: 1px solid ${BORDER_GRAY};">
        <div style="font-size: 0;">${imageColumn}${textColumn}</div>
      </td>
    </tr>`;
}

function renderSection(section: NewsletterSection): string {
  const normalizedTitle = normalizeSectionTitle(section.title);
  const isInternalNews = normalizedTitle === "Internal News";
  const isPastEventSection = normalizedTitle.toLowerCase().includes("last month");

  if (section.items.length === 0) return "";

  // For past-event sections, only show the latest few events to keep the
  // newsletter short (especially on mobile). Remaining events are linked via a
  // "See more" button that points to the member platform.
  const visibleItems =
    isPastEventSection && section.items.length > MAX_PAST_EVENTS
      ? section.items.slice(0, MAX_PAST_EVENTS)
      : section.items;
  const hiddenCount = section.items.length - visibleItems.length;

  const itemsHtml = visibleItems
    .map((item) => {
      if (isInternalNews) {
        return renderInternalNewsItem(item);
      } else {
        return renderEventItem(item, isPastEventSection);
      }
    })
    .join("");

  const seeMoreHtml =
    hiddenCount > 0
      ? `
          <tr>
            <td style="padding: 20px 0 0 0; text-align: center;">
              <a href="${EVENTS_DASHBOARD_URL}" target="_blank" style="display: inline-block; background-color: ${LIGHT_GRAY}; color: ${NAVY}; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; border: 1px solid ${BORDER_GRAY};">See ${hiddenCount} more event${hiddenCount === 1 ? "" : "s"} &rarr;</a>
            </td>
          </tr>`
      : "";

  return `
    <tr>
      <td style="padding: 32px 20px 0 20px;">
        <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: ${NAVY}; border-bottom: 3px solid ${MAGENTA}; padding-bottom: 8px;">${escapeHtml(section.title)}</h2>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          ${itemsHtml}
          ${seeMoreHtml}
        </table>
      </td>
    </tr>`;
}

export function renderNewsletterHtml(draft: NewsletterDraft): string {
  const sectionsHtml = draft.sections.map(renderSection).join("");

  // Alpha notice banner (enabled by default). A prominent bar telling readers
  // the newsletter is still alpha and who to contact about issues.
  const alphaEnabled = draft.alphaNotice?.enabled ?? true;
  const alphaText = draft.alphaNotice?.text?.trim() || DEFAULT_ALPHA_NOTICE_TEXT;
  const alphaNoticeHtml = alphaEnabled
    ? `
    <tr>
      <td style="padding: 20px 20px 0 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #FCE4F1; border: 1px solid ${MAGENTA}; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 14px 18px; border-radius: 8px;">
              <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: ${MAGENTA}; text-transform: uppercase; letter-spacing: 0.5px;">&#9888; Alpha</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: ${NAVY};">${escapeHtml(alphaText)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : "";

  // Render selected cover image if available
  const coverImageHtml =
    draft.coverImages && draft.coverImages.length > 0 && draft.selectedCoverImageIndex != null
      ? (() => {
          const selectedImage = draft.coverImages[draft.selectedCoverImageIndex];
          // Prefer the hosted URL over inlined base64 — embedding base64 bloats
          // the email HTML to megabytes and triggers Gmail's "message clipped".
          const src = selectedImage?.imageUrl
            ? escapeHtml(selectedImage.imageUrl)
            : selectedImage?.imageBase64
              ? `data:image/png;base64,${selectedImage.imageBase64}`
              : "";
          if (src) {
            return `
    <tr>
      <td style="padding: 24px 20px 0 20px; text-align: center;">
        <img src="${src}" alt="Newsletter cover" width="280" style="max-width: 280px; width: 50%; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
      </td>
    </tr>`;
          }
          return "";
        })()
      : "";

  const imagesHtml =
    draft.internalNewsMeme?.enabled && draft.internalNewsMeme.images && draft.internalNewsMeme.images.length > 0
      ? draft.internalNewsMeme.images
          .map((img) => {
            if (!img.imageBase64) return "";
            const imageType = img.type === "meme" ? "meme" : "image";
            return `
    <tr>
      <td style="padding: 24px 20px 0 20px; text-align: center;">
        <img src="data:image/png;base64,${img.imageBase64}" alt="Newsletter ${imageType}" width="400" style="max-width: 400px; width: 100%; height: auto; border-radius: 12px; margin: 0 auto;" />
      </td>
    </tr>`;
          })
          .join("")
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(draft.subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* On narrow screens, stack the event image above the text (centered) so the
       text isn't crammed into a tiny column. */
    @media only screen and (max-width: 480px) {
      .event-img-col {
        display: block !important;
        width: 160px !important;
        margin: 0 auto 12px auto !important;
      }
      .event-text-col {
        display: block !important;
        width: 100% !important;
        padding-left: 0 !important;
        text-align: center !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${LIGHT_GRAY}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preheader -->
  <span style="display: none; font-size: 0; line-height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; color: transparent;">${escapeHtml(draft.preheader)}</span>

  <!-- Wrapper -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${LIGHT_GRAY};">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <!-- Main container -->
        <table cellpadding="0" cellspacing="0" border="0" width="700" style="max-width: 700px; width: 100%; background-color: ${WHITE}; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background-color: ${NAVY}; padding: 32px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${WHITE}; letter-spacing: -0.5px;">START Munich</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: ${MAGENTA}; font-weight: 500;">Monthly Newsletter &bull; ${escapeHtml(draft.month)}</p>
            </td>
          </tr>

          <!-- Alpha Notice -->
          ${alphaNoticeHtml}

          <!-- Intro -->
          <tr>
            <td style="padding: 28px 20px 0 20px;">
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #333333;">${escapeHtml(draft.intro)}</p>
            </td>
          </tr>

          <!-- Cover Image -->
          ${coverImageHtml}

          <!-- Images -->
          ${imagesHtml}

          <!-- Sections -->
          ${sectionsHtml}

          <!-- Footer -->
          <tr>
            <td style="padding: 40px 20px 32px 20px; text-align: center; border-top: 1px solid ${BORDER_GRAY}; margin-top: 32px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #666666;">&copy; ${new Date().getFullYear()} START Munich. All rights reserved.</p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #999999;">Automatically generated, approved by human. May contain mistakes.</p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                You&rsquo;re receiving this because you&rsquo;re part of the START Munich community.<br/>
                To unsubscribe from this newsletter, visit your profile settings in the member platform:<br/>
                <a href="https://my.startmunich.de/dashboard/user/settings/profile" style="color: ${MAGENTA}; text-decoration: underline;">my.startmunich.de &rarr; Profile Settings</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderNewsletterText(draft: NewsletterDraft): string {
  let text = `START Munich Monthly Newsletter - ${draft.month}\n`;
  text += `${"=".repeat(50)}\n\n`;

  if (draft.alphaNotice?.enabled ?? true) {
    text += `[ALPHA] ${draft.alphaNotice?.text?.trim() || DEFAULT_ALPHA_NOTICE_TEXT}\n\n`;
  }

  text += `${draft.intro}\n\n`;

  for (const section of draft.sections) {
    text += `${"─".repeat(40)}\n`;
    text += `${section.title}\n`;
    text += `${"─".repeat(40)}\n\n`;

    for (const item of section.items) {
      text += `• ${item.title}\n`;
      // Indent each line so multi-line summaries (incl. bullet lists) stay aligned.
      const summaryLines = item.summary
        .split("\n")
        .map((line) => `  ${line.trim()}`)
        .join("\n");
      text += `${summaryLines}\n`;
      if (item.url) {
        text += `  → ${item.url}\n`;
      }
      text += "\n";
    }
  }

  text += `${"─".repeat(40)}\n`;
  text += `© ${new Date().getFullYear()} START Munich\n`;
  text += `To unsubscribe from this newsletter, update your preferences in the member platform profile settings:\n`;
  text += `https://my.startmunich.de/dashboard/user/settings/profile\n`;

  return text;
}

export function extractSubjectLine(draft: NewsletterDraft): string {
  return `START Munich Newsletter ${draft.month}`;
}
