export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const checks = {
    firebaseServiceAccountConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    neonAccessKeyConfigured: Boolean(process.env.AWS_ACCESS_KEY_ID),
    neonSecretConfigured: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
    neonBucketConfigured: Boolean(process.env.S3_BUCKET),
    neonEndpointConfigured: Boolean(process.env.AWS_ENDPOINT_URL_S3),
    regionConfigured: Boolean(process.env.AWS_REGION)
  };
  const configured = Object.values(checks).every(Boolean);
  return res.status(configured ? 200 : 503).json({
    service: "NEXORA storage API",
    ok: configured,
    checks,
    note: "This endpoint checks environment-variable presence only; it does not validate credentials or contact Firebase/Neon."
  });
}
