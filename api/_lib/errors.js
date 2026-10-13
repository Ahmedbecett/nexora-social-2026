/* خطأ HTTP موحّد — في ملف مشترك حتى تستعمله الوحدات دون استيراد دائري */
export class HttpError extends Error {
  constructor(status, message, code, detail) {
    super(message); this.status = status; this.code = code || message;
    if (detail) this.detail = String(detail).slice(0, 300);
  }
}
