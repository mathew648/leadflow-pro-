import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import { config } from "../config.js";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: config.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

/**
 * Build a presigned PUT URL for a direct-to-R2 upload, plus the public URL the file
 * will be reachable at once uploaded. Used by both authenticated uploads and the public
 * customer payment page (receipt attachments).
 */
export async function presignUpload(opts: {
  keyPrefix: string;
  filename: string;
  contentType: string;
  expiresIn?: number;
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const ext = opts.filename.split(".").pop()?.slice(0, 8) ?? "bin";
  const key = `${opts.keyPrefix}/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: config.R2_BUCKET_NAME,
    Key: key,
    ContentType: opts.contentType,
  });
  const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn: opts.expiresIn ?? 300 });
  return { uploadUrl, publicUrl: `${config.R2_PUBLIC_URL}/${key}`, key };
}
