"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { GenerationProgress } from "@/components/GenerationProgress";
import { Sidebar } from "@/components/Sidebar";
import { JobState } from "@/lib/types";

export default function GenerateJobPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/generate/${jobId}`);
      if (!res.ok) {
        setError("Failed to fetch job status");
        return;
      }
      const data: JobState = await res.json();
      setJob(data);

      if (data.status === "done" && data.previewKey) {
        router.push(`/review/${data.previewKey}`);
      }
    } catch {
      setError("Connection error");
    }
  }, [jobId, router]);

  useEffect(() => {
    pollJob();
    const interval = setInterval(() => {
      if (job?.status !== "done" && job?.status !== "error") {
        pollJob();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pollJob, job?.status]);

  return (
    <div className="flex h-screen bg-navy">
      <Sidebar />

      <main className="flex-1 overflow-y-auto flex flex-col items-center justify-start py-12 px-4">
        <div className="w-full max-w-lg">
          <header className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center border border-[#2a2a42]">
                <span className="text-magenta font-bold text-xs">S</span>
              </div>
              <span className="text-[#a0a0b8] text-sm font-medium tracking-wide uppercase">START Munich</span>
            </div>
            <h1 className="text-2xl font-bold text-[#f1f1f5]">Generating Newsletter</h1>
            <p className="mt-2 text-[#5c5c7a] text-sm">This usually takes 1-2 minutes</p>
          </header>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          {job && (
            <GenerationProgress steps={job.steps} status={job.status} />
          )}

          {job?.status === "error" && (
            <div className="mt-6 text-center">
              <p className="text-red-400 mb-4">{job.error || "An unknown error occurred"}</p>
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 bg-[#111124] border border-[#2a2a42] text-[#f1f1f5] rounded-xl hover:border-[#3a3a57] transition-colors"
              >
                &larr; Back to start
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
