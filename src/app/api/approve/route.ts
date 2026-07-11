import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createAndSendCampaign, syncBatchList } from "@/lib/brevo";
import { fetchMembersByBatches, deriveStartEmail } from "@/lib/membersPlatform";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, batches, force } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    // Intentional re-send (e.g. to a different batch) bypasses the
    // already-sent guard below. Defaults to false so accidental double-sends
    // are still prevented.
    const forceResend = force === true;

    // Optional: send to specific member batches (derived START emails) instead
    // of the default Brevo subscriber list.
    const batchList: string[] = Array.isArray(batches)
      ? batches.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
      : [];
    const useBatchSend = batchList.length > 0;

    const preview = await store.getPreview(key);
    if (!preview) {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    if (!preview.testEmailSentAt) {
      return NextResponse.json(
        { error: "You must send a test email before approving" },
        { status: 400 }
      );
    }

    if (preview.status === "sent" && !forceResend) {
      return NextResponse.json(
        {
          error: "This newsletter has already been sent",
          alreadySent: true,
        },
        { status: 409 }
      );
    }

    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      return NextResponse.json({ error: "Brevo API key not configured" }, { status: 500 });
    }

    let listId: number | undefined;
    let recipientEmails: string[] | undefined;

    if (useBatchSend) {
      const memplatApiKey = process.env.MEMPLAT_API;
      if (!memplatApiKey) {
        return NextResponse.json(
          { error: "Members platform API key not configured" },
          { status: 500 }
        );
      }

      const batchListId = Number(process.env.BREVO_BATCH_LIST_ID);
      if (!batchListId) {
        return NextResponse.json(
          { error: "Batch send list (BREVO_BATCH_LIST_ID) not configured" },
          { status: 500 }
        );
      }

      const members = await fetchMembersByBatches(batchList, memplatApiKey);
      const emails = [
        ...new Set(
          members
            .map((m) => deriveStartEmail(m.name))
            .filter((e): e is string => e !== null)
        ),
      ];

      if (emails.length === 0) {
        return NextResponse.json(
          { error: "No valid recipient emails could be derived for the selected batches" },
          { status: 400 }
        );
      }

      await syncBatchList({ listId: batchListId, emails, apiKey: brevoApiKey });
      listId = batchListId;
      recipientEmails = emails;
    }

    const campaignId = await createAndSendCampaign({
      subject: preview.subject,
      preheader: preview.preheader,
      htmlContent: preview.html,
      textContent: preview.text,
      apiKey: brevoApiKey,
      listId,
    });

    await store.updatePreview(key, {
      status: "sent",
      sentAt: new Date(),
      brevoCampaignId: campaignId,
      ...(recipientEmails
        ? {
            sentTo: recipientEmails,
            sentRecipientCount: recipientEmails.length,
            sentBatches: batchList,
          }
        : {}),
    });

    return NextResponse.json({
      ok: true,
      brevoCampaignId: campaignId,
      recipientCount: recipientEmails?.length,
    });
  } catch (error) {
    console.error("Approve error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send campaign" },
      { status: 500 }
    );
  }
}
