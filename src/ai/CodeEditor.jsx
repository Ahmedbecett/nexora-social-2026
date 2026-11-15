/**
 * محرر كود NEXORA Studio.
 *
 * لماذا لم نستخدم <textarea> عارياً كما كان؟
 *  - كان النص بلا ألوان، وبلا إزاحة أسطر متزامنة، وبلا إزاحة تلقائية،
 *    وبدون تمرير أفقي حقيقي على شاشات Android الصغيرة.
 *
 * الحل هنا (بدون إضافة حزم ثقيلة مثل Monaco إلى الحزمة):
 *  - طبقتان متطابقتان في المقاسات: <pre> ملوّن بـ highlight.js، و<textarea> شفاف
 *    فوقه يحمل المؤشر والتحرير. تمرير واحد يُزامن الطبقتين وعمود الأرقام.
 *  - white-space: pre + wrap="off" ⇒ لا التفاف للأسطر الطويلة، تمرير أفقي.
 *  - Tab/Shift+Tab لإزاحة الكتلة، Enter يُكمل الإزاحة تلقائياً،
 *    Ctrl/Cmd+S للحفظ، Ctrl/Cmd+Z / Shift+Z / Y للتراجع والإعادة.
 *  - المحرر دائماً LTR معزول (direction:ltr; unicode-bidi:isolate) حتى لو كانت
 *    واجهة التطبيق عربية RTL — الكود لا يُقلَب أبداً.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import bash from 'highlight.js/lib/languages/bash';
import { escapeHtml, highlightLang } from './studioPreview.js';

hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('bash', bash);

const INDENT = '  ';
const MAX_HIGHLIGHT = 120000;
const HISTORY_GROUP_MS = 700;
const HISTORY_LIMIT = 200;

/** تلوين الكود — يُصدَّر للاختبارات أيضاً. */
export function highlightCode(code, fileName) {
  const src = String(code ?? '');
  if (!src) return '';
  if (src.length > MAX_HIGHLIGHT) return escapeHtml(src);
  const language = highlightLang(fileName);
  if (!language) return escapeHtml(src);
  try {
    return hljs.highlight(src, { language, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(src);
  }
}

export default function CodeEditor({ value = '', onChange, fileName = '', onSave, label }) {
  const taRef = useRef(null);
  const preRef = useRef(null);
  const gutterRef = useRef(null);
  const pendingSel = useRef(null);
  const fileRef = useRef(fileName);
  const histRef = useRef({ stack: [{ v: String(value), s: 0, e: 0 }], idx: 0, last: 0 });

  const text = String(value ?? '');
  const lineCount = useMemo(() => text.split('\n').length, [text]);
  const highlighted = useMemo(() => highlightCode(text, fileName), [text, fileName]);

  // ملف آخر ⇒ تاريخ تراجع جديد (لا تختلط تعديلات ملفين)
  useEffect(() => {
    if (fileRef.current === fileName) return;
    fileRef.current = fileName;
    histRef.current = { stack: [{ v: String(value), s: 0, e: 0 }], idx: 0, last: 0 };
  }, [fileName, value]);

  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  }, []);

  // إعادة ضبط المؤشر بعد أي تعديل برمجي (Tab/Enter/تراجع)
  useLayoutEffect(() => {
    const sel = pendingSel.current;
    if (!sel) return;
    pendingSel.current = null;
    const ta = taRef.current;
    if (!ta) return;
    ta.focus({ preventScroll: true });
    const max = ta.value.length;
    ta.setSelectionRange(Math.min(sel[0], max), Math.min(sel[1] ?? sel[0], max));
    syncScroll();
  }, [value, syncScroll]);

  useLayoutEffect(() => {
    syncScroll();
  }, [text, syncScroll]);

  const record = (nextValue, selStart, selEnd) => {
    const h = histRef.current;
    const now = Date.now();
    if (now - h.last > HISTORY_GROUP_MS) {
      h.stack = h.stack.slice(0, h.idx + 1);
      h.stack.push({ v: nextValue, s: selStart, e: selEnd });
      if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
      h.idx = h.stack.length - 1;
    } else {
      h.stack[h.idx] = { v: nextValue, s: selStart, e: selEnd };
    }
    h.last = now;
  };

  const commit = (nextValue, selStart, selEnd) => {
    record(nextValue, selStart, selEnd);
    pendingSel.current = [selStart, selEnd ?? selStart];
    onChange?.(nextValue);
  };

  const undo = () => {
    const h = histRef.current;
    if (h.idx <= 0) return;
    h.idx -= 1;
    const entry = h.stack[h.idx];
    pendingSel.current = [entry.s ?? 0, entry.e ?? 0];
    h.last = 0;
    onChange?.(entry.v);
  };

  const redo = () => {
    const h = histRef.current;
    if (h.idx >= h.stack.length - 1) return;
    h.idx += 1;
    const entry = h.stack[h.idx];
    pendingSel.current = [entry.s ?? 0, entry.e ?? 0];
    h.last = 0;
    onChange?.(entry.v);
  };

  const handleChange = (e) => {
    const ta = e.currentTarget;
    record(ta.value, ta.selectionStart, ta.selectionEnd);
    onChange?.(ta.value);
  };

  const indentBlock = (outdent) => {
    const ta = taRef.current;
    if (!ta) return;
    const src = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end && !outdent) {
      const next = src.slice(0, start) + INDENT + src.slice(end);
      commit(next, start + INDENT.length);
      return;
    }
    const lineStart = src.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const nextBreak = src.indexOf('\n', end);
    const lineEnd = nextBreak === -1 ? src.length : nextBreak;
    const block = src.slice(lineStart, lineEnd);
    const updated = outdent
      ? block.split('\n').map((l) => l.replace(/^(\t| {1,2})/, '')).join('\n')
      : block.split('\n').map((l) => INDENT + l).join('\n');
    const next = src.slice(0, lineStart) + updated + src.slice(lineEnd);
    const delta = updated.length - block.length;
    commit(
      next,
      start === end ? start + delta : Math.max(lineStart, start + delta),
      Math.max(lineStart, end + delta),
    );
  };

  const newlineWithIndent = () => {
    const ta = taRef.current;
    if (!ta) return;
    const src = ta.value;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = src.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineBefore = src.slice(lineStart, start);
    const indent = (lineBefore.match(/^[ \t]*/) || [''])[0];
    const opensBlock = /[{([]\s*$/.test(lineBefore);
    const nextChar = src.slice(end, end + 1);
    const closesSoon = /[})\]]/.test(nextChar);
    const insert = '\n' + indent + (opensBlock ? INDENT : '') + (opensBlock && closesSoon ? '\n' + indent : '');
    const next = src.slice(0, start) + insert + src.slice(end);
    const caret = start + 1 + indent.length + (opensBlock ? INDENT.length : 0);
    commit(next, caret);
  };

  const handleKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;

    if (mod && !e.altKey && (key === 's' || key === 'S')) {
      e.preventDefault();
      onSave?.();
      return;
    }
    if (mod && !e.altKey && (key === 'z' || key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && !e.altKey && (key === 'y' || key === 'Y')) {
      e.preventDefault();
      redo();
      return;
    }
    if (key === 'Tab') {
      e.preventDefault();
      indentBlock(e.shiftKey);
      return;
    }
    if (key === 'Enter' && !mod && !e.altKey) {
      e.preventDefault();
      newlineWithIndent();
    }
  };

  const digits = String(lineCount).length;

  return (
    <div className="nx-code" dir="ltr" data-lang={fileName}>
      <div
        className="nx-code-gutter"
        ref={gutterRef}
        aria-hidden="true"
        style={{ minWidth: `calc(${digits}ch + 18px)` }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <div className="nx-code-main">
        <pre className="nx-code-highlight" ref={preRef} aria-hidden="true">
          <code dangerouslySetInnerHTML={{ __html: highlighted + '\n' }} />
        </pre>
        <textarea
          ref={taRef}
          className="nx-code-input"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="off"
          dir="ltr"
          aria-label={label || fileName || 'code editor'}
          placeholder="<!-- اكتب الكود هنا / type code here -->"
        />
      </div>
    </div>
  );
}
