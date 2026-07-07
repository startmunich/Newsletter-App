import { PipelineInput, PreviewState } from "./types";
import { store } from "./store";
import { fetchLumaEvents, buildLumaEventDigest } from "./luma";
import {
  uploadPdfToOpenAI,
  generateDraftWithFiles,
  generateDraftText,
  runQaPass,
  generateMemePrompt,
  generateMemeImage,
} from "./openai-client";
import { compressPdf } from "./nutrient";
import { DRAFT_SYSTEM_PROMPT, buildDraftUserPrompt } from "./prompts";
import { renderNewsletterHtml, renderNewsletterText, extractSubjectLine } from "./renderer";

const EXTERNAL_CALENDAR = "cal-1MxD65bgV0Hcb0r";
const INTERNAL_CALENDAR = "cal-uEAobzlyVj0mtrw";

function generateKey(): string {
  return `preview_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function runPipeline(jobId: string, input: PipelineInput): Promise<void> {
  const steps = [
    "Preparing",
    "Uploading PDFs",
    "Fetching Luma events",
    "Drafting newsletter",
    "QA review",
    "Generating meme",
    "Rendering HTML",
    "Saving preview",
  ];

  for (const step of steps) {
    store.updateStep(jobId, step, { status: "pending" });
  }
  store.updateJob(jobId, { status: "running" });

  try {
    // Step 1: Preparing
    store.updateStep(jobId, "Preparing", { status: "running" });
    const now = new Date();
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const futureWindowEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    const month = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const previousMonth = previousMonthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const previousMonthStart = previousMonthDate.toISOString();
    const previousMonthEndStr = previousMonthEnd.toISOString();
    const nowStr = now.toISOString();
    const futureStr = futureWindowEnd.toISOString();

    store.updateStep(jobId, "Preparing", { status: "done", message: `Month: ${month}` });

    // Step 2: Upload PDFs
    store.updateStep(jobId, "Uploading PDFs", { status: "running" });
    const fileIds: string[] = [];

    if (input.pdfFiles.length > 0) {
      for (const pdf of input.pdfFiles) {
        let buffer = pdf.buffer;
        if (input.nutrientApiKey) {
          buffer = await compressPdf(buffer, pdf.name, input.nutrientApiKey);
        }
        const fileId = await uploadPdfToOpenAI(buffer, pdf.name, input.openAiApiKey);
        fileIds.push(fileId);
      }
      store.updateStep(jobId, "Uploading PDFs", {
        status: "done",
        message: `${fileIds.length} file(s) uploaded`,
      });
    } else {
      store.updateStep(jobId, "Uploading PDFs", { status: "done", message: "No PDFs to upload" });
    }

    // Step 3: Fetch Luma events
    store.updateStep(jobId, "Fetching Luma events", { status: "running" });

    const [externalUpcoming, internalUpcoming, externalLastMonth, internalLastMonth] =
      await Promise.all([
        fetchLumaEvents(EXTERNAL_CALENDAR, nowStr, futureStr, input.lumaExternalKey),
        fetchLumaEvents(INTERNAL_CALENDAR, nowStr, futureStr, input.lumaInternalKey),
        fetchLumaEvents(EXTERNAL_CALENDAR, previousMonthStart, previousMonthEndStr, input.lumaExternalKey),
        fetchLumaEvents(INTERNAL_CALENDAR, previousMonthStart, previousMonthEndStr, input.lumaInternalKey),
      ]);

    const lumaDigest = buildLumaEventDigest(
      externalUpcoming,
      internalUpcoming,
      externalLastMonth,
      internalLastMonth
    );

    store.updateStep(jobId, "Fetching Luma events", {
      status: "done",
      message: `${externalUpcoming.length + internalUpcoming.length + externalLastMonth.length + internalLastMonth.length} events found`,
    });

    // Step 4: Draft newsletter
    store.updateStep(jobId, "Drafting newsletter", { status: "running" });

    const userPrompt = buildDraftUserPrompt({
      sourceText: input.sourceText,
      pdfTitles: input.pdfFiles.map((f) => f.name),
      lumaContext: lumaDigest,
      month,
      previousMonth,
    });

    let draft;
    if (fileIds.length > 0) {
      draft = await generateDraftWithFiles(
        DRAFT_SYSTEM_PROMPT,
        userPrompt,
        fileIds,
        input.openAiApiKey
      );
    } else {
      draft = await generateDraftText(DRAFT_SYSTEM_PROMPT, userPrompt, input.openAiApiKey);
    }

    store.updateStep(jobId, "Drafting newsletter", { status: "done", message: "Draft generated" });

    // Step 5: QA review
    store.updateStep(jobId, "QA review", { status: "running" });
    draft = await runQaPass(draft, input.openAiApiKey);
    store.updateStep(jobId, "QA review", { status: "done", message: "QA pass complete" });

    // Step 6: Generate meme
    store.updateStep(jobId, "Generating meme", { status: "running" });

    const internalNewsSection = draft.sections.find(
      (s) => s.title.toLowerCase().includes("internal news") && !s.title.toLowerCase().includes("event")
    );

    if (internalNewsSection && internalNewsSection.items.length > 0) {
      try {
        const memePromptText = await generateMemePrompt(
          internalNewsSection.items.map((i) => ({ title: i.title, summary: i.summary })),
          input.openAiApiKey
        );

        const imageBase64 = await generateMemeImage(memePromptText, input.openAiApiKey);

        draft.internalNewsMeme = {
          enabled: !!imageBase64,
          prompt: memePromptText,
          imageBase64: imageBase64 || undefined,
          imageAlt: "Monthly newsletter meme",
        };

        store.updateStep(jobId, "Generating meme", {
          status: "done",
          message: imageBase64 ? "Meme generated" : "Meme generation skipped",
        });
      } catch (error) {
        draft.internalNewsMeme = {
          enabled: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
        store.updateStep(jobId, "Generating meme", {
          status: "done",
          message: "Meme generation failed (non-critical)",
        });
      }
    } else {
      draft.internalNewsMeme = { enabled: false };
      store.updateStep(jobId, "Generating meme", {
        status: "done",
        message: "No internal news for meme",
      });
    }

    // Step 7: Render HTML
    store.updateStep(jobId, "Rendering HTML", { status: "running" });
    const html = renderNewsletterHtml(draft);
    const text = renderNewsletterText(draft);
    const subject = extractSubjectLine(draft);
    store.updateStep(jobId, "Rendering HTML", { status: "done", message: "HTML rendered" });

    // Step 8: Save preview
    store.updateStep(jobId, "Saving preview", { status: "running" });
    const previewKey = generateKey();

    const previewState: PreviewState = {
      key: previewKey,
      html,
      text,
      subject,
      preheader: draft.preheader,
      structured: draft,
      approvalVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "reviewing",
    };

    store.storePreview(previewKey, previewState);
    store.updateJob(jobId, { status: "done", previewKey });
    store.updateStep(jobId, "Saving preview", { status: "done", message: "Preview ready" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    store.updateJob(jobId, { status: "error", error: errorMessage });

    for (const step of steps) {
      const job = store.getJob(jobId);
      const stepState = job?.steps.find((s) => s.name === step);
      if (stepState?.status === "running") {
        store.updateStep(jobId, step, { status: "error", message: errorMessage });
      }
    }
  }
}
