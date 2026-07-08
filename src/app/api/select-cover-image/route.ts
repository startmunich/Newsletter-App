import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { renderNewsletterHtml, renderNewsletterText, extractSubjectLine } from "@/lib/renderer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { previewKey, imageIndex } = await request.json();

    if (!previewKey || typeof previewKey !== "string") {
      return NextResponse.json({ error: "previewKey is required" }, { status: 400 });
    }

    if (imageIndex === undefined || ![0, 1, 2].includes(imageIndex)) {
      return NextResponse.json({ error: "imageIndex must be 0, 1, or 2" }, { status: 400 });
    }

    const preview = await store.getPreview(previewKey);
    if (!preview) {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    // Update the selected cover image index
    preview.structured.selectedCoverImageIndex = imageIndex;

    // Re-render HTML and text with the selected image
    const html = renderNewsletterHtml(preview.structured);
    const text = renderNewsletterText(preview.structured);
    const subject = extractSubjectLine(preview.structured);

    // Update the preview with new HTML
    preview.html = html;
    preview.text = text;
    preview.subject = subject;
    preview.updatedAt = new Date();

    await store.storePreview(previewKey, preview);

    return NextResponse.json({
      success: true,
      previewKey,
      selectedImageIndex: imageIndex,
      message: "Cover image selected successfully",
    });
  } catch (error) {
    console.error("Select cover image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
