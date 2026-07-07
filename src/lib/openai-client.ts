import { NewsletterDraft } from "./types";
import {
  DRAFT_SYSTEM_PROMPT,
  QA_SYSTEM_PROMPT,
  REVISE_SYSTEM_PROMPT,
  buildReviseUserPrompt,
  MEME_PROMPT_SYSTEM,
  buildMemePromptUser,
  NEWSLETTER_JSON_SCHEMA,
} from "./prompts";

export async function uploadPdfToOpenAI(
  fileBuffer: Buffer,
  filename: string,
  apiKey: string
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "application/pdf" });
  formData.append("file", blob, filename);
  formData.append("purpose", "user_data");

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI file upload failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.id;
}

export async function generateDraftWithFiles(
  systemPrompt: string,
  userPrompt: string,
  fileIds: string[],
  apiKey: string
): Promise<NewsletterDraft> {
  const userContent: Array<{ type: string; text?: string; file_id?: string }> = [
    { type: "text", text: userPrompt },
  ];

  for (const fileId of fileIds) {
    userContent.push({ type: "input_file", file_id: fileId });
  }

  const requestBody = {
    model: "gpt-5.5",
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "newsletter_draft",
        schema: NEWSLETTER_JSON_SCHEMA,
        strict: true,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Responses API failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = extractResponseText(data);
  return JSON.parse(text) as NewsletterDraft;
}

export async function generateDraftText(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<NewsletterDraft> {
  const requestBody = {
    model: "gpt-5.5",
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "newsletter_draft",
        schema: NEWSLETTER_JSON_SCHEMA,
        strict: true,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Responses API failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = extractResponseText(data);
  return JSON.parse(text) as NewsletterDraft;
}

export async function reviseDraft(
  originalDraft: NewsletterDraft,
  feedback: string,
  apiKey: string
): Promise<NewsletterDraft> {
  const userPrompt = buildReviseUserPrompt(originalDraft, feedback);

  const requestBody = {
    model: "gpt-5.5",
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: REVISE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "newsletter_draft",
        schema: NEWSLETTER_JSON_SCHEMA,
        strict: true,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI revision failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = extractResponseText(data);
  return JSON.parse(text) as NewsletterDraft;
}

export async function runQaPass(
  draft: NewsletterDraft,
  apiKey: string
): Promise<NewsletterDraft> {
  const requestBody = {
    model: "gpt-5.5",
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: QA_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Review and fix this newsletter JSON:\n\n${JSON.stringify(draft, null, 2)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "newsletter_draft",
        schema: NEWSLETTER_JSON_SCHEMA,
        strict: true,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI QA pass failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = extractResponseText(data);
  return JSON.parse(text) as NewsletterDraft;
}

export async function generateMemePrompt(
  internalNewsItems: Array<{ title: string; summary: string }>,
  apiKey: string
): Promise<string> {
  const requestBody = {
    model: "gpt-5.5",
    input: [
      { role: "system", content: MEME_PROMPT_SYSTEM },
      { role: "user", content: buildMemePromptUser(internalNewsItems) },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Meme prompt generation failed: ${response.status}`);
  }

  const data = await response.json();
  return extractResponseText(data);
}

export async function generateMemeImage(
  prompt: string,
  apiKey: string
): Promise<string | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1.5",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "medium",
        output_format: "png",
      }),
    });

    if (!response.ok) {
      console.error(`Meme image generation failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.b64_json || null;
  } catch (error) {
    console.error("Meme image generation error:", error);
    return null;
  }
}

function extractResponseText(data: Record<string, unknown>): string {
  if (data.output_text && typeof data.output_text === "string") {
    return data.output_text;
  }

  const output = data.output as Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;

  if (Array.isArray(output)) {
    for (const item of output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === "output_text" && block.text) {
            return block.text;
          }
        }
      }
    }
  }

  throw new Error("Could not extract text from OpenAI response");
}
