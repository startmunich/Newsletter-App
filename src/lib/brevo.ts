interface CreateCampaignParams {
  subject: string;
  preheader: string;
  htmlContent: string;
  textContent: string;
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
  const { subject, preheader, htmlContent, textContent, apiKey } = params;

  const campaignBody = {
    name: `START Newsletter - ${new Date().toISOString().slice(0, 10)}`,
    subject,
    previewText: preheader,
    sender: {
      name: "START Munich Newsletter",
      email: "community@mail.startmunich.de",
    },
    replyTo: "community@mail.startmunich.de",
    recipients: { listIds: [252] },
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
