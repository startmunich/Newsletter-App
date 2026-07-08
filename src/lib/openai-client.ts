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
  // Build user message content with text and file references
  const userContent: Array<{ type: string; text?: string; file?: { file_id: string } }> = [
    { type: "text", text: userPrompt },
  ];

  // Add file references to the message
  for (const fileId of fileIds) {
    userContent.push({ type: "file", file: { file_id: fileId } });
  }

  const requestBody = {
    model: "gpt-4o",
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
    model: "gpt-4o",
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
    model: "gpt-4o",
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
    model: "gpt-4o",
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
    console.log("generateMemeImage: Starting image generation...");
    console.log("generateMemeImage: API key present:", !!apiKey, "length:", apiKey?.length || 0);
    
    if (!apiKey) {
      console.error("generateMemeImage: No API key provided!");
      return null;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    console.log("generateMemeImage: Sending request to OpenAI...");
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log("generateMemeImage: Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`generateMemeImage: API failed with status ${response.status}`);
      console.error(`generateMemeImage: Error response:`, errorText);
      return null;
    }

    const data = await response.json();
    console.log("generateMemeImage: API response received");
    
    // gpt-image-1 returns b64_json directly
    const imageBase64 = data.data?.[0]?.b64_json;
    if (!imageBase64) {
      console.error("generateMemeImage: No image data in response");
      return null;
    }

    console.log(`generateMemeImage: Image generated successfully, base64 length: ${imageBase64.length}`);
    return imageBase64;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("generateMemeImage: Request timeout after 60 seconds");
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
}): string {
  return `Professional tech newsletter cover illustration for START Munich (${context.month}). Modern, clean and vibrant design suitable for an email header. Theme: startups, innovation, technology and community. Abstract geometric shapes with subtle tech motifs. No text in the image.`;
}

export async function generateCoverImages(
  prompt: string,
  apiKey: string,
  onImage?: (image: { prompt: string; imageBase64: string; index: number }) => void,
  count = 3
): Promise<Array<{ prompt: string; imageBase64: string }>> {
  const results: Array<{ prompt: string; imageBase64: string }> = [];

  console.log(`Starting cover image generation for ${count} images...`);

  try {
    for (let i = 0; i < count; i++) {
      console.log(`Generating cover image ${i + 1}/${count}...`);
      const imageBase64 = await generateMemeImage(prompt, apiKey);
      if (imageBase64) {
        console.log(`Cover image ${i + 1}/${count} generated successfully`);
        results.push({ prompt, imageBase64 });
        onImage?.({ prompt, imageBase64, index: i });
      } else {
        console.warn(`Cover image ${i + 1}/${count} generation returned null`);
      }

      // Small delay between requests to avoid rate limiting (except after last image)
      if (i < count - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error("Cover image generation error:", error);
  }

  console.log(`Cover image generation complete: ${results.length}/${count} images generated`);
  return results;
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
