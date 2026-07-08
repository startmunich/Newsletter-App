import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const preview = await store.getPreview(key);

  if (!preview) {
    return new NextResponse("Preview not found", { status: 404 });
  }

  return new NextResponse(preview.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
