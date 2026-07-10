const DEFAULT_LIST_ID = 252;

interface CreateCampaignParams {
  subject: string;
  preheader: string;
  htmlContent: string;
  textContent: string;
  apiKey: string;
  listId?: number;
}

interface SyncBatchListParams {
  listId: number;
  emails: string[];
  apiKey: string;
}

interface SendTestEmailParams {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  apiKey: string;
}

export async function createAndSendCampaign(
  params: CreateCampaignParams
): Promise<number> {
  const { subject, preheader, htmlContent, textContent, apiKey, listId } = params;

  const campaignBody = {
    name: `START Newsletter - ${new Date().toISOString().slice(0, 10)}`,
    subject,
    previewText: preheader,
    sender: {
      name: "START Munich Newsletter",
      email: "community@mail.startmunich.de",
    },
    replyTo: "community@mail.startmunich.de",
    recipients: { listIds: [listId ?? DEFAULT_LIST_ID] },
    htmlContent,
    textContent,
    tag: "start-newsletter",
  };

  const createResponse = await fetch("https://api.brevo.com/v3/emailCampaigns", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(campaignBody),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Brevo campaign creation failed: ${createResponse.status} ${errorText}`);
  }

  const campaignData = await createResponse.json();
  const campaignId = campaignData.id as number;

  const sendResponse = await fetch(
    `https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
    }
  );

  if (!sendResponse.ok) {
    const errorText = await sendResponse.text();
    throw new Error(`Brevo campaign send failed: ${sendResponse.status} ${errorText}`);
  }

  return campaignId;
}

export async function sendTestEmail(params: SendTestEmailParams): Promise<void> {
  const { to, subject, htmlContent, textContent, apiKey } = params;

  const emailBody = {
    sender: {
      name: "START Munich Newsletter",
      email: "community@mail.startmunich.de",
    },
    to: [{ email: to }],
    subject: `[TEST] ${subject}`,
    htmlContent,
    textContent,
    replyTo: { email: "community@mail.startmunich.de" },
    tags: ["start-newsletter-test"],
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(emailBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo test email failed: ${response.status} ${errorText}`);
  }
}

/**
 * Replace the contents of a Brevo list with exactly the given emails, so a
 * subsequent campaign to that list reaches only those recipients:
 *   1. empty the list,
 *   2. upsert each contact (they must exist before they can be added),
 *   3. add the emails to the list.
 * Batch sizes here are well under Brevo's 150-email add limit.
 */
export async function syncBatchList(params: SyncBatchListParams): Promise<void> {
  const { listId, emails, apiKey } = params;

  const headers = {
    "Content-Type": "application/json",
    "api-key": apiKey,
    accept: "application/json",
  };

  // 1. Empty the list (replace semantics). Brevo processes this asynchronously.
  const removeResponse = await fetch(
    `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ all: true }),
    }
  );

  // 204 (nothing to remove) is fine; only real failures should throw.
  if (!removeResponse.ok && removeResponse.status !== 204) {
    const errorText = await removeResponse.text();
    throw new Error(
      `Brevo list empty failed: ${removeResponse.status} ${errorText}`
    );
  }

  // 2. Upsert each contact. A 400 "contact already exists" is expected and safe
  //    to ignore; updateEnabled also makes re-adds idempotent.
  for (const email of emails) {
    const createResponse = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, updateEnabled: true }),
    });

    if (!createResponse.ok && createResponse.status !== 400) {
      const errorText = await createResponse.text();
      throw new Error(
        `Brevo contact upsert failed for ${email}: ${createResponse.status} ${errorText}`
      );
    }
  }

  // 3. Add the emails to the list.
  const addResponse = await fetch(
    `https://api.brevo.com/v3/contacts/lists/${listId}/contacts/add`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ emails }),
    }
  );

  if (!addResponse.ok) {
    const errorText = await addResponse.text();
    throw new Error(
      `Brevo add to list failed: ${addResponse.status} ${errorText}`
    );
  }
}
