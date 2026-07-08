"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PreviewState, JobState } from "@/lib/types";

interface SidebarProps {
  activeKey?: string;
}

export function Sidebar({ activeKey }: SidebarProps) {
  const [previews, setPreviews] = useState<PreviewState[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [previewRes, jobsRes] = await Promise.all([
          fetch("/api/preview-list"),
          fetch("/api/active-jobs"),
        ]);

        if (previewRes.ok) {
          const data = await previewRes.json();
          setPreviews(data || []);
        }

        if (jobsRes.ok) {
          const data = await jobsRes.json();
          setActiveJobs(data || []);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Poll for active jobs updates
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-64 bg-[#1a1a2e] border-r border-[#2a2a42] h-screen overflow-y-auto">
      <div className="p-6">
        <h2 className="text-lg font-bold text-[#f1f1f5] mb-6 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-magenta flex items-center justify-center">
            <span className="text-white text-xs font-bold">!</span>
          </div>
          Newsletters
        </h2>

        <div className="space-y-2">
          <Link
            href="/"
            className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              !activeKey
                ? "bg-magenta text-white"
                : "text-[#a0a0b8] hover:bg-[#2a2a42] hover:text-[#f1f1f5]"
            }`}
          >
            + New Newsletter
          </Link>
        </div>

        {/* Processing Jobs Section */}
        {activeJobs.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs font-semibold text-[#f1f1f5] uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              Processing
            </h3>

            <div className="space-y-2">
              {activeJobs.map((job) => {
                const currentStep = job.steps.find((s) => s.status === "running") || job.steps[0];
                const progress = Math.round((job.steps.filter((s) => s.status === "done").length / job.steps.length) * 100);

                return (
                  <div
                    key={job.id}
                    className="px-4 py-3 rounded-lg bg-[#2a2a42] border border-yellow-400/30 text-sm"
                  >
                    <div className="font-medium text-[#f1f1f5] truncate text-xs mb-2">Generating...</div>
                    <div className="text-xs text-[#a0a0b8] mb-2">{currentStep?.name || "Starting..."}</div>
                    <div className="w-full bg-[#1a1a2e] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-[#606078] mt-1">{progress}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">Recent</h3>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-[#2a2a42] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : previews.length === 0 ? (
            <p className="text-xs text-[#606078] italic">No newsletters yet</p>
          ) : (
            <div className="space-y-2">
              {previews.map((preview) => (
                <Link
                  key={preview.key}
                  href={`/newsletter/${preview.key}`}
                  className={`block px-4 py-3 rounded-lg text-sm transition-colors ${
                    activeKey === preview.key
                      ? "bg-magenta/20 border border-magenta text-magenta"
                      : "text-[#a0a0b8] hover:bg-[#2a2a42] hover:text-[#f1f1f5]"
                  }`}
                >
                  <div className="font-medium truncate">{preview.monthGenerated || "Untitled"}</div>
                  <div className="text-xs text-[#606078] mt-1">
                    {preview.status === "sent" ? "✓ Sent" : "◦ Draft"}
                  </div>
                  <div className="text-xs text-[#606078] mt-1">
                    {new Date(preview.updatedAt).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
