export async function compressPdf(
  pdfBuffer: Buffer,
  filename: string,
  apiKey: string,
  // Nutrient image quality: 1 (best quality) … 4 (smallest size). Default 2.
  imageOptimizationQuality: number = 2
): Promise<Buffer> {
  try {
    const instructions = JSON.stringify({
      parts: [{ file: "document" }],
      output: {
        type: "pdf",
        optimize: {
          disableImages: false,
          mrcCompression: true,
          imageOptimizationQuality,
        },
      },
    });

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
    formData.append("document", blob, filename);
    formData.append("instructions", instructions);

    const response = await fetch("https://api.nutrient.io/build", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error(`Nutrient compression failed: ${response.status}`);
      return pdfBuffer;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Nutrient PDF compression error, using original:", error);
    return pdfBuffer;
  }
}
