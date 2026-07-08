import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = store.getCoverImageJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    previewKey: job.previewKey,
    status: job.status,
    prompt: job.prompt,
    images: job.images,
    error: job.error,
  });
}
