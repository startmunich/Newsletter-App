import { PipelineInput, PreviewState } from "./types";
import { store } from "./store";
import { fetchLumaEvents, buildLumaEventDigest } from "./luma";
import {
  uploadPdfToOpenAI,
  generateDraftWithFiles,
  generateDraftText,
  runQaPass,
  generateCoverImages,
  generateCoverPromptFromDraftData,
  buildDefaultCoverPrompt,
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
        try {
          let buffer = pdf.buffer;
          if (input.nutrientApiKey) {
            buffer = await compressPdf(buffer, pdf.name, input.nutrientApiKey);
          }
          const fileId = await uploadPdfToOpenAI(buffer, pdf.name, input.openAiApiKey);
          fileIds.push(fileId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to upload PDF ${pdf.name}:`, msg);
          throw new Error(`PDF upload failed for ${pdf.name}: ${msg}`);
        }
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

    let lumaDigest: string;
    try {
      const [externalUpcoming, internalUpcoming, externalLastMonth, internalLastMonth] =
        await Promise.all([
          fetchLumaEvents(EXTERNAL_CALENDAR, nowStr, futureStr, input.lumaExternalKey),
          fetchLumaEvents(INTERNAL_CALENDAR, nowStr, futureStr, input.lumaInternalKey),
          fetchLumaEvents(EXTERNAL_CALENDAR, previousMonthStart, previousMonthEndStr, input.lumaExternalKey),
          fetchLumaEvents(INTERNAL_CALENDAR, previousMonthStart, previousMonthEndStr, input.lumaInternalKey),
        ]);

      lumaDigest = buildLumaEventDigest(
        externalUpcoming,
        internalUpcoming,
        externalLastMonth,
        internalLastMonth
      );

      store.updateStep(jobId, "Fetching Luma events", {
        status: "done",
        message: `${externalUpcoming.length + internalUpcoming.length + externalLastMonth.length + internalLastMonth.length} events found`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Luma fetch error:", msg);
      throw new Error(`Failed to fetch Luma events: ${msg}`);
    }

    // Step 4: Draft newsletter
    store.updateStep(jobId, "Drafting newsletter", { status: "running" });

    const userPrompt = buildDraftUserPrompt({
      sourceText: input.sourceText,
      meetingTranscript: input.meetingTranscript,
      pdfTitles: input.pdfFiles.map((f) => f.name),
      lumaContext: lumaDigest,
      month,
      previousMonth,
    });

    let draft;
    try {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Draft generation error:", msg);
      throw new Error(`Draft generation failed: ${msg}`);
    }

    store.updateStep(jobId, "Drafting newsletter", { status: "done", message: "Draft generated" });

    // Step 5: QA review
    store.updateStep(jobId, "QA review", { status: "running" });
    try {
      draft = await runQaPass(draft, input.openAiApiKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("QA pass error:", msg);
      throw new Error(`QA review failed: ${msg}`);
    }
    store.updateStep(jobId, "QA review", { status: "done", message: "QA pass complete" });

    // Step 6: Render HTML
    store.updateStep(jobId, "Rendering HTML", { status: "running" });
    const html = renderNewsletterHtml(draft);
    const text = renderNewsletterText(draft);
    const subject = extractSubjectLine(draft);
    store.updateStep(jobId, "Rendering HTML", { status: "done", message: "HTML rendered" });

    // Step 9: Save preview
    store.updateStep(jobId, "Saving preview", { status: "running" });
    const previewKey = generateKey();
    const previewId = `ID_${previewKey.split("_").slice(-1)[0].slice(0, 6).toUpperCase()}`;

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
      monthGenerated: month,
      name: previewId,
    };

    // Start cover image generation in background automatically
    const coverJobId = `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let coverPrompts: string[];
    try {
      coverPrompts = await generateCoverPromptFromDraftData(
        {
          month: draft.month,
          subject: draft.subject,
          intro: draft.intro,
          sections: draft.sections || [],
        },
        input.openAiApiKey
      );
    } catch (error) {
      console.error("Pipeline cover prompt AI generation failed, using fallback:", error);
      coverPrompts = buildDefaultCoverPrompt({
        month: draft.month,
        subject: draft.subject,
        intro: draft.intro,
        internalNewsItems: [],
      });
    }

    store.createCoverImageJob(coverJobId, previewKey, coverPrompts[0]);
    store.updateCoverImageJob(coverJobId, { status: "running" });
    previewState.coverImageJobId = coverJobId;

    await store.storePreview(previewKey, previewState);
    store.updateJob(jobId, { status: "done", previewKey });
    store.updateStep(jobId, "Saving preview", { status: "done", message: "Preview ready" });

    // Fire and forget cover image generation
    ;(async () => {
      try {
        const apiKey = input.openAiApiKey;
        const images = await generateCoverImages(coverPrompts, apiKey, (image) => {
          store.addCoverImageToJob(coverJobId, {
            prompt: image.prompt,
            imageBase64: image.imageBase64,
            index: image.index,
          });
        });
        const currentPreview = await store.getPreview(previewKey);
        if (currentPreview) {
          currentPreview.structured.coverImages = images.map((img, index) => ({
            prompt: img.prompt,
            imageBase64: img.imageBase64,
            index,
          }));
          currentPreview.updatedAt = new Date();
          await store.storePreview(previewKey, currentPreview);
        }
        store.updateCoverImageJob(coverJobId, {
          status: images.length > 0 ? "done" : "error",
          error: images.length === 0 ? "No images generated" : undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        store.updateCoverImageJob(coverJobId, { status: "error", error: msg });
      }
    })();
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
