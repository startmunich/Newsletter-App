import { NewsletterDraft } from "./types";

export const DRAFT_SYSTEM_PROMPT = `You draft START Munich monthly community newsletters from monthly recaps, attached PDFs, and Luma event data. Output strict JSON only matching the provided schema. Use only source-grounded facts. Never invent items, metrics, quotes, or filler. If a source-backed topic is important but ambiguous enough that publishing it would require guessing, set clarificationNeeded to true and write one concise clarificationQuestion. Do not ask about non-blocking details. Never include sensitive financial data. Public-facing ticket prices are allowed, but omit internal revenue, profit, budget, sponsorship amounts, cash balances, runway, costs, margins.`;

export function buildDraftUserPrompt(params: {
  sourceText: string;
  meetingTranscript: string;
  pdfTitles: string[];
  lumaContext: string;
  month: string;
  previousMonth: string;
}): string {
  const { sourceText, meetingTranscript, pdfTitles, lumaContext, month, previousMonth } = params;

  let prompt = `Generate the START Munich monthly newsletter for ${month}.

=== SOURCE TEXT (monthly recap) ===
${sourceText || "(none provided)"}
`;

  if (meetingTranscript) {
    prompt += `
=== MEETING TRANSCRIPT ===
${meetingTranscript}
`;
  }

  if (pdfTitles.length > 0) {
    prompt += `
=== ATTACHED PDFs ===
The following PDF files have been uploaded and are available as context:
${pdfTitles.map((t) => `- ${t}`).join("\n")}
Extract relevant newsletter-worthy information from these PDFs.
`;
  }

  prompt += `
${lumaContext}

=== INSTRUCTIONS ===
Create a newsletter with exactly 5 sections in this order:
1. "Internal News" — Key updates from the source text/PDFs/meeting transcript. Max 5 items. Text-only (no imageUrl, no url). Each item needs a title and summary.
2. "Upcoming Events - Internal" — From Luma internal calendar upcoming events.
3. "Upcoming Events - External" — From Luma external calendar upcoming events.
4. "Last Month Internal Events" — Internal events from ${previousMonth} (last month).
5. "Last Month External Events" — External events from ${previousMonth} (last month).

For event items (sections 2-5):
- Use the event name as title
- Write a 1-2 sentence summary from the event description
- Use the Luma event URL as the url field
- Use a relevant tag (e.g., "Workshop", "Social", "Networking", "Panel", "Hackathon")
- If an Image URL is provided in the event data, use it for imageUrl and the event name for imageAlt
- If no Image URL is provided, leave imageUrl and imageAlt empty

For the subject line: Make it catchy and relevant to the month's highlights.
For the preheader: A short teaser sentence (max 100 chars).
For the intro: 2-3 sentences welcoming readers and previewing highlights.

Remember: Only use facts from the provided sources. Never invent information.`;

  return prompt;
}

export const QA_SYSTEM_PROMPT = `You are a final QA reviewer for the START Munich newsletter JSON. Your job is to fix any issues while preserving all factual content. Rules:
1. Sections MUST be in this exact order: "Internal News", "Upcoming Events - Internal", "Upcoming Events - External", "Last Month Internal Events", "Last Month External Events"
2. Remove any metric cards or numerical highlight boxes — this is a text newsletter
3. "Internal News" items must have empty strings for imageUrl and url fields (text-only section)
4. Max 5 items in "Internal News"
5. Preserve Luma event descriptions faithfully — do not rewrite them
6. No invented facts, metrics, quotes, or URLs
7. Ensure all required fields are present and valid
8. Keep the subject line catchy and under 80 characters
9. Preheader must be under 100 characters
Output the corrected JSON matching the same schema.`;

export const REVISE_SYSTEM_PROMPT = `You are revising a START Munich newsletter draft based on editor feedback. Rules:
1. Apply the requested changes faithfully
2. Preserve all facts from the original that aren't contradicted by the feedback
3. Maintain the same 5-section structure and order
4. Keep "Internal News" text-only (no imageUrl, no url)
5. Do not invent new information — only restructure, rewrite, or remove existing content
6. Output strict JSON matching the same schema`;

