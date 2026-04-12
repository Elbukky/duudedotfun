// Vercel Serverless Function — upload image to Cloudflare R2
// Env vars (set in Vercel dashboard):
//   default_url     — R2 S3 API endpoint (https://<account-id>.r2.cloudflarestorage.com)
//   Access_Key_ID   — R2 S3 access key
//   Secret_Access_Key — R2 S3 secret key
//   bucket_name     — R2 bucket name
//   R2_PUBLIC_URL   — (REQUIRED) Public URL prefix for serving files
//                     e.g. https://pub-<hash>.r2.dev  OR  https://your-custom-domain.com
//                     Enable public access on your R2 bucket first, then copy the URL here.
//   Access_id       — Cloudflare account ID (informational, not used in upload)
//   Token_value     — Cloudflare API token (not used — S3 API used instead)

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { VercelRequest, VercelResponse } from "@vercel/node";

let s3: S3Client | null = null;

function getS3() {
  if (!s3) {
    const endpoint = process.env.default_url;
    const accessKeyId = process.env.Access_Key_ID;
    const secretAccessKey = process.env.Secret_Access_Key;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 credentials not configured");
    }

    s3 = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return s3;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image, fileName, contentType } = req.body;

    if (!image || !fileName) {
      return res.status(400).json({ error: "Missing image or fileName" });
    }

    const bucket = process.env.bucket_name;
    if (!bucket) {
      return res.status(500).json({ error: "Bucket not configured" });
    }

    const publicBase = process.env.R2_PUBLIC_URL;
    if (!publicBase) {
      return res.status(500).json({
        error: "R2_PUBLIC_URL not configured. Enable public access on your R2 bucket, then add the public URL as R2_PUBLIC_URL in Vercel env vars.",
      });
    }

    // Decode base64 image
    const buffer = Buffer.from(image, "base64");

    // Generate a unique key: tokens/{timestamp}-{random}-{filename}
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const key = `tokens/${timestamp}-${random}-${fileName}`;

    const client = getS3();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    // Construct public URL from R2_PUBLIC_URL + key
    const publicUrl = `${publicBase.replace(/\/$/, "")}/${key}`;

    return res.status(200).json({ url: publicUrl, key });
  } catch (err: any) {
    console.error("Upload error:", err);
    return res.status(500).json({
      error: err.message || "Upload failed",
    });
  }
}
