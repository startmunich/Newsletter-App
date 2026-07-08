import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { renderNewsletterHtml, renderNewsletterText, extractSubjectLine } from "@/lib/renderer";
import { NewsletterDraft } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const preview = await store.getPreview(key);

  if (!preview) {
    return NextResponse.json({ error: "Preview not found" }, { status: 404 });
  }

  try {
    const body = await request.json();

    if (body.draft) {
      const draft = body.draft as NewsletterDraft;
      const html = renderNewsletterHtml(draft);
      const text = renderNewsletterText(draft);
      const subject = extractSubjectLine(draft);

      await store.updatePreview(key, {
        html,
        text,
        subject,
        preheader: draft.preheader,
        structured: draft,
      });

      return NextResponse.json({ ok: true });
    }

    if (body.html) {
      if (typeof body.html !== "string" || !body.html.includes("<") || !body.html.includes(">")) {
        return NextResponse.json({ error: "Invalid HTML content" }, { status: 400 });
      }
      await store.updatePreview(key, { html: body.html });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Must provide draft or html" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