export function buildReviseUserPrompt(
  originalDraft: NewsletterDraft,
  feedback: string
): string {
  return `Here is the current newsletter draft:

\`\`\`json
${JSON.stringify(originalDraft, null, 2)}
\`\`\`

=== EDITOR FEEDBACK ===
${feedback}

Please revise the newsletter according to the feedback above. Output the full revised JSON.`;
}

export const MEME_PROMPT_SYSTEM = `You generate DALL-E image prompts for newsletter memes. The image must look like a real photograph or candid scene, NOT digital art or illustration. Think relatable startup humor captured in a real-world photo style: office situations, reaction shots, everyday scenes with funny captions implied by context. Output only the DALL-E prompt text, nothing else.`;

export const VISUAL_PROMPT_SYSTEM = `You generate DALL-E image prompts for newsletter visuals. Images must look like real photographs — candid office moments, team photos, event scenes, product shots. NOT illustrations, NOT digital art, NOT infographics. Style: natural lighting, real people, real places. Output only the DALL-E prompt text, nothing else.`;

export function buildMemePromptUser(internalNewsItems: Array<{ title: string; summary: string }>): string {
  const topItem = internalNewsItems[0];
  if (!topItem) return "Create a generic startup community newsletter meme illustration.";

  return `The most notable internal news this month is: "${topItem.title}" — ${topItem.summary}

Generate a creative, funny image prompt for a meme illustration about this news. The style should be a clean, modern cartoon/illustration suitable for a professional community newsletter.`;
}

export function buildMultipleImagePrompts(
  internalNewsItems: Array<{ title: string; summary: string }>
): { meme: string; visual1: string; visual2: string } {
  const topItem = internalNewsItems[0];
  if (!topItem) {
    return {
      meme: "Create a generic startup community newsletter meme illustration.",
      visual1: "Create a professional illustration of a diverse team collaborating and innovating.",
      visual2: "Create an abstract professional image representing growth, community, and technology.",
    };
  }

  const secondItem = internalNewsItems[1] || topItem;

  return {
    meme: `Relatable startup meme photo about: "${topItem.title}". ${topItem.summary}. Real photo style, candid office moment, funny situational humor. Natural lighting, realistic scene, like a photo someone took at work. No text overlays, no illustrations, no digital art.`,
    visual1: `Real photograph: ${topItem.summary}. Scene related to "${topItem.title}". Candid, natural lighting, real people in a professional setting. Photo journalism style, not staged or artistic.`,
    visual2: `Real photograph: ${secondItem.summary}. Scene related to "${secondItem.title}". Candid moment, natural environment, realistic and grounded. No filters, no artistic effects, no illustrations.`,
  };
}

export const NEWSLETTER_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    month: { type: "string" as const },
    subject: { type: "string" as const },
    draftSubject: { type: "string" as const },
    preheader: { type: "string" as const },
    intro: { type: "string" as const },
    clarificationNeeded: { type: "boolean" as const },
    clarificationQuestion: { type: "string" as const },
    sections: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          items: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                title: { type: "string" as const },
                summary: { type: "string" as const },
                tag: { type: "string" as const },
                url: { type: "string" as const },
                imageUrl: { type: "string" as const },
                imageAlt: { type: "string" as const },
              },
              required: ["title", "summary", "tag", "url", "imageUrl", "imageAlt"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "items"],
        additionalProperties: false,
      },
    },
    internalNewsMeme: {
      type: "object" as const,
      properties: {
        enabled: { type: "boolean" as const },
        images: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              prompt: { type: "string" as const },
              imageBase64: { type: "string" as const },
              type: { 
                type: "string" as const,
                enum: ["meme", "normal"] as const,
              },
            },
            required: ["prompt", "imageBase64", "type"],
            additionalProperties: false,
          },
        },
        error: { type: "string" as const },
      },
      required: ["enabled", "images", "error"],
      additionalProperties: false,
    },
  },
  required: [
    "month",
    "subject",
    "draftSubject",
    "preheader",
    "intro",
    "clarificationNeeded",
    "clarificationQuestion",
    "sections",
    "internalNewsMeme",
  ],
  additionalProperties: false,
};
