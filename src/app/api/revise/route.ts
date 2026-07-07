import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { reviseDraft } from "@/lib/openai-client";
import { renderNewsletterHtml, renderNewsletterText, extractSubjectLine } from "@/lib/renderer";
import { PreviewState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, feedback } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    if (!feedback || typeof feedback !== "string" || feedback.trim().length === 0) {
      return NextResponse.json({ error: "feedback is required" }, { status: 400 });
    }

    const preview = store.getPreview(key);
    if (!preview) {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    if (!openAiApiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    const revisedDraft = await reviseDraft(preview.structured, feedback.trim(), openAiApiKey);
    const html = renderNewsletterHtml(revisedDraft);
    const text = renderNewsletterText(revisedDraft);
    const subject = extractSubjectLine(revisedDraft);

    const newKey = `preview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newPreview: PreviewState = {
      key: newKey,
      html,
      text,
      subject,
      preheader: revisedDraft.preheader,
      structured: revisedDraft,
      approvalVersion: preview.approvalVersion + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "reviewing",
    };

    store.storePreview(newKey, newPreview);

    return NextResponse.json({ newKey });
  } catch (error) {
    console.error("Revise error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revise draft" },
      { status: 500 }
    );
  }
}
