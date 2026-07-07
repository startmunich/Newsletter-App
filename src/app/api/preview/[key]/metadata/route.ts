import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

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

  return NextResponse.json({
    key: preview.key,
    subject: preview.subject,
    preheader: preview.preheader,
    structured: preview.structured,
    approvalVersion: preview.approvalVersion,
    createdAt: preview.createdAt,
    updatedAt: preview.updatedAt,
    status: preview.status,
    sentAt: preview.sentAt,
    brevoCampaignId: preview.brevoCampaignId,
    testEmailSentAt: preview.testEmailSentAt,
    testEmailTo: preview.testEmailTo,
  });
}
