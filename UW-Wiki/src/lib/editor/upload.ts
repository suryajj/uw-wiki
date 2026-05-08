import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export async function uploadEditorImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new UploadError(`Image is too large (max ${MAX_BYTES / (1024 * 1024)} MB).`);
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new UploadError("Image must be PNG, JPEG, WebP, or GIF.");
  }

  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]+/g, "-");
  const filename = `${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from("wiki-images")
    .upload(filename, file, { contentType: file.type, upsert: false });

  if (error) throw new UploadError(error.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("wiki-images").getPublicUrl(filename);
  return publicUrl;
}
