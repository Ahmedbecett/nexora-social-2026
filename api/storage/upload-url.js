import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const allowedTypes = new Set([
  "image/jpeg", "image/png", "image/webp",
  "video/mp4", "video/quicktime", "video/webm"
]);
const maxBytes = 20 * 1024 * 1024;

function getFirebaseApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

function getS3() {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-2";
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Storage environment variables are not configured");
  }
  return new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey }
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Firebase ID token required" });

    const decoded = await getAuth(getFirebaseApp()).verifyIdToken(match[1]);
    const { contentType, size, fileName } = req.body || {};
    if (!allowedTypes.has(contentType)) {
      return res.status(400).json({ error: "Unsupported media type" });
    }
    const bytes = Number(size);
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > maxBytes) {
      return res.status(400).json({ error: "File must be between 1 byte and 20 MB" });
    }

    const bucket = process.env.S3_BUCKET;
    if (!bucket) return res.status(500).json({ error: "S3_BUCKET is not configured" });

    const extFromName = typeof fileName === "string" ? fileName.split(".").pop()?.toLowerCase() : "";
    const safeExt = extFromName && /^[a-z0-9]{1,8}$/.test(extFromName) ? extFromName : "bin";
    const mediaType = contentType.startsWith("image/") ? "images" : "videos";
    const key = `users/${decoded.uid}/${mediaType}/${randomUUID()}.${safeExt}`;
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: bytes
    });
    const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn: 300 });
    return res.status(200).json({
      uploadUrl,
      key,
      method: "PUT",
      headers: { "Content-Type": contentType },
      expiresIn: 300
    });
  } catch (error) {
    console.error("Storage upload URL error:", error?.message || "unknown");
    return res.status(500).json({ error: "Could not prepare upload" });
  }
}
