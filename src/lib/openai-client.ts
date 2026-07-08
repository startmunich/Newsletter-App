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
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: "application/pdf" });
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
  // Build user message content with text and file references
  const userContent: Array<{ type: string; text?: string; file?: { file_id: string } }> = [
    { type: "text", text: userPrompt },
  ];

  // Add file references to the message
  for (const fileId of fileIds) {
    userContent.push({ type: "file", file: { file_id: fileId } });
  }

  const requestBody = {
    model: "gpt-5.5",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "newsletter_draft",
        schema: NEWSLETTER_JSON_SCHEMA,
        strict: true,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API failed: ${response.status} ${errorText}`);
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
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "newsletter_draft",
        schema: NEWSLETTER_JSON_SCHEMA,
        strict: true,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API failed: ${response.status} ${errorText}`);
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
    messages: [
      { role: "system", content: REVISE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "newsletter_draft",
        schema: NEWSLETTER_JSON_SCHEMA,
        strict: true,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
    messages: [
      { role: "system", content: QA_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Review and fix this newsletter JSON:\n\n${JSON.stringify(draft, null, 2)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "newsletter_draft",
        schema: NEWSLETTER_JSON_SCHEMA,
        strict: true,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
    model: "gpt-4o",
    messages: [
      { role: "system", content: MEME_PROMPT_SYSTEM },
      { role: "user", content: buildMemePromptUser(internalNewsItems) },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
    if (!apiKey) {
      console.error("generateMemeImage: No API key provided!");
      return null;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout (gpt-image-2 can be slow)

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt,
        size: "1024x1024",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`generateMemeImage: API failed with status ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    const firstImage = data.data?.[0];
    if (!firstImage) {
      console.error("generateMemeImage: No image data in response");
      return null;
    }

    if (typeof firstImage.b64_json === "string" && firstImage.b64_json.length > 0) {
      return firstImage.b64_json;
    }

    // Some models return image URLs instead of inline base64 data.
    const imageUrl = firstImage.url;
    if (!imageUrl) {
      console.error("generateMemeImage: No image URL or b64_json in response");
      return null;
    }
    const imgRes = await fetch(imageUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const imageBase64 = Buffer.from(imgBuffer).toString("base64");

    return imageBase64;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("generateMemeImage: Request timeout after 180 seconds");
    } else if (error instanceof Error) {
      console.error("generateMemeImage: Fetch error:", error.name, error.message);
    } else {
      console.error("generateMemeImage: Fetch error:", error);
    }
    return null;
  }
}

export async function generateMultipleImages(
  prompts: { meme: string; visual1: string; visual2: string },
  apiKey: string
): Promise<Array<{ prompt: string; imageBase64: string | null; type: "meme" | "normal" }>> {
  const results: Array<{ prompt: string; imageBase64: string | null; type: "meme" | "normal" }> = [];

  try {
    // Generate meme image
    const memeImage = await generateMemeImage(prompts.meme, apiKey);
    results.push({
      prompt: prompts.meme,
      imageBase64: memeImage,
      type: "meme",
    });

    // Generate first visual image
    const visual1Image = await generateMemeImage(prompts.visual1, apiKey);
    results.push({
      prompt: prompts.visual1,
      imageBase64: visual1Image,
      type: "normal",
    });

    // Generate second visual image
    const visual2Image = await generateMemeImage(prompts.visual2, apiKey);
    results.push({
      prompt: prompts.visual2,
      imageBase64: visual2Image,
      type: "normal",
    });
  } catch (error) {
    console.error("Multi-image generation error:", error);
  }

  return results;
}

export function buildDefaultCoverPrompt(context: {
  month: string;
  subject: string;
  intro: string;
  internalNewsItems?: Array<{ title: string; summary: string }>;
}): string[] {
  const items = context.internalNewsItems || [];
  const top = items[0];

  if (top) {
    return [
      `Real editorial cover photo for a startup newsletter. Focus on this key topic: "${top.title}". Context: ${top.summary}. Show one authentic moment with real people in a startup setting, no text overlays.`,
    ];
  }

  return [
    `Real editorial cover photo for a startup newsletter in ${context.month}. Subject: ${context.subject}. Intro context: ${context.intro}. Show one authentic moment with real people, no text overlays.`,
  ];
}

export async function generateCoverPromptFromDraftData(
  context: {
    month: string;
    subject: string;
    intro: string;
    sections: Array<{ title: string; items: Array<{ title: string; summary: string }> }>;
  },
  apiKey: string
): Promise<[string, string, string]> {
  const compactSections = context.sections
    .slice(0, 4)
    .map((section) => ({
      title: section.title,
      items: section.items.slice(0, 3).map((item) => ({ title: item.title, summary: item.summary })),
    }));

  const requestBody = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You write DALL-E image prompts for a newsletter cover. Pick the single most important story from the input and create 3 prompt variants. Each prompt must end with: 'This image is for the START Munich newsletter — a Munich-based student club for startups and aspiring entrepreneurs.' Return ONLY valid JSON with keys: meme, photo, creative.",
      },
      {
        role: "user",
        content: `Create 3 cover image prompts based on this newsletter data:\n\n${JSON.stringify(
          {
            month: context.month,
            subject: context.subject,
            intro: context.intro,
            sections: compactSections,
          },
          null,
          2
        )}\n\nReturn JSON with exactly these 3 keys:\n- meme: funny, relatable startup humor scene based on the key story (candid photo style, no text)\n- photo: authentic documentary-style editorial photo of the key story (real people, real place, natural light, no text)\n- creative: unexpected artistic reinterpretation of the key story (surreal, conceptual, visually striking, no text)\n\nMax 60 words per prompt. No text overlays in any image.`,
      },
    ],
    response_format: { type: "json_object" },
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cover prompt generation failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(extractResponseText(data));
  return [
    String(parsed.meme || "").trim(),
    String(parsed.photo || "").trim(),
    String(parsed.creative || "").trim(),
  ];
}

export async function generateCoverImages(
  prompts: string[],
  apiKey: string,
  onImage?: (image: { prompt: string; imageBase64: string; index: number }) => void,
): Promise<Array<{ prompt: string; imageBase64: string }>> {
  const results: Array<{ prompt: string; imageBase64: string } | null> = new Array(prompts.length).fill(null);

  await Promise.all(
    prompts.map(async (prompt, i) => {
      const imageBase64 = await generateMemeImage(prompt, apiKey);
      if (imageBase64) {
        results[i] = { prompt, imageBase64 };
        onImage?.({ prompt, imageBase64, index: i });
      } else {
        console.warn(`Cover image ${i + 1}/${prompts.length} generation returned null`);
      }
    })
  );

  return results.filter((r): r is { prompt: string; imageBase64: string } => r !== null);
}

function extractResponseText(data: Record<string, unknown>): string {
  // Handle standard chat completions response format
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0] as Record<string, unknown>;
    const message = choice.message as Record<string, unknown>;
    if (typeof message?.content === "string") {
      return message.content;
    }
  }

  // Handle Responses API format (legacy)
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
