"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { GenerationProgress } from "@/components/GenerationProgress";
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
    <main className="min-h-screen flex flex-col items-center justify-start py-12 px-4">
      <div className="w-full max-w-lg">
        <header className="text-center mb-10">
          <h1 className="text-2xl font-bold text-navy">Generating Newsletter</h1>
          <p className="mt-2 text-gray-500 text-sm">This usually takes 1-2 minutes</p>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {job && (
          <GenerationProgress steps={job.steps} status={job.status} />
        )}

        {job?.status === "error" && (
          <div className="mt-6 text-center">
            <p className="text-red-600 mb-4">{job.error || "An unknown error occurred"}</p>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-navy text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              &larr; Back to start
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
