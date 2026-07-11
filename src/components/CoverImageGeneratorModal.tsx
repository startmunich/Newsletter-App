"use client";

import { useEffect, useRef, useState } from "react";
import { CoverImage } from "@/lib/types";
import type { CoverPrompt } from "@/lib/openai-client";

interface CoverImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelected: (image: CoverImage) => void;
  previewKey: string;
  onJobStarted?: (jobId: string) => void;
}

type Phase = "prompt" | "generating" | "results";

export default function CoverImageGeneratorModal({
  isOpen,
  onClose,
  onImageSelected,
  previewKey,
  onJobStarted,
}: CoverImageGeneratorModalProps) {
  const [phase, setPhase] = useState<Phase>("prompt");
  const [prompts, setPrompts] = useState<CoverPrompt[]>([]);
  const [promptLoading, setPromptLoading] = useState(false);
  const [images, setImages] = useState<CoverImage[]>([]);
  const [jobDone, setJobDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load the default prompts when the modal opens
  useEffect(() => {
    if (!isOpen) return;

    setPhase("prompt");
    setImages([]);
    setJobDone(false);
    setError(null);
    setPromptLoading(true);

    fetch(`/api/generate-cover-images?previewKey=${encodeURIComponent(previewKey)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.prompts && Array.isArray(data.prompts)) {
          setPrompts(data.prompts as CoverPrompt[]);
        }
      })
      .catch(() => {
        /* keep whatever prompts exist */
      })
      .finally(() => setPromptLoading(false));
  }, [isOpen, previewKey]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleStartGeneration = async () => {
    setError(null);
    setImages([]);
    setJobDone(false);
    setPhase("generating");

    try {
      const response = await fetch("/api/generate-cover-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewKey, prompts }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start generation");
      }

      const { jobId } = await response.json();

      if (onJobStarted) onJobStarted(jobId);

      // Poll for progressive results
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/generate-cover-images/${jobId}`);
          if (!res.ok) return;
          const job = await res.json();

          setImages(job.images || []);

          if (job.status === "done") {
            stopPolling();
            setJobDone(true);
            setPhase("results");
          } else if (job.status === "error") {
            stopPolling();
            setError(job.error || "Image generation failed");
            setPhase("results");
          } else if ((job.images?.length || 0) > 0) {
            // Show results view as soon as the first image arrives
            setPhase("results");
          }
        } catch {
          /* transient poll error, keep polling */
        }
      }, 2000);
    } catch (err) {
      stopPolling();
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("results");
    }
  };

  const handleSelectImage = (image: CoverImage) => {
    onImageSelected(image);
    handleClose();
  };

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  if (!isOpen) return null;

  const generating = phase === "generating" || (phase === "results" && !jobDone && !error);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-6">Generate Cover Images</h2>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded p-4 mb-6 text-red-300">
            {error}
          </div>
        )}

        {/* Prompt editing */}
        {phase === "prompt" && (
          <>
            <p className="text-xs text-[#606078] mb-4">
              One image is generated per news story. Edit any prompt below to customize its image. Generation runs in the background.
            </p>

            {promptLoading && prompts.length === 0 && (
              <p className="text-sm text-[#606078] mb-4">Loading news prompts…</p>
            )}

            {prompts.map((cp, idx) => (
              <div key={idx} className="mb-4">
                <label className="block text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                  {cp.label || `News ${idx + 1}`}
                </label>
                <textarea
                  value={cp.prompt}
                  onChange={(e) => {
                    const updated = prompts.map((p, i) =>
                      i === idx ? { ...p, prompt: e.target.value } : p
                    );
                    setPrompts(updated);
                  }}
                  disabled={promptLoading}
                  rows={3}
                  placeholder={promptLoading ? "Loading prompt..." : "Describe the news for this cover image..."}
                  className="w-full px-4 py-3 bg-[#2a2a42] border border-[#3a3a52] rounded-lg text-[#f1f1f5] placeholder-[#606078] focus:outline-none focus:border-[#D0006F] resize-y"
                />
              </div>
            ))}

            <div className="flex gap-4 mt-2">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-[#2a2a42] text-[#f1f1f5] font-medium rounded-lg hover:bg-[#3a3a52] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartGeneration}
                disabled={promptLoading || prompts.length === 0 || !prompts.every(p => p.prompt.trim().length > 0)}
                className="px-6 py-2 bg-[#D0006F] hover:bg-[#a80055] text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                Generate Images
              </button>
            </div>
          </>
        )}

        {/* Generating / Results */}
        {(phase === "generating" || phase === "results") && (
          <>
            {generating && (
              <div className="flex items-center gap-3 mb-6 text-[#a0a0b8]">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#D0006F]"></div>
                <span>Generating images in the background... ({images.length} ready)</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {images.map((image) => (
                <div
                  key={image.index}
                  className="cursor-pointer relative group"
                  onClick={() => handleSelectImage(image)}
                >
                  <img
                    src={image.imageUrl || `data:image/png;base64,${image.imageBase64}`}
                    alt={`Cover option ${image.index + 1}`}
                    className="w-full aspect-square object-cover rounded-lg hover:opacity-80 transition-opacity"
                  />
                  <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="text-white font-semibold bg-black/50 px-4 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      Select
                    </span>
                  </div>
                </div>
              ))}

              {/* Placeholder skeletons for images still generating */}
              {generating &&
                Array.from({ length: Math.max(0, prompts.length - images.length) }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="w-full aspect-square rounded-lg bg-[#2a2a42] animate-pulse"
                  />
                ))}
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-[#2a2a42] text-[#f1f1f5] font-medium rounded-lg hover:bg-[#3a3a52] transition-colors"
              >
                Close
              </button>
              {!generating && (
                <button
                  onClick={() => setPhase("prompt")}
                  className="px-6 py-2 bg-[#D0006F] hover:bg-[#a80055] text-white font-semibold rounded-lg transition-colors"
                >
                  Edit Prompt & Regenerate
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
