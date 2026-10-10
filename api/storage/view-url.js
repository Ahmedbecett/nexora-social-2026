import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getFirebaseApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

function getS3() {
  const AWS_ENDPOINT_URL_S3 = process.env.AWS_ENDPOINT_URL_S3 || "https://br-bold-sky-b4c1teyk.storage.c-6.us-east-2.aws.neon.tech";
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
  if (!AWS_ENDPOINT_URL_S3 || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error("Storage environment variables are not configured");
  }
  return new S3Client({
    endpoint: AWS_ENDPOINT_URL_S3,
    region: process.env.AWS_REGION || "us-east-2",
    forcePathStyle: true,
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY }
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const match = (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: "Firebase ID token required" });
    const app = getFirebaseApp();
    await getAuth(app).verifyIdToken(match[1]);

    const key = req.body?.key;
    if (typeof key !== "string" ||
        !/^users\/[A-Za-z0-9_-]+\/(images|videos)\/[A-Za-z0-9-]+\.[A-Za-z0-9]{1,8}$/.test(key)) {
      return res.status(400).json({ error: "Invalid object key" });
    }
    // Only issue signed URLs for media referenced by a published post or an unexpired story.
    const db = getFirestore(app);
    const [posts, stories] = await Promise.all([
      db.collection("posts").where("mediaKey", "==", key).limit(1).get(),
      db.collection("stories").where("mediaKey", "==", key).where("expiresAt", ">", new Date()).limit(1).get()
    ]);
    if (posts.empty && stories.empty) {
      return res.status(403).json({ error: "Media is not attached to an available post or story" });
    }

    const bucket = process.env.S3_BUCKET;
    if (!bucket) return res.status(500).json({ error: "S3_BUCKET is not configured" });

    const url = await getSignedUrl(
      getS3(),
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 300 }
    );
    return res.status(200).json({ url, expiresIn: 300 });
  } catch (error) {
    console.error("Storage view URL error:", error?.message || "unknown");
    return res.status(500).json({ error: "Could not prepare media URL" });
  }
}
