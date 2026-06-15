import { api } from "./api";

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

/**
 * Uploads a job photo using the three-step R2 flow:
 * 1. ask the API for a presigned PUT URL
 * 2. upload the file bytes directly to R2
 * 3. confirm so the API persists a JobPhoto row
 * Returns the public URL of the stored image.
 */
export async function uploadJobPhoto(
  file: File,
  jobId: string,
  caption?: string
): Promise<string> {
  const presign = await api.post<PresignResponse>("/upload/presigned", {
    filename: file.name || `photo-${Date.now()}.jpg`,
    contentType: file.type || "image/jpeg",
    category: "job-photo",
    entityId: jobId,
  });

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "image/jpeg" },
  });
  if (!put.ok) {
    throw new Error("Photo upload failed");
  }

  await api.post("/upload/confirm", {
    key: presign.key,
    publicUrl: presign.publicUrl,
    category: "job-photo",
    entityId: jobId,
    entityType: "job",
    caption,
  });

  return presign.publicUrl;
}

/** Promisified geolocation lookup; resolves to null if unavailable or denied. */
export function getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}
