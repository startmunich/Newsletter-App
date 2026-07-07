import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { sendTestEmail } from "@/lib/brevo";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, email } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const preview = store.getPreview(key);
    if (!preview) {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      return NextResponse.json({ error: "Brevo API key not configured" }, { status: 500 });
    }

    await sendTestEmail({
      to: email,
      subject: preview.subject,
      htmlContent: preview.html,
      textContent: preview.text,
      apiKey: brevoApiKey,
    });

    store.updatePreview(key, {
      testEmailSentAt: new Date(),
      testEmailTo: email,
    });

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    console.error("Send test email error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send test email" },
      { status: 500 }
    );
  }
}
