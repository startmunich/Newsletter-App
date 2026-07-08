"use client";

import { useState, useRef, FormEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";

export function InputForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [meetingTranscript, setMeetingTranscript] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Make both text fields optional, but at least one should have content
    if (!text.trim() && !meetingTranscript.trim()) {
      setError("Please enter either newsletter source text or a meeting transcript");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("sourceText", text);
      formData.append("meetingTranscript", meetingTranscript);
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start generation");
      }

      const { jobId } = await res.json();
      router.push(`/generate/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileInput = () => {
    const input = fileInputRef.current;
    if (input?.files) {
      const newFiles = Array.from(input.files).filter(
        (f) => f.type === "application/pdf"
      );
      setFiles((prev) => [...prev, ...newFiles]);
      input.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#111124] border border-[#2a2a42] rounded-2xl p-6 space-y-5">
        <div>
          <label
            htmlFor="sourceText"
            className="block text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2"
          >
            Newsletter source text <span className="normal-case font-normal text-[#5c5c7a]">(optional)</span>
          </label>
          <textarea
            id="sourceText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the monthly recap text here — board updates, program news, partnerships, metrics, team changes..."
            rows={8}
            className="w-full rounded-xl border border-[#2a2a42] bg-[#0a0a14] px-4 py-3 text-sm text-[#f1f1f5] placeholder-[#3a3a57] focus:outline-none focus:ring-2 focus:ring-magenta/40 focus:border-magenta/60 resize-y transition-colors"
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="meetingTranscript"
            className="block text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2"
          >
            Meeting transcript <span className="normal-case font-normal text-[#5c5c7a]">(optional)</span>
          </label>
          <textarea
            id="meetingTranscript"
            value={meetingTranscript}
            onChange={(e) => setMeetingTranscript(e.target.value)}
            placeholder="Paste a transcript from a recorded meeting to include relevant discussions and updates..."
            rows={8}
            className="w-full rounded-xl border border-[#2a2a42] bg-[#0a0a14] px-4 py-3 text-sm text-[#f1f1f5] placeholder-[#3a3a57] focus:outline-none focus:ring-2 focus:ring-magenta/40 focus:border-magenta/60 resize-y transition-colors"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
            PDF attachments <span className="normal-case font-normal text-[#5c5c7a]">(optional)</span>
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isDragOver
                ? "border-magenta/60 bg-magenta/5"
                : "border-[#2a2a42] hover:border-[#3a3a57]"
            }`}
          >
            <p className="text-sm text-[#5c5c7a]">
              Drop PDF files here or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between bg-[#1a1a2e] border border-[#2a2a42] rounded-lg px-3 py-2"
                >
                  <span className="text-sm text-[#a0a0b8] truncate">
                    📄 {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-[#5c5c7a] hover:text-red-400 ml-2 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || (!text.trim() && !meetingTranscript.trim())}
        className="w-full py-3 px-6 bg-magenta text-white font-semibold rounded-xl hover:bg-magenta-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLoading ? "Starting generation..." : "Generate Newsletter"}
      </button>
    </form>
  );
}
