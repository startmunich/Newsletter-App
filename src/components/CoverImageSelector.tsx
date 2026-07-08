"use client";

import { useState } from "react";

interface CoverImage {
  prompt: string;
  imageBase64: string;
  index: number;
}

interface CoverImageSelectorProps {
  images: CoverImage[];
  selectedIndex: number | undefined;
  previewKey: string;
  onSelect: (index: number) => void;
}

export function CoverImageSelector({
  images,
  selectedIndex,
  previewKey,
  onSelect,
}: CoverImageSelectorProps) {
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!images || images.length === 0) {
    return null;
  }

  const handleSelectImage = async (index: number) => {
    setSelecting(true);
    setError(null);

    try {
      const response = await fetch("/api/select-cover-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewKey,
          imageIndex: index,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to select cover image");
      }

      onSelect(index);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Failed to select cover image:", msg);
      setError(msg);
    } finally {
      setSelecting(false);
    }
  };

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-[#f1f1f5] mb-4">Select Newsletter Cover Image</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {images.map((image) => (
          <div
            key={image.index}
            onClick={() => handleSelectImage(image.index)}
            className={`cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
              selectedIndex === image.index
                ? "border-magenta shadow-lg shadow-magenta/50"
                : "border-[#2a2a42] hover:border-[#3a3a52]"
            } ${selecting ? "opacity-50 cursor-wait" : ""}`}
          >
            {image.imageBase64 && (
              <img
                src={`data:image/png;base64,${image.imageBase64}`}
                alt={`Cover option ${image.index + 1}`}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-3 bg-[#1a1a2e]">
              {selectedIndex === image.index && (
                <div className="text-magenta font-semibold text-sm mb-1">✓ Selected</div>
              )}
              <p className="text-[#a0a0b8] text-xs line-clamp-2">{image.prompt}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
