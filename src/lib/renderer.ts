import { NewsletterDraft, NewsletterSection, NewsletterItem } from "./types";

const NAVY = "#00002C";
const MAGENTA = "#D0006F";
const WHITE = "#ffffff";
const LIGHT_GRAY = "#f5f5f5";
const BORDER_GRAY = "#e0e0e0";

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

function renderInternalNewsItem(item: NewsletterItem): string {
  return `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid ${BORDER_GRAY};">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: ${NAVY};">${escapeHtml(item.title)}</h3>
        <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #333333;">${escapeHtml(item.summary)}</p>
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

  const textCell = `
    <td valign="top" style="padding-left: ${item.imageUrl ? "16px" : "0"};">
      ${titleElement}
      <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #444444;">${escapeHtml(item.summary)}</p>
      ${ctaButton}
    </td>`;

  const imageCell = item.imageUrl
    ? `<td width="160" valign="top" style="padding-right: 0;">
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt || item.title)}" width="160" style="width: 160px; height: 160px; object-fit: cover; border-radius: 8px; display: block;" />
      </td>`
    : "";

  return `
    <tr>
      <td style="padding: 20px 0; border-bottom: 1px solid ${BORDER_GRAY};">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            ${imageCell}
            ${textCell}
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderSection(section: NewsletterSection): string {
  const normalizedTitle = normalizeSectionTitle(section.title);
  const isInternalNews = normalizedTitle === "Internal News";
  const isPastEventSection = normalizedTitle.toLowerCase().includes("last month");

  if (section.items.length === 0) return "";

  const itemsHtml = section.items
    .map((item) => {
      if (isInternalNews) {
        return renderInternalNewsItem(item);
      } else {
        return renderEventItem(item, isPastEventSection);
      }
    })
    .join("");

  return `
    <tr>
      <td style="padding: 32px 20px 0 20px;">
        <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: ${NAVY}; border-bottom: 3px solid ${MAGENTA}; padding-bottom: 8px;">${escapeHtml(section.title)}</h2>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          ${itemsHtml}
        </table>
      </td>
    </tr>`;
}

export function renderNewsletterHtml(draft: NewsletterDraft): string {
  const sectionsHtml = draft.sections.map(renderSection).join("");

  // Render selected cover image if available
  const coverImageHtml =
    draft.coverImages && draft.coverImages.length > 0 && draft.selectedCoverImageIndex !== undefined
      ? (() => {
          const selectedImage = draft.coverImages[draft.selectedCoverImageIndex];
          if (selectedImage && selectedImage.imageBase64) {
            return `
    <tr>
      <td style="padding: 24px 20px 0 20px; text-align: center;">
        <img src="data:image/png;base64,${selectedImage.imageBase64}" alt="Newsletter cover" width="280" style="max-width: 280px; width: 50%; height: auto; border-radius: 12px; margin: 0 auto; display: block;" />
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
</head>
<body style="margin: 0; padding: 0; background-color: ${LIGHT_GRAY}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preheader -->
  <span style="display: none; font-size: 0; line-height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; color: transparent;">${escapeHtml(draft.preheader)}</span>

  <!-- Wrapper -->
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${LIGHT_GRAY};">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <!-- Main container -->
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: ${WHITE}; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background-color: ${NAVY}; padding: 32px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${WHITE}; letter-spacing: -0.5px;">START Munich</h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: ${MAGENTA}; font-weight: 500;">Monthly Newsletter &bull; ${escapeHtml(draft.month)}</p>
            </td>
          </tr>

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
                <a href="{{unsubscribe}}" style="color: ${MAGENTA}; text-decoration: underline;">Unsubscribe</a>
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
  text += `${draft.intro}\n\n`;

  for (const section of draft.sections) {
    text += `${"─".repeat(40)}\n`;
    text += `${section.title}\n`;
    text += `${"─".repeat(40)}\n\n`;

    for (const item of section.items) {
      text += `• ${item.title}\n`;
      text += `  ${item.summary}\n`;
      if (item.url) {
        text += `  → ${item.url}\n`;
      }
      text += "\n";
    }
  }

  text += `${"─".repeat(40)}\n`;
  text += `© ${new Date().getFullYear()} START Munich\n`;
  text += `Unsubscribe: {{unsubscribe}}\n`;

  return text;
}

export function extractSubjectLine(draft: NewsletterDraft): string {
  return draft.subject || draft.draftSubject || `START Munich Newsletter - ${draft.month}`;
}
