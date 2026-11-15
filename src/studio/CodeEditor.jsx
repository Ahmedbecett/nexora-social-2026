import { useEffect, useRef } from 'react';
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
import { IconX } from './icons.jsx';

const theme = EditorView.theme({
  '&': { backgroundColor: '#07080b', color: '#dfe4ee', height: '100%' },
  '.cm-content': { caretColor: '#a78bfa', padding: '10px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#a78bfa' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'rgba(124,92,255,.28)' },
  '.cm-gutters': { backgroundColor: '#07080b', color: '#454e63', border: 'none', borderInlineEnd: '1px solid #212634' },
  '.cm-activeLineGutter': { backgroundColor: '#0f121a', color: '#a9b2c4' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,.022)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 12px', minWidth: '38px' },
  '.cm-foldPlaceholder': { background: '#141822', border: '1px solid #2b3142', color: '#a9b2c4' },
  '.cm-panels': { background: '#0f121a', color: '#e9ecf4' },
  '.cm-searchMatch': { backgroundColor: 'rgba(124,92,255,.3)' },
  '.cm-selectionMatch': { backgroundColor: 'rgba(45,212,191,.18)' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(124,92,255,.25)', outline: '1px solid rgba(124,92,255,.5)' },
  '.cm-tooltip': { background: '#141822', border: '1px solid #2b3142' },
}, { dark: true });

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: '#c084fc' },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#e9ecf4' },
  { tag: [t.function(t.variableName), t.labelName], color: '#7dd3fc' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#fbbf24' },
  { tag: [t.definition(t.name), t.separator], color: '#e9ecf4' },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: '#f0abfc' },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: '#67e8f9' },
  { tag: [t.meta, t.comment], color: '#5b6478', fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#a78bfa', textDecoration: 'underline' },
  { tag: t.heading, fontWeight: '700', color: '#a78bfa' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#fbbf24' },
  { tag: [t.processingInstruction, t.string, t.inserted], color: '#86efac' },
  { tag: t.invalid, color: '#fb7185' },
  { tag: t.tagName, color: '#f472b6' },
  { tag: t.attributeName, color: '#fbbf24' },
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

export default function CodeEditor() {
  const { files, activeFile, setActiveFile, openFiles, setOpenFiles, writeFile, dirty } = useStudio();
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const langRef = useRef(new Compartment());
  const content = activeFile ? (files[activeFile] ?? '') : '';

  /* create the editor once */
  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;
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
        syntaxHighlighting(highlight),
        theme,
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
  }, []);

  /* reload external changes (agent writes, editor sync) without moving the caret */
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

  /* switching files: new language + start at the top */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: langRef.current.reconfigure(languageFor(activeFile)) });
    view.scrollDOM.scrollTop = 0;
    if (activeFile) view.focus();
  }, [activeFile]);

  const tabs = openFiles.filter((p) => files[p] !== undefined);
  const closeTab = (path) => {
    const next = tabs.filter((p) => p !== path);
    setOpenFiles(next);
    if (activeFile === path) setActiveFile(next[next.length - 1] || null);
  };

  return (
    <div className="nxs-editor">
      {tabs.length > 0 && (
        <div className="nxs-editor-tabs" role="tablist">
          {tabs.map((path) => (
            <div key={path} className={`nxs-editor-tab ${activeFile === path ? 'active' : ''}`} role="tab" aria-selected={activeFile === path}>
              <button onClick={() => setActiveFile(path)} style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {path.split('/').pop()}
              </button>
              {dirty[path] && <span className="dirty" title="Unsaved changes" />}
              <button onClick={() => closeTab(path)} title="Close"><IconX size={11} /></button>
            </div>
          ))}
        </div>
      )}
      {activeFile ? (
        <div className="nxs-cm" ref={hostRef} />
      ) : (
        <div className="nxs-editor-empty">
          <div>
            <b>No file open</b><br />
            Pick a file in the explorer, or ask the agent to create one.
          </div>
        </div>
      )}
    </div>
  );
}
