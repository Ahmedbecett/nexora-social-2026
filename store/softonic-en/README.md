# NEXORA AI — English store screenshots (v4.4)

Twelve original screenshots at **1080×1920** (the 9:16 minimum), each as PNG and JPG.

| # | File | What it shows |
|---|------|---------------|
| 1 | `nexora-en-1-brand` | Logo, tagline, three benefits, version |
| 2 | `nexora-en-2-ai-chat` | AI chat: bubbles, four welcome prompts, input bar |
| 3 | `nexora-en-3-ai-tools` | The six real AI tools as a grid |
| 4 | `nexora-en-4-image-generation` | Image generation: prompt, generated art, style/ratio/model |
| 5 | `nexora-en-5-translation` | Translation Arabic → English with source and result |
| 6 | `nexora-en-6-social-feed` | Social feed: stories, post, likes, bottom navigation |
| 7 | `nexora-en-7-chat-expression` | ChatKit composer: stickers, cutouts, GIFs |
| 8 | `nexora-en-8-download` | Privacy, account options, download button, v4.4 |
| 9 | `nexora-en-9-settings` | Settings: language, theme, privacy, account, version |
| 10 | `nexora-en-10-personal-ai` | AI workspace: tools list and saved chats with context |
| 11 | `nexora-en-11-search` | Search: field, tabs, result grid, AI search strip, suggestions |
| 12 | `nexora-en-12-profile` | Profile: avatar, stats, Edit/Share, highlights, post grid |

`NEXORA-AI-Store-Screenshots-EN-v4.4.zip` bundles all 25 files (PNG + JPG + this README, ~3.1 MB).

## Where the content comes from

Nothing here is invented — every string and colour is taken from the shipped app:

| Source | Used for |
|--------|----------|
| `src/styles.css` dark theme | `--bg #0c1014`, `--surface #1c2126`, `--border #363a3f`, `--blue #0095f6`, `--text #f5f5f5`, `--muted #a8a8a8` |
| `src/ai/AIPlatform.jsx` | The six tools (Chat, Images, Writing, Code, Translate, Summaries), welcome prompts, quick actions |
| `src/i18n.js` (English) | `Message...`, `On Nexora`, `Suggested for you`, `Your story`, `Stickers`, `Cutouts`, `GIFs`, `Edit Profile`, `Share Profile`, `For you` |
| `src/screens/Settings.jsx` | Settings groups: Language, Theme, Notifications, Private account, Privacy Center, Security, Account Status, Help |
| `src/locales/extra.js` | `Dark`, `Light`, `System default`, `Choose how Nexora looks on this device.` |
| `src/version.js` | `v4.4` — matches the live deploy |
| Live site (cache-busted fetch) | Confirmed the deployed build reads **v4.4** |
| `public/mascot.png` | The real app icon |

## Regenerating

```bash
pip install --break-system-packages pillow fonttools arabic-reshaper python-bidi
python3 scripts/make-store-shots-en.py
```

Fonts (both variable) go to `/tmp/fonts/`:

```bash
gh api "repos/google/fonts/contents/ofl/inter/Inter%5Bopsz,wght%5D.ttf" \
  -H "Accept: application/vnd.github.raw" > /tmp/fonts/Inter.ttf
gh api "repos/google/fonts/contents/ofl/notosansarabic/NotoSansArabic%5Bwdth,wght%5D.ttf" \
  -H "Accept: application/vnd.github.raw" > /tmp/fonts/NotoSansArabic.ttf
```

## Technical notes

- **These are rendered, not captured.** Chromium cannot run in this build environment — it needs `libnss3`, `libgbm1`, `libpango` (not installed), there is no root, and the Debian mirrors are unreachable, so `apt` fails. The screens are drawn at the app's real colors and metrics instead of photographed from the running app.
- **Inter has no Arabic.** Arabic strings are shaped with `arabic_reshaper` + `python-bidi` (Pillow here is built without `raqm`/HarfBuzz) and drawn with Noto Sans Arabic, which covers all presentation forms — Tajawal was missing 10 of them and rendered empty boxes.
- **`base_dir='R'` is required** in `get_display`, otherwise lines starting with a Latin word flip direction.
- **No emoji.** Inter ships no emoji glyphs, so a glyph like 🎨 renders as an empty box; the chat copy avoids them.
- **Variable-font axes** are set with `set_variation_by_axes`: Inter `[opsz, wght]`, Noto Sans Arabic `[wght, wdth]`.
- **English layout is LTR throughout** — the user's bubble sits right, the assistant's left, and icon-plus-text rows read left to right.
