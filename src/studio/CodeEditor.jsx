import { useEffect, useRef, useState } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { useStudio } from './state.jsx';
import { IconX, IconFolder, IconGit } from './icons.jsx';

const creamTheme = EditorView.theme({
  '&': { backgroundColor: '#fcfbf8', color: '#1f1e1a', height: '100%', fontSize: '13px' },
  '.cm-content': { caretColor: '#1a1915', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#1a1915', borderLeftWidth: '1.6px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'rgba(180, 146, 98, 0.22)' },
  '.cm-gutters': { backgroundColor: '#f6f4ee', color: '#9c968b', border: 'none', borderInlineEnd: '1px solid #e7e2d7' },
  '.cm-activeLineGutter': { backgroundColor: '#efece4', color: '#3f3c35' },
  '.cm-activeLine': { backgroundColor: 'rgba(26, 25, 21, 0.028)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 12px', minWidth: '38px' },
  '.cm-foldPlaceholder': { background: '#efece4', border: '1px solid #d9d3c5', color: '#57534e' },
  '.cm-panels': { background: '#f4f2ec', color: '#1a1915', borderBottom: '1px solid #e5e1d8' },
  '.cm-searchMatch': { backgroundColor: 'rgba(217, 119, 6, 0.22)' },
  '.cm-selectionMatch': { backgroundColor: 'rgba(21, 128, 61, 0.14)' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(26, 25, 21, 0.1)', outline: '1px solid rgba(26, 25, 21, 0.25)' },
  '.cm-tooltip': { background: '#ffffff', border: '1px solid #ded9ce', color: '#1a1915' },
}, { dark: false });

const creamHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#7c2d92', fontWeight: '500' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#1f1e1a' },
  { tag: [t.function(t.variableName), t.labelName], color: '#1d4ed8' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#b45309' },
  { tag: [t.definition(t.name), t.separator], color: '#292524' },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#9a3412' },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#0f766e' },
  { tag: [t.meta, t.comment], color: '#8a8479', fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#1d4ed8', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: '700', color: '#1a1915' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#b45309' },
  { tag: [t.processingInstruction, t.string, t.inserted], color: '#15803d' },
  { tag: t.invalid, color: '#b91c1c' },
  { tag: t.tagName, color: '#9f1239' },
  { tag: t.attributeName, color: '#92400e' },
]);

const darkTheme = EditorView.theme({
  '&': { backgroundColor: '#141413', color: '#e7e5df', height: '100%', fontSize: '13px' },
  '.cm-content': { caretColor: '#faf9f5', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#faf9f5' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'rgba(217, 119, 69, 0.28)' },
  '.cm-gutters': { backgroundColor: '#141413', color: '#6b675f', border: 'none', borderInlineEnd: '1px solid #262522' },
  '.cm-activeLineGutter': { backgroundColor: '#1d1c1a', color: '#b5b0a6' },
  '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 12px', minWidth: '38px' },
  '.cm-panels': { background: '#1c1b19', color: '#e7e5df' },
  '.cm-tooltip': { background: '#1f1e1b', border: '1px solid #33312c', color: '#e7e5df' },
}, { dark: true });

const darkHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#d8b4fe' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#e7e5df' },
  { tag: [t.function(t.variableName), t.labelName], color: '#93c5fd' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#fcd34d' },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#fdba74' },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#5eead4' },
  { tag: [t.meta, t.comment], color: '#78736a', fontStyle: 'italic' },
  { tag: t.heading, fontWeight: '700', color: '#faf9f5' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#fcd34d' },
  { tag: [t.processingInstruction, t.string, t.inserted], color: '#86efac' },
  { tag: t.invalid, color: '#fca5a5' },
  { tag: t.tagName, color: '#fda4af' },
  { tag: t.attributeName, color: '#fcd34d' },
]);

function languageFor(path) {
  const ext = (path?.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  switch (ext) {
    case 'jsx': return javascript({ jsx: true });
    case 'tsx': return javascript({ jsx: true, typescript: true });
    case 'ts': return javascript({ typescript: true });
    case 'js':
    case 'mjs':
    case 'cjs': return javascript();
    case 'html': return html();
    case 'css': return css();
    case 'json': return json();
    case 'md':
    case 'mdx': return markdown();
    default: return [];
  }
}

const themeBundle = (mode) => (mode === 'dark'
  ? [syntaxHighlighting(darkHighlight), darkTheme]
  : [syntaxHighlighting(creamHighlight), creamTheme]);

export default function CodeEditor({ onToggleFiles }) {
  const {
    project, files, activeFile, setActiveFile, openFiles, setOpenFiles,
    writeFile, dirty, theme, accounts, commitFileToGithub, notify,
  } = useStudio();
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const langRef = useRef(new Compartment());
  const themeRef = useRef(new Compartment());
  const [committing, setCommitting] = useState(false);

  const content = activeFile ? (files[activeFile] ?? '') : '';
  const linkedRepo = project?.meta?.repo || '';
  const canCommitFile = Boolean(activeFile && linkedRepo && accounts?.github?.connected);

  /* Mount CodeMirror once when activeFile becomes non-null */
  useEffect(() => {
    if (!activeFile || !hostRef.current || viewRef.current) return undefined;
    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        themeRef.current.of(themeBundle(theme)),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
        EditorView.lineWrapping,
        langRef.current.of(languageFor(activeFile)),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const path = viewRef.current?.__nxsPath;
          if (!path) return;
          writeFile(path, update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    view.__nxsPath = activeFile;
    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(activeFile)]);

  /* Live theme switching (Cream ↔ Dark) */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: themeRef.current.reconfigure(themeBundle(theme)) });
  }, [theme]);

  /* Sync external edits (AI writes, diff rejects) without jumping cursor */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.__nxsPath = activeFile;
    const current = view.state.doc.toString();
    if (current !== content) {
      const cursor = Math.min(view.state.selection.main.head, content.length);
      view.dispatch({ changes: { from: 0, to: current.length, insert: content }, selection: { anchor: cursor } });
    }
  }, [activeFile, content]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: langRef.current.reconfigure(languageFor(activeFile)) });
    view.scrollDOM.scrollTop = 0;
  }, [activeFile]);

  const tabs = openFiles.filter((p) => files[p] !== undefined);
  const closeTab = (path) => {
    const next = tabs.filter((p) => p !== path);
    setOpenFiles(next);
    if (activeFile === path) setActiveFile(next[next.length - 1] || null);
  };

  const handleCommitSingle = async () => {
    if (!canCommitFile || committing) return;
    setCommitting(true);
    try {
      await commitFileToGithub({ path: activeFile, content });
    } catch (e) {
      notify(e.detail || e.code || 'GitHub save failed', 'error');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="nxs-editor">
      <div className="nxs-editor-tabs" role="tablist">
        {onToggleFiles && (
          <button
            type="button"
            className="nxs-editor-files-btn"
            aria-label="Toggle file list"
            onClick={onToggleFiles}
          >
            <IconFolder size={13} />
            <span>Files</span>
          </button>
        )}
        <div className="nxs-editor-tabs-scroll">
          {tabs.map((path) => (
            <div
              key={path}
              className={`nxs-editor-tab${activeFile === path ? ' active' : ''}`}
              role="tab"
              aria-selected={activeFile === path}
            >
              <button type="button" className="nxs-editor-tab-name" onClick={() => setActiveFile(path)} title={path}>
                {path.split('/').pop()}
              </button>
              {dirty[path] && <span className="dirty" title="Unsaved changes" />}
              <button type="button" className="nxs-editor-tab-x" aria-label={`Close ${path}`} onClick={() => closeTab(path)}>
                <IconX size={11} />
              </button>
            </div>
          ))}
        </div>
        {canCommitFile && (
          <button
            type="button"
            className="nxs-mini-btn editor-commit"
            disabled={committing}
            title={`Commit ${activeFile} to ${linkedRepo}${project?.meta?.branch ? `@${project.meta.branch}` : ''}`}
            onClick={handleCommitSingle}
          >
            <IconGit size={12} />
            <span>{committing ? 'Saving…' : 'Commit file'}</span>
          </button>
        )}
      </div>

      {activeFile ? (
        <div className="nxs-cm" ref={hostRef} />
      ) : (
        <div className="nxs-editor-empty">
          <div>
            <b>No file selected</b>
            <p>Choose a file from the explorer, or ask NEXORA to create one.</p>
          </div>
        </div>
      )}
    </div>
  );
}
