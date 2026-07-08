"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PreviewState, JobState, CoverImageJob } from "@/lib/types";

interface SidebarProps {
  activeKey?: string;
}

export function Sidebar({ activeKey }: SidebarProps) {
  const router = useRouter();
  const [previews, setPreviews] = useState<PreviewState[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobState[]>([]);
  const [activeCoverJobs, setActiveCoverJobs] = useState<CoverImageJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

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
          setActiveJobs(data.jobs || []);
          setActiveCoverJobs(data.coverJobs || []);
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

  const startRename = (preview: PreviewState) => {
    setRenamingKey(preview.key);
    setRenameValue(preview.name || preview.monthGenerated || "");
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = async (key: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingKey(null);
      return;
    }
    setPreviews((prev) =>
      prev.map((p) => (p.key === key ? { ...p, name: trimmed } : p))
    );
    setRenamingKey(null);
    await fetch(`/api/preview-data/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
  };

  const handleDelete = async (key: string) => {
    setPreviews((prev) => prev.filter((p) => p.key !== key));
    setDeletingKey(null);
    await fetch(`/api/preview-data/${key}`, { method: "DELETE" });
    if (activeKey === key) router.push("/");
  };

  const coverGeneratingKeys = new Set(activeCoverJobs.map((j) => j.previewKey));

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
            <div className="space-y-1">
              {previews.map((preview) => {
                const isActive = activeKey === preview.key;
                const isRenaming = renamingKey === preview.key;
                const isDeleting = deletingKey === preview.key;
                const displayName = preview.name || preview.monthGenerated || "Untitled";

                return (
                  <div
                    key={preview.key}
                    className={`group relative rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-magenta/20 border border-magenta"
                        : "border border-transparent hover:bg-[#2a2a42]"
                    }`}
                  >
                    {isDeleting ? (
                      <div className="px-3 py-2">
                        <p className="text-xs text-[#f1f1f5] mb-2">Delete &ldquo;{displayName}&rdquo;?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(preview.key)}
                            className="flex-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeletingKey(null)}
                            className="flex-1 px-2 py-1 bg-[#3a3a52] text-[#f1f1f5] text-xs rounded hover:bg-[#4a4a62] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : isRenaming ? (
                      <div className="px-3 py-2">
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(preview.key);
                            if (e.key === "Escape") setRenamingKey(null);
                          }}
                          onBlur={() => commitRename(preview.key)}
                          className="w-full px-2 py-1 bg-[#2a2a42] border border-[#D0006F] rounded text-[#f1f1f5] text-xs focus:outline-none"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <Link
                        href={`/newsletter/${preview.key}`}
                        className={`block px-3 py-2 pr-16 ${isActive ? "text-magenta" : "text-[#a0a0b8] hover:text-[#f1f1f5]"}`}
                      >
                        <div className="font-medium truncate">{displayName}</div>
                        <div className="text-xs text-[#606078] mt-0.5">
                          {preview.status === "sent" ? "✓ Sent" : "◦ Draft"} · {new Date(preview.updatedAt).toLocaleDateString()}
                        </div>
                        {coverGeneratingKeys.has(preview.key) && (
                          <span className="flex items-center gap-1 text-[10px] text-magenta mt-0.5">
                            <span className="inline-block w-2 h-2 rounded-full border border-magenta border-t-transparent animate-spin" />
                            generating cover…
                          </span>
                        )}
                      </Link>
                    )}

                    {/* Action buttons — visible on hover (when not in rename/delete mode) */}
                    {!isRenaming && !isDeleting && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                        <button
                          onClick={(e) => { e.preventDefault(); startRename(preview); }}
                          title="Rename"
                          className="p-1.5 rounded text-[#606078] hover:text-[#f1f1f5] hover:bg-[#3a3a52] transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); setDeletingKey(preview.key); }}
                          title="Delete"
                          className="p-1.5 rounded text-[#606078] hover:text-red-400 hover:bg-[#3a3a52] transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
