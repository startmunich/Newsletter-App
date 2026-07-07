import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createAndSendCampaign } from "@/lib/brevo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const preview = store.getPreview(key);
    if (!preview) {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    if (!preview.testEmailSentAt) {
      return NextResponse.json(
        { error: "You must send a test email before approving" },
        { status: 400 }
      );
    }

    if (preview.status === "sent") {
      return NextResponse.json(
        { error: "This newsletter has already been sent" },
        { status: 400 }
      );
    }

    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      return NextResponse.json({ error: "Brevo API key not configured" }, { status: 500 });
    }

    const campaignId = await createAndSendCampaign({
      subject: preview.subject,
      preheader: preview.preheader,
      htmlContent: preview.html,
      textContent: preview.text,
      apiKey: brevoApiKey,
    });

    store.updatePreview(key, {
      status: "sent",
      sentAt: new Date(),
      brevoCampaignId: campaignId,
    });

    return NextResponse.json({ ok: true, brevoCampaignId: campaignId });
  } catch (error) {
    console.error("Approve error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send campaign" },
      { status: 500 }
    );
  }
}
