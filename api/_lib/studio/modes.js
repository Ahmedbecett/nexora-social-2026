/* ============================================================================
   NEXORA Studio — build modes
   ----------------------------------------------------------------------------
   One source of truth, imported by BOTH the serverless API and the browser, so
   the composer can never advertise a behaviour the agent does not have.

   Every field changes something real:
     plan      the agent declares a plan before writing any file
     batch     how many complete files one request may write (server clamps 1–5)
     rounds    hard ceiling on how many requests one build may take
     retries   how many times an interrupted round is retried automatically
     temp      model temperature for this mode
     parts     how many append sections long-text mode writes
     append    files arrive as appended sections instead of whole files
   ============================================================================ */

import { normalizePath, appendPart } from './files.js';

export { appendPart };

export const BUILD_MODES = [
  {
    id: 'direct',
    label: 'Direct',
    ar: 'مباشر',
    icon: 'spark',
    hint: 'No plan — write the files and open the preview immediately.',
    plan: false,
    batch: 4,
    rounds: 8,
    retries: 2,
    temp: 0.25,
    append: false,
    parts: 0,
  },
  {
    id: 'fast',
    label: 'Fast',
    ar: 'سريع',
    icon: 'play',
    hint: 'Big batches (5 files) and fewer rounds — quickest first draft.',
    plan: true,
    batch: 5,
    rounds: 5,
    retries: 2,
    temp: 0.3,
    append: false,
    parts: 0,
  },
  {
    id: 'precise',
    label: 'Precise',
    ar: 'دقيق',
    icon: 'check',
    hint: 'Plan first, then 3 files per round until the plan is complete.',
    plan: true,
    batch: 3,
    rounds: 12,
    retries: 3,
    temp: 0.25,
    append: false,
    parts: 0,
  },
  {
    id: 'endless',
    label: 'No stop',
    ar: 'بدون توقف',
    icon: 'refresh',
    hint: 'Never gives up: keeps requesting the missing files and resumes after any cut.',
    plan: true,
    batch: 3,
    rounds: 30,
    retries: 8,
    temp: 0.25,
    append: false,
    parts: 0,
  },
  {
    id: 'text',
    label: 'Long text',
    ar: 'نص طويل',
    icon: 'file',
    hint: 'Writes articles, docs and stories in sequential sections that are appended to one file.',
    plan: false,
    batch: 1,
    rounds: 30,
    retries: 4,
    temp: 0.45,
    append: true,
    parts: 4,
  },
  {
    id: 'review',
    label: 'Review',
    ar: 'مراجعة',
    icon: 'eye',
    hint: 'Build like Precise, then really run the project and fix what fails.',
    plan: true,
    batch: 3,
    rounds: 12,
    retries: 3,
    temp: 0.25,
    append: false,
    parts: 0,
    review: true,
  },
];

export const DEFAULT_BUILD_MODE = 'precise';

/** Never throws: an unknown id falls back to the default mode. */
export function buildModeConfig(id) {
  const want = String(id || '').trim().toLowerCase();
  return BUILD_MODES.find((m) => m.id === want)
    || BUILD_MODES.find((m) => m.id === DEFAULT_BUILD_MODE);
}

export function buildModeIds() {
  return BUILD_MODES.map((m) => m.id);
}

/** A stable, safe markdown path for long-form text requests. */
export function textTargetPath(message, fallback = 'document.md') {
  const raw = String(message || '').toLowerCase();
  const named = /([a-z0-9_-]{3,40})\.(md|txt|markdown)/.exec(raw);
  if (named) return normalizePath(`${named[1]}.${named[2]}`) || fallback;
  /* \b is ASCII-only, so Arabic words are matched with includes() */
  if (/\barticles?\b/.test(raw) || raw.includes('مقال')) return 'article.md';
  if (/\bstory\b/.test(raw) || raw.includes('قصة')) return 'story.md';
  if (/\bposts?\b/.test(raw) || raw.includes('منشور')) return 'post.md';
  if (/\breports?\b/.test(raw) || raw.includes('تقرير')) return 'report.md';
  if (/\breadme\b/.test(raw) || raw.includes('توثيق') || raw.includes('دليل')) return 'README.md';
  return fallback;
}
