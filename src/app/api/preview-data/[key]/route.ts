import { store } from "@/lib/store";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const preview = store.getPreview(key);

  if (!preview) {
    return NextResponse.json({ error: "Preview not found" }, { status: 404 });
  }

  return NextResponse.json(preview);
}
