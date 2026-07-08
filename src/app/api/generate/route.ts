import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { runPipeline } from "@/lib/pipeline";
import { PipelineInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const sourceText = formData.get("sourceText");
    const meetingTranscript = formData.get("meetingTranscript");

    // Make both optional, but require at least one
    if ((!sourceText || typeof sourceText !== "string" || sourceText.trim().length === 0) &&
        (!meetingTranscript || typeof meetingTranscript !== "string" || meetingTranscript.trim().length === 0)) {
      return NextResponse.json(
        { error: "Either sourceText or meetingTranscript is required" },
        { status: 400 }
      );
    }

    const openAiApiKey = process.env.OPENAI_API_KEY;
    const lumaExternalKey = process.env.LUMA_EXTERNAL_API_KEY;
    const lumaInternalKey = process.env.LUMA_INTERNAL_API_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;
    const nutrientApiKey = process.env.NUTRIENT_API_KEY;

    if (!openAiApiKey || !lumaExternalKey || !lumaInternalKey || !brevoApiKey) {
      return NextResponse.json(
        { error: "Missing required API keys in environment" },
        { status: 500 }
      );
    }

    const pdfFiles: Array<{ buffer: Buffer; name: string }> = [];
    const files = formData.getAll("files");

    for (const file of files) {
      if (file instanceof File && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        pdfFiles.push({
          buffer: Buffer.from(arrayBuffer),
          name: file.name,
        });
      }
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    store.createJob(jobId);

    const input: PipelineInput = {
      jobId,
      sourceText: sourceText ? (sourceText as string).trim() : "",
      meetingTranscript: meetingTranscript ? (meetingTranscript as string).trim() : "",
      pdfFiles,
      openAiApiKey,
      lumaExternalKey,
      lumaInternalKey,
      brevoApiKey,
      nutrientApiKey,
    };

    runPipeline(jobId, input).catch((err) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Pipeline fatal error:", errorMsg, "\nStack:", err instanceof Error ? err.stack : "");
      store.updateJob(jobId, {
        status: "error",
        error: errorMsg,
      });
    });

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
