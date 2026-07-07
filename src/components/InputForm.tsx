"use client";

import { useState, useRef, FormEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";

export function InputForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError("Please enter some newsletter source text");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("sourceText", text);
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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="sourceText"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Newsletter source text
        </label>
        <textarea
          id="sourceText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the monthly recap text here — board updates, program news, partnerships, metrics, team changes..."
          rows={12}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-magenta/50 focus:border-magenta resize-y"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PDF attachments (optional)
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragOver
              ? "border-magenta bg-magenta/5"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <p className="text-sm text-gray-500">
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
                className="flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2"
              >
                <span className="text-sm text-gray-700 truncate">
                  📄 {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-gray-400 hover:text-red-500 ml-2"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || !text.trim()}
        className="w-full py-3 px-6 bg-magenta text-white font-semibold rounded-lg hover:bg-magenta-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Starting generation..." : "Generate Newsletter"}
      </button>
    </form>
  );
}
