cd /home/user/repo
source ~/keys/tokens.env; source ~/keys/blob.env
export DATABASE_URL BLOB_READ_WRITE_TOKEN JWT_SECRET=local-qa-secret-2026
node scripts/local-api.mjs
