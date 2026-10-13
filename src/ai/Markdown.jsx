/* عرض إجابات النموذج بتنسيق Markdown حقيقي: عناوين · جداول · قوائم · أكواد ملوّنة · معادلات LaTeX */
import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';
import renderMathInElement from 'katex/contrib/auto-render';
import 'highlight.js/styles/atom-one-dark.css';
import 'katex/dist/katex.min.css';

const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function Markdown({ text }) {
  const ref = useRef(null);
  const html = useMemo(() => {
    let raw;
    try {
      raw = marked.parse(String(text || ''), { gfm: true, breaks: true });
    } catch {
      raw = escapeHtml(text).replace(/\n/g, '<br/>');
    }
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /* 1) تلوين الأكواد + زر نسخ لكل كتلة */
    el.querySelectorAll('pre code').forEach((code) => {
      if (!code.dataset.nxHl) {
        code.dataset.nxHl = '1';
        try { hljs.highlightElement(code); } catch { /* تبقى نصًا عاديًا */ }
      }
      const pre = code.parentElement;
      if (pre && pre.tagName === 'PRE' && !(pre.parentElement && pre.parentElement.classList.contains('nx-md-code'))) {
        const wrap = document.createElement('div');
        wrap.className = 'nx-md-code';
        const bar = document.createElement('div');
        bar.className = 'nx-md-code-bar';
        const lang = (String(code.className).match(/language-([\w-]+)/) || [])[1] || 'code';
        const tag = document.createElement('span');
        tag.textContent = lang;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'نسخ';
        btn.addEventListener('click', () => {
          navigator.clipboard.writeText(code.innerText || '').then(() => {
            btn.textContent = '✓ تم النسخ';
            setTimeout(() => { btn.textContent = 'نسخ'; }, 1400);
          }).catch(() => { btn.textContent = 'تعذر النسخ'; });
        });
        bar.appendChild(tag); bar.appendChild(btn);
        p_guard: {
          const parent = pre.parentElement;
          if (!parent) break p_guard;
          parent.insertBefore(wrap, pre);
          wrap.appendChild(bar);
          wrap.appendChild(pre);
        }
      }
    });

    /* 2) المعادلات الرياضية (LaTeX): $..$ و $$..$$ و \(..\) و \[..\] */
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        errorColor: '#ff9aa8',
      });
    } catch { /* الرياضيات إضافة — لا تُفشل العرض */ }
  }, [html]);

  return <div className="nx-md" ref={ref} dir="auto" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* أداة مساعدة للاختبارات: تحويل نص إلى HTML معقّم دون React */
export function markdownToHtml(text) {
  try {
    const raw = marked.parse(String(text || ''), { gfm: true, breaks: true });
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
  } catch { return escapeHtml(text); }
}

export { katex };
