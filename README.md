# Nexora Voice Gateway

خدمة صوت صغيرة: تفريغ (Groq Whisper) ونطق (Azure Speech) خلف سر مشترك.

- `GET /health`
- `POST /v1/stt` — `{ audio: base64, mime }` → `{ text, provider }`
- `POST /v1/tts` — `{ text, voice? }` → `{ audioB64, mime, provider }`

المتغيرات المطلوبة في Render (أسرار، لا تُكتب في الكود):
`GATEWAY_SECRET`, `GROQ_API_KEY`, واختيارياً `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`.

الاختبار محلياً: `GROQ_BASE=... npm test` (يستعمل مزودين وهميين).
