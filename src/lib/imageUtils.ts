// Client-side image compression using Canvas API
// Compresses and resizes images before uploading to R2

/**
 * Compress an image file to a smaller JPEG/WebP blob.
 * - Resizes to fit within maxSize x maxSize (preserving aspect ratio)
 * - Compresses to target quality (0-1)
 * - Returns a Blob suitable for uploading
 */
export async function compressImage(
  file: File,
  maxSize: number = 512,
  quality: number = 0.82
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if larger than maxSize
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }

      // Draw with high-quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first (better compression), fall back to JPEG
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Fallback to JPEG
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob) resolve(jpegBlob);
                else reject(new Error("Failed to compress image"));
              },
              "image/jpeg",
              quality
            );
          }
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Upload a compressed image blob to our /api/upload endpoint.
 * Returns the public URL of the uploaded image, or null on failure.
 */
export async function uploadImageToR2(
  blob: Blob,
  fileName: string
): Promise<string | null> {
  try {
    // Convert blob to base64
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const contentType = blob.type || "image/jpeg";

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: base64,
        fileName: `${fileName}.${ext}`,
        contentType,
      }),
    });

    if (!res.ok) {
      console.error("Upload failed:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.url || null;
  } catch (err) {
    console.error("Image upload error:", err);
    return null;
  }
}
