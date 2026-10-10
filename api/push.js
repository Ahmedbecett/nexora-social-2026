import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function firebaseApp() {
  const configured = getApps()[0];
  if (configured) return configured;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return initializeApp({ credential: cert(serviceAccount) });
}

function messageFor(type, actorName) {
  const labels = {
    like: ["New like", `${actorName} liked your post.`],
    comment: ["New comment", `${actorName} commented on your post.`],
    follow: ["New follower", `${actorName} started following you.`],
    message: ["New message", `${actorName} sent you a message.`]
  };
  return labels[type] || ["NEXORA update", "You have a new update."];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ ok: false, error: "Missing Firebase ID token" });

  let app;
  try {
    app = firebaseApp();
    const decoded = await getAuth(app).verifyIdToken(match[1]);
    const notificationId = typeof req.body?.notificationId === "string" ? req.body.notificationId : "";
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(notificationId)) {
      return res.status(400).json({ ok: false, error: "Invalid notificationId" });
    }

    const db = getFirestore(app);
    const ref = db.collection("notifications").doc(notificationId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ ok: false, error: "Notification not found" });

    const notification = snapshot.data();
    if (notification.actorUid !== decoded.uid ||
        !["like", "comment", "follow", "message"].includes(notification.type) ||
        typeof notification.recipientUid !== "string" ||
        notification.recipientUid === decoded.uid) {
      return res.status(403).json({ ok: false, error: "Not allowed to send this notification" });
    }

    const tokensSnapshot = await db.collection("users")
      .doc(notification.recipientUid).collection("fcmTokens").get();
    const tokens = [...new Set(tokensSnapshot.docs
      .map((doc) => doc.get("token"))
      .filter((token) => typeof token === "string" && token.length > 0))];

    if (tokens.length === 0) return res.status(200).json({ ok: true, sent: 0, reason: "No registered devices" });

    const [title, body] = messageFor(notification.type, notification.actorName || "A NEXORA member");
    let sent = 0;
    let failed = 0;
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const batch = tokens.slice(offset, offset + 500);
      const result = await getMessaging(app).sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: {
          type: String(notification.type),
          targetId: String(notification.targetId || ""),
          notificationId
        },
        android: { priority: "high" }
      });
      sent += result.successCount;
      failed += result.failureCount;

      const removals = [];
      result.responses.forEach((response, index) => {
        if (!response.success && [
          "messaging/registration-token-not-registered",
          "messaging/invalid-registration-token"
        ].includes(response.error?.code)) {
          removals.push(tokensSnapshot.docs.find((doc) => doc.get("token") === batch[index])?.ref);
        }
      });
      await Promise.all(removals.filter(Boolean).map((tokenRef) => tokenRef.delete().catch(() => {})));
    }

    return res.status(200).json({ ok: true, sent, failed });
  } catch (error) {
    const status = error?.code === "auth/id-token-expired" ||
      error?.code === "auth/argument-error" ||
      error?.code === "auth/invalid-id-token" ? 401 : 503;
    return res.status(status).json({
      ok: false,
      error: status === 401 ? "Invalid Firebase ID token" : "Push service is not configured or failed"
    });
  }
}
