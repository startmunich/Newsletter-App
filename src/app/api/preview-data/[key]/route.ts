import { store } from "@/lib/store";
import { NextRequest, NextResponse } from "next/server";
import { NewsletterDraft } from "@/lib/types";
import { renderNewsletterHtml, renderNewsletterText } from "@/lib/renderer";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const preview = await store.getPreview(key);

  if (!preview) {
    return NextResponse.json({ error: "Preview not found" }, { status: 404 });
  }

  await store.deletePreview(key);
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const preview = await store.getPreview(key);

  if (!preview) {
    return NextResponse.json({ error: "Preview not found" }, { status: 404 });
  }

  const { name } = await request.json() as { name?: string };

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  await store.updatePreview(key, { name: name.trim() });
  return NextResponse.json({ success: true });
}

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const preview = await store.getPreview(key);

  if (!preview) {
    return NextResponse.json({ error: "Preview not found" }, { status: 404 });
  }

  return NextResponse.json(preview);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const preview = await store.getPreview(key);

  if (!preview) {
    return NextResponse.json({ error: "Preview not found" }, { status: 404 });
  }

  try {
    const body = await request.json() as Partial<NewsletterDraft>;

    // Update the structured newsletter data
    preview.structured = {
      ...preview.structured,
      ...body,
    };

    // Re-render HTML and text so the preview reflects the changes (e.g. selected cover image)
    preview.html = renderNewsletterHtml(preview.structured);
    preview.text = renderNewsletterText(preview.structured);

    preview.updatedAt = new Date();
    await store.storePreview(key, preview);

    return NextResponse.json(preview);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }
}
