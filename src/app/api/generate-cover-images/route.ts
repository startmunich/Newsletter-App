import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import {
  generateCoverImages,
  buildDefaultCoverPrompt,
  generateCoverPromptFromDraftData,
} from "@/lib/openai-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET: return the default prompt for a preview so the user can view/edit it
export async function GET(request: NextRequest) {
  const previewKey = request.nextUrl.searchParams.get("previewKey");

  if (!previewKey) {
    return NextResponse.json({ error: "previewKey is required" }, { status: 400 });
  }

  const preview = await store.getPreview(previewKey);
  if (!preview) {
    return NextResponse.json({ error: "Preview not found" }, { status: 404 });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;

  try {
    if (openAiApiKey) {
      const aiPrompt = await generateCoverPromptFromDraftData(
        {
          month: preview.structured.month || preview.monthGenerated || "",
          subject: preview.structured.subject || "",
          intro: preview.structured.intro || "",
          sections: preview.structured.sections || [],
        },
        openAiApiKey
      );
      return NextResponse.json({ defaultPrompt: aiPrompt });
    }
  } catch (error) {
    console.error("GET cover prompt AI generation failed, falling back:", error);
  }

  const fallbackPrompt = buildDefaultCoverPrompt({
    month: preview.structured.month || preview.monthGenerated || "",
    subject: preview.structured.subject || "",
    intro: preview.structured.intro || "",
    internalNewsItems: [],
  })[0];

  return NextResponse.json({ defaultPrompt: fallbackPrompt });
}

// POST: start a background cover image generation job, return jobId immediately
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { previewKey, prompt } = body;

    if (!previewKey || typeof previewKey !== "string") {
      return NextResponse.json({ error: "previewKey is required" }, { status: 400 });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      return NextResponse.json({ error: "Missing OpenAI API key" }, { status: 500 });
    }

    const preview = await store.getPreview(previewKey);
    if (!preview) {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    const effectivePrompt: string[] =
      typeof prompt === "string" && prompt.trim().length > 0
        ? [prompt.trim()]
          : await generateCoverPromptFromDraftData(
              {
                month: preview.structured.month || preview.monthGenerated || "",
                subject: preview.structured.subject || "",
                intro: preview.structured.intro || "",
                sections: preview.structured.sections || [],
              },
              openAiApiKey
            );

    const jobId = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    store.createCoverImageJob(jobId, previewKey, effectivePrompt[0]);
    store.updateCoverImageJob(jobId, { status: "running" });

    // Fire and forget: generate images in the background, storing progress on the job
    (async () => {
      try {
        const images = await generateCoverImages(
          effectivePrompt,
          openAiApiKey,
          (image) => {
            store.addCoverImageToJob(jobId, {
              prompt: image.prompt,
              imageBase64: image.imageBase64,
              index: image.index,
            });
          }
        );

        // Persist the generated images onto the preview so selection can reference them
        const currentPreview = await store.getPreview(previewKey);
        if (currentPreview) {
          currentPreview.structured.coverImages = images.map((img, index) => ({
            prompt: img.prompt,
            imageBase64: img.imageBase64,
            index,
          }));
          currentPreview.updatedAt = new Date();
          await store.storePreview(previewKey, currentPreview);
        }

        store.updateCoverImageJob(jobId, {
          status: images.length > 0 ? "done" : "error",
          error: images.length > 0 ? undefined : "No images were generated",
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Background cover image generation failed:", msg);
        store.updateCoverImageJob(jobId, { status: "error", error: msg });
      }
    })();

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Cover image generation error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
