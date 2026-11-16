/* ============================================================================
   NEXORA — Google Docs & Google Drive Manager
   Real Google Docs v1 read, create, edit, append & find/replace + Google Drive
   v3 search, upload, folder creation, rename & trash — no mock files anywhere.
   ============================================================================ */

import { useCallback, useEffect, useState } from 'react';
import { useStudio } from './state.jsx';
import {
  IconDoc, IconDrive, IconX, IconSearch, IconPlus, IconRefresh,
  IconExternal, IconPencil, IconTrash, IconCheck, IconFolder,
} from './icons.jsx';

export default function DocsModal({ onAttachDoc }) {
  const {
    docsModalOpen, setDocsModalOpen, docsModalInit,
    accounts, session, connectOAuth, openSettings,
    searchDriveFiles, manageDrive, readDriveDoc,
    readGoogleDoc, createGoogleDoc, updateGoogleDoc,
    files, activeFile, addFile, notify,
  } = useStudio();

  const [mode, setMode] = useState('docs'); // 'docs' | 'create' | 'drive'
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  /* Active Google Doc editor */
  const [openDoc, setOpenDoc] = useState(null);
  const [docBody, setDocBody] = useState('');
  const [appendText, setAppendText] = useState('');
  const [findStr, setFindStr] = useState('');
  const [replaceStr, setReplaceStr] = useState('');
  const [editTool, setEditTool] = useState('edit'); // 'edit' | 'append' | 'replace'

  /* New Google Doc form */
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  /* Drive management */
  const [folderName, setFolderName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState('');

  const connected = Boolean(accounts?.google?.connected);
  const oauthReady = Boolean(session?.oauth?.google?.configured);

  useEffect(() => {
    if (!docsModalOpen) return;
    if (docsModalInit?.mode) setMode(docsModalInit.mode);
    if (docsModalInit?.title) setNewTitle(docsModalInit.title);
    if (docsModalInit?.content) setNewContent(docsModalInit.content);
  }, [docsModalOpen, docsModalInit]);

  const refreshList = useCallback(async (q = query, currentMode = mode) => {
    if (!connected || currentMode === 'create') return;
    setLoading(true);
    try {
      const res = await searchDriveFiles({
        q,
        kind: currentMode === 'docs' ? 'doc' : 'all',
      });
      setItems(res.files || []);
    } catch (e) {
      notify(e.detail || e.code || 'Could not list Google files', 'error');
    } finally {
      setLoading(false);
    }
  }, [connected, mode, notify, query, searchDriveFiles]);

  useEffect(() => {
    if (!docsModalOpen || !connected) return;
    if (mode === 'docs' || mode === 'drive') refreshList(query, mode);
  }, [docsModalOpen, connected, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!docsModalOpen) return null;

  const close = () => {
    setDocsModalOpen(false);
    setOpenDoc(null);
  };

  const handleOpenDoc = async (id) => {
    setBusy(`open:${id}`);
    try {
      const doc = await readGoogleDoc(id);
      setOpenDoc(doc);
      setDocBody(doc.text || '');
      setEditTool('edit');
    } catch (e) {
      notify(e.detail || e.code || 'Could not read document', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleSaveDoc = async () => {
    if (!openDoc) return;
    setBusy('save');
    try {
      if (editTool === 'edit') {
        await updateGoogleDoc({ id: openDoc.id, mode: 'overwrite', text: docBody });
        setOpenDoc((d) => (d ? { ...d, text: docBody } : d));
      } else if (editTool === 'append') {
        if (!appendText.trim()) return;
        await updateGoogleDoc({ id: openDoc.id, mode: 'append', text: appendText });
        const joined = docBody ? `${docBody}\n${appendText}` : appendText;
        setDocBody(joined);
        setAppendText('');
      } else if (editTool === 'replace') {
        if (!findStr) return;
        const res = await updateGoogleDoc({
          id: openDoc.id,
          mode: 'replace',
          find: findStr,
          replaceWith: replaceStr,
        });
        notify(`Replaced ${res?.occurrencesChanged ?? 0} occurrence(s)`, 'ok');
        const fresh = await readGoogleDoc(openDoc.id);
        setOpenDoc(fresh);
        setDocBody(fresh.text || '');
      }
    } catch (e) {
      notify(e.detail || e.code || 'Update failed', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleCreateDoc = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setBusy('create');
    try {
      const created = await createGoogleDoc({ title: newTitle.trim(), content: newContent });
      setNewTitle('');
      setNewContent('');
      setMode('docs');
      if (created?.id) {
        setOpenDoc({ id: created.id, title: created.title, text: newContent, url: created.url });
        setDocBody(newContent);
      }
      refreshList('', 'docs');
    } catch (err) {
      notify(err.detail || err.code || 'Could not create Google Doc', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleUploadActiveFile = async () => {
    if (!activeFile || typeof files?.[activeFile] !== 'string') {
      notify('Open a workspace file first to upload it to Drive', 'warn');
      return;
    }
    setBusy('upload');
    try {
      const name = activeFile.split('/').pop() || activeFile;
      await manageDrive({ action: 'upload', name, content: files[activeFile], mimeType: 'text/plain' });
      notify(`Uploaded ${name} to Google Drive`, 'ok');
      refreshList(query, 'drive');
    } catch (e) {
      notify(e.detail || e.code || 'Upload failed', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setBusy('folder');
    try {
      await manageDrive({ action: 'folder', name: folderName.trim() });
      setFolderName('');
      notify('Created folder in Google Drive', 'ok');
      refreshList(query, 'drive');
    } catch (err) {
      notify(err.detail || err.code || 'Folder creation failed', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleRename = async (id) => {
    if (!renameVal.trim()) { setRenamingId(null); return; }
    setBusy(`ren:${id}`);
    try {
      await manageDrive({ action: 'rename', id, name: renameVal.trim() });
      setRenamingId(null);
      notify('Renamed in Google Drive', 'ok');
      refreshList(query, mode);
    } catch (e) {
      notify(e.detail || e.code || 'Rename failed', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleTrash = async (id, name) => {
    setBusy(`del:${id}`);
    try {
      await manageDrive({ action: 'trash', id });
      setItems((prev) => prev.filter((f) => f.id !== id));
      if (openDoc?.id === id) setOpenDoc(null);
      notify(`Moved “${name}” to Drive trash`, 'ok');
    } catch (e) {
      notify(e.detail || e.code || 'Delete failed', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleImportToWorkspace = async (item) => {
    setBusy(`imp:${item.id}`);
    try {
      const doc = item.kind === 'doc' ? await readGoogleDoc(item.id) : await readDriveDoc(item.id);
      const base = String(doc.title || doc.name || 'document')
        .replace(/[^\w.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'document';
      const filename = /\.\w{1,5}$/.test(base) ? base : `${base}.md`;
      addFile(filename, doc.markdown || doc.text || '');
      close();
    } catch (e) {
      notify(e.detail || e.code || 'Could not import file', 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="nxs-modal-backdrop" role="dialog" aria-modal="true" aria-label="Google Docs and Drive" onClick={close}>
      <div className="nxs-modal wide" onClick={(e) => e.stopPropagation()}>
        <header className="nxs-modal-head">
          <div>
            <h2 className="nxs-serif">Google Docs &amp; Drive</h2>
            {connected && accounts?.google?.email && (
              <p className="nxs-modal-sub">Connected as {accounts.google.email}</p>
            )}
          </div>
          <button type="button" className="nxs-icon-btn" aria-label="Close" onClick={close}>
            <IconX size={17} />
          </button>
        </header>

        {!connected ? (
          <div className="nxs-modal-body">
            <div className="nxs-empty-connect">
              <div className="nxs-empty-connect-icons">
                <IconDoc size={22} />
                <IconDrive size={22} />
              </div>
              <h3>Connect Google Docs &amp; Drive</h3>
              <p>Read, create, and edit real Google Docs, browse and manage Drive files, attach documents as AI context, and export projects directly.</p>
              <div className="nxs-row-gap">
                {oauthReady && (
                  <button
                    type="button"
                    className="nxs-btn primary"
                    onClick={() => connectOAuth('google').catch((e) => notify(e.detail || e.code, 'error'))}
                  >
                    Continue with Google (OAuth)
                  </button>
                )}
                <button
                  type="button"
                  className={`nxs-btn${oauthReady ? '' : ' primary'}`}
                  onClick={() => { close(); openSettings('integrations'); }}
                >
                  Connect in Integrations
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="nxs-modal-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'docs'}
                className={`nxs-modal-tab${mode === 'docs' ? ' active' : ''}`}
                onClick={() => { setOpenDoc(null); setMode('docs'); }}
              >
                <IconDoc size={14} /> Google Docs
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'create'}
                className={`nxs-modal-tab${mode === 'create' ? ' active' : ''}`}
                onClick={() => { setOpenDoc(null); setMode('create'); }}
              >
                <IconPlus size={14} /> New Doc
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'drive'}
                className={`nxs-modal-tab${mode === 'drive' ? ' active' : ''}`}
                onClick={() => { setOpenDoc(null); setMode('drive'); }}
              >
                <IconDrive size={14} /> Google Drive
              </button>
            </div>

            <div className="nxs-modal-body">
              {/* CREATE NEW GOOGLE DOC */}
              {mode === 'create' && (
                <form className="nxs-docs-form" onSubmit={handleCreateDoc}>
                  <div className="nxs-field">
                    <label htmlFor="nxs-doc-title">Document Title</label>
                    <input
                      id="nxs-doc-title"
                      type="text"
                      dir="auto"
                      placeholder="e.g. Product Specification"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="nxs-field">
                    <div className="nxs-field-row">
                      <label htmlFor="nxs-doc-content">Content</label>
                      {activeFile && files?.[activeFile] && (
                        <button
                          type="button"
                          className="nxs-mini-btn ghost"
                          onClick={() => {
                            if (!newTitle) setNewTitle(activeFile);
                            setNewContent(files[activeFile]);
                          }}
                        >
                          Fill from {activeFile}
                        </button>
                      )}
                    </div>
                    <textarea
                      id="nxs-doc-content"
                      rows={9}
                      dir="auto"
                      placeholder="Write or paste document content..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                    />
                  </div>
                  <div className="nxs-row-gap end">
                    <button type="submit" className="nxs-btn primary" disabled={!newTitle.trim() || busy === 'create'}>
                      {busy === 'create' ? 'Creating in Google Docs…' : 'Create Google Doc'}
                    </button>
                  </div>
                </form>
              )}

              {/* EDIT OPEN GOOGLE DOC */}
              {mode === 'docs' && openDoc && (
                <div className="nxs-doc-editor">
                  <div className="nxs-doc-editor-head">
                    <div>
                      <strong dir="auto">{openDoc.title}</strong>
                      {openDoc.url && (
                        <a href={openDoc.url} target="_blank" rel="noreferrer" className="nxs-inline-link">
                          Open in Docs <IconExternal size={12} />
                        </a>
                      )}
                    </div>
                    <div className="nxs-row-gap">
                      {onAttachDoc && (
                        <button
                          type="button"
                          className="nxs-mini-btn"
                          onClick={() => {
                            onAttachDoc({ id: openDoc.id, name: openDoc.title, url: openDoc.url, text: docBody });
                            close();
                          }}
                        >
                          Attach to Chat
                        </button>
                      )}
                      <button type="button" className="nxs-mini-btn ghost" onClick={() => setOpenDoc(null)}>
                        All Docs
                      </button>
                    </div>
                  </div>

                  <div className="nxs-filter-row">
                    {[
                      { id: 'edit', label: 'Edit Full Document' },
                      { id: 'append', label: 'Append Section' },
                      { id: 'replace', label: 'Find & Replace' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`nxs-filter-pill${editTool === t.id ? ' active' : ''}`}
                        onClick={() => setEditTool(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {editTool === 'edit' && (
                    <textarea
                      className="nxs-doc-textarea"
                      aria-label="Google Doc body"
                      dir="auto"
                      rows={11}
                      value={docBody}
                      onChange={(e) => setDocBody(e.target.value)}
                    />
                  )}

                  {editTool === 'append' && (
                    <textarea
                      className="nxs-doc-textarea"
                      aria-label="Text to append"
                      dir="auto"
                      rows={6}
                      placeholder="Text to append at the end of the Google Doc..."
                      value={appendText}
                      onChange={(e) => setAppendText(e.target.value)}
                    />
                  )}

                  {editTool === 'replace' && (
                    <div className="nxs-replace-grid">
                      <div className="nxs-field">
                        <label>Find text</label>
                        <input type="text" dir="auto" value={findStr} onChange={(e) => setFindStr(e.target.value)} placeholder="Old text..." />
                      </div>
                      <div className="nxs-field">
                        <label>Replace with</label>
                        <input type="text" dir="auto" value={replaceStr} onChange={(e) => setReplaceStr(e.target.value)} placeholder="New text..." />
                      </div>
                    </div>
                  )}

                  <div className="nxs-row-gap end">
                    <button type="button" className="nxs-btn primary" disabled={busy === 'save'} onClick={handleSaveDoc}>
                      {busy === 'save' ? 'Saving to Google Docs…' : editTool === 'append' ? 'Append to Doc' : editTool === 'replace' ? 'Replace in Doc' : 'Save to Google Docs'}
                    </button>
                  </div>
                </div>
              )}

              {/* LIST GOOGLE DOCS OR DRIVE FILES */}
              {((mode === 'docs' && !openDoc) || mode === 'drive') && (
                <div className="nxs-drive-browser">
                  <form
                    className="nxs-drive-searchbar"
                    onSubmit={(e) => { e.preventDefault(); refreshList(query, mode); }}
                  >
                    <IconSearch size={14} />
                    <input
                      type="search"
                      placeholder={mode === 'docs' ? 'Search Google Docs...' : 'Search Google Drive files...'}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button type="submit" className="nxs-mini-btn" disabled={loading}>Search</button>
                    <button type="button" className="nxs-icon-btn xs" aria-label="Refresh" onClick={() => refreshList(query, mode)}>
                      <IconRefresh size={13} />
                    </button>
                  </form>

                  {mode === 'drive' && (
                    <div className="nxs-drive-toolbar">
                      <form className="nxs-pop-inline" onSubmit={handleCreateFolder}>
                        <input
                          type="text"
                          placeholder="New folder name..."
                          value={folderName}
                          onChange={(e) => setFolderName(e.target.value)}
                        />
                        <button type="submit" className="nxs-mini-btn" disabled={!folderName.trim() || busy === 'folder'}>
                          <IconFolder size={12} /> New Folder
                        </button>
                      </form>
                      {activeFile && (
                        <button
                          type="button"
                          className="nxs-mini-btn primary"
                          disabled={busy === 'upload'}
                          onClick={handleUploadActiveFile}
                        >
                          {busy === 'upload' ? 'Uploading…' : `Upload ${activeFile.split('/').pop()}`}
                        </button>
                      )}
                    </div>
                  )}

                  {loading ? (
                    <div className="nxs-pop-empty">Loading from Google…</div>
                  ) : items.length === 0 ? (
                    <div className="nxs-pop-empty">
                      {mode === 'docs' ? 'No Google Docs found — click “New Doc” to create one.' : 'No files matched in Google Drive.'}
                    </div>
                  ) : (
                    <div className="nxs-drive-items">
                      {items.map((item) => (
                        <div key={item.id} className="nxs-drive-row">
                          {renamingId === item.id ? (
                            <div className="nxs-drive-rename">
                              <input
                                type="text"
                                value={renameVal}
                                onChange={(e) => setRenameVal(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRename(item.id);
                                  if (e.key === 'Escape') setRenamingId(null);
                                }}
                                autoFocus
                              />
                              <button type="button" className="nxs-icon-btn xs" onClick={() => handleRename(item.id)}>
                                <IconCheck size={13} />
                              </button>
                              <button type="button" className="nxs-icon-btn xs" onClick={() => setRenamingId(null)}>
                                <IconX size={13} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="nxs-drive-row-info">
                                <span className="nxs-drive-row-icon">
                                  {item.kind === 'doc' ? <IconDoc size={15} /> : item.kind === 'folder' ? <IconFolder size={15} /> : <IconDrive size={15} />}
                                </span>
                                <div className="nxs-drive-row-text">
                                  <span className="nxs-drive-row-name" dir="auto">{item.name}</span>
                                  <span className="nxs-drive-row-meta">
                                    {item.kind}{item.modifiedAt ? ` · ${new Date(item.modifiedAt).toLocaleDateString()}` : ''}
                                  </span>
                                </div>
                              </div>
                              <div className="nxs-drive-row-actions">
                                {item.kind === 'doc' && (
                                  <button
                                    type="button"
                                    className="nxs-mini-btn primary"
                                    disabled={busy === `open:${item.id}`}
                                    onClick={() => { setMode('docs'); handleOpenDoc(item.id); }}
                                  >
                                    {busy === `open:${item.id}` ? '…' : 'Read / Edit'}
                                  </button>
                                )}
                                {item.readable && (
                                  <button
                                    type="button"
                                    className="nxs-mini-btn"
                                    disabled={busy === `imp:${item.id}`}
                                    onClick={() => handleImportToWorkspace(item)}
                                  >
                                    Import
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="nxs-icon-btn xs"
                                  aria-label={`Rename ${item.name}`}
                                  title="Rename"
                                  onClick={() => { setRenamingId(item.id); setRenameVal(item.name); }}
                                >
                                  <IconPencil size={13} />
                                </button>
                                {item.url && (
                                  <a className="nxs-icon-btn xs" href={item.url} target="_blank" rel="noreferrer" title="Open in Google">
                                    <IconExternal size={13} />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  className="nxs-icon-btn xs danger"
                                  aria-label={`Trash ${item.name}`}
                                  title="Move to trash"
                                  onClick={() => handleTrash(item.id, item.name)}
                                >
                                  <IconTrash size={13} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
