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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "b64_json",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`generateMemeImage: API failed: ${response.status} ${errorText}`);
      return null;
    }

    const data = await response.json();
    const imageBase64 = data.data?.[0]?.b64_json || null;
    console.log(`generateMemeImage: Image generated successfully, base64 length: ${imageBase64?.length || 0}`);
    return imageBase64;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("generateMemeImage: Request timeout");
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

export async function generateCoverImages(
  newsletter: string,
  apiKey: string
): Promise<Array<{ prompt: string; imageBase64: string }>> {
  const results: Array<{ prompt: string; imageBase64: string }> = [];

  // Generate 3 different cover image prompts based on newsletter content
  const coverPrompts = [
    `Professional tech newsletter cover illustration for START Munich July 2026. Modern, clean design with tech elements, professional colors, suitable for email header. Abstract geometric shapes, tech icons, innovation theme.`,
    `Modern corporate newsletter cover for START Munich July 2026. Professional business illustration with networking theme, collaborative spirit, team dynamics. Contemporary design, vibrant colors, suitable as email banner.`,
    `Tech community newsletter cover for START Munich July 2026. Innovative and dynamic illustration showing people, technology, ideas converging. Modern aesthetic, inspiring design, suitable for email header.`,
  ];

  console.log("Starting cover image generation for 3 images...");

  try {
    for (let i = 0; i < coverPrompts.length; i++) {
      const prompt = coverPrompts[i];
      console.log(`Generating cover image ${i + 1}/3...`);
      const imageBase64 = await generateMemeImage(prompt, apiKey);
      if (imageBase64) {
        console.log(`Cover image ${i + 1}/3 generated successfully`);
        results.push({
          prompt,
          imageBase64,
        });
      } else {
        console.warn(`Cover image ${i + 1}/3 generation returned null`);
      }
      
      // Add a small delay between requests to avoid rate limiting (except after last image)
      if (i < coverPrompts.length - 1) {
        console.log("Waiting 2 seconds before next image...");
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (error) {
    console.error("Cover image generation error:", error);
  }

  console.log(`Cover image generation complete: ${results.length}/3 images generated`);
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
