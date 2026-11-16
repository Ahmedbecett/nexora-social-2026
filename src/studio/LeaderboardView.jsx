/* ============================================================================
   NEXORA — Model Leaderboard
   Live telemetry from real NEXORA runs, measured provider API latency probes,
   and user ratings on assistant responses — zero synthetic or fake numbers.
   ============================================================================ */

import { useCallback, useEffect, useState } from 'react';
import { useStudio } from './state.jsx';
import { request } from './api.js';
import {
  IconTrophy, IconRefresh, IconCheck, IconSpark, IconArrowLeft, IconPlug,
} from './icons.jsx';

export default function LeaderboardView() {
  const {
    modelPref, setModelPref, setActiveView, openSettings, testModel, notify,
  } = useStudio();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all | configured | vision
  const [probing, setProbing] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await request('studio/leaderboard', { timeout: 25_000 });
      setData(res);
    } catch (e) {
      setError(e.detail || e.code || 'Could not load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleProbe = async (entry) => {
    setProbing(`${entry.provider}::${entry.model}`);
    try {
      const res = await testModel(entry.provider, undefined, entry.model);
      if (res.ok) {
        notify(`${entry.providerLabel} (${res.model}) answered in ${res.latency}ms`, 'ok');
      } else {
        notify(`${entry.providerLabel}: ${res.error || 'test failed'}`, 'error');
      }
      await load();
    } catch (e) {
      notify(`${entry.providerLabel}: ${e.detail || e.code}`, 'error');
    } finally {
      setProbing('');
    }
  };

  const handleSelectModel = (entry) => {
    setModelPref({ provider: entry.provider, model: entry.model });
    setActiveView('chat');
    notify(`Active model set to ${entry.model} (${entry.providerLabel})`, 'ok');
  };

  const entries = (data?.entries || []).filter((e) => {
    if (filter === 'configured') return e.configured;
    if (filter === 'vision') return e.vision;
    return true;
  });

  return (
    <div className="nxs-lb">
      <div className="nxs-lb-inner">
        <div className="nxs-lb-top">
          <button type="button" className="nxs-mini-btn ghost" onClick={() => setActiveView('chat')}>
            <IconArrowLeft size={14} /> Back to Chat
          </button>
          <button type="button" className="nxs-mini-btn" disabled={loading} onClick={load}>
            <IconRefresh size={13} /> Refresh
          </button>
        </div>

        <header className="nxs-lb-hero">
          <div className="nxs-lb-badge"><IconTrophy size={14} /> Live Workspace Telemetry</div>
          <h1 className="nxs-serif">Leaderboard</h1>
          <p>
            Rankings and latency measured directly from real agent runs, live API probes, and your response votes inside NEXORA.
          </p>
        </header>

        {data?.totals && (
          <div className="nxs-lb-stats">
            <div className="nxs-lb-stat">
              <span className="nxs-lb-stat-val">{data.totals.configured}/{data.totals.providers}</span>
              <span className="nxs-lb-stat-lbl">Connected Providers</span>
            </div>
            <div className="nxs-lb-stat">
              <span className="nxs-lb-stat-val">{data.totals.totalRuns}</span>
              <span className="nxs-lb-stat-lbl">Agent Runs</span>
            </div>
            <div className="nxs-lb-stat">
              <span className="nxs-lb-stat-val">{data.totals.totalVotes}</span>
              <span className="nxs-lb-stat-lbl">User Votes</span>
            </div>
            <div className="nxs-lb-stat">
              <span className="nxs-lb-stat-val mono">{modelPref?.model || data.primary?.model || 'Auto'}</span>
              <span className="nxs-lb-stat-lbl">Selected Model</span>
            </div>
          </div>
        )}

        <div className="nxs-lb-filters" role="tablist" aria-label="Filter models">
          {[
            { id: 'all', label: 'All Models' },
            { id: 'configured', label: 'Connected' },
            { id: 'vision', label: 'Vision Capable' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`nxs-filter-pill${filter === f.id ? ' active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          {modelPref?.provider && (
            <button
              type="button"
              className="nxs-filter-pill reset"
              onClick={() => { setModelPref({ provider: '', model: '' }); notify('Switched back to automatic model routing'); }}
            >
              Reset to Auto
            </button>
          )}
        </div>

        {error && <div className="nxs-callout error">{error}</div>}

        {loading && !data ? (
          <div className="nxs-lb-loading">Loading live model metrics…</div>
        ) : (
          <div className="nxs-lb-table-wrap">
            <table className="nxs-lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Votes</th>
                  <th>Runs</th>
                  <th>Avg Latency</th>
                  <th className="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const key = `${entry.provider}::${entry.model}`;
                  const isSelected = modelPref?.provider === entry.provider
                    && (!modelPref?.model || modelPref.model === entry.model);
                  const isBusy = probing === key;
                  return (
                    <tr key={key} className={isSelected ? 'selected' : ''}>
                      <td className="nxs-lb-rank">{idx + 1}</td>
                      <td>
                        <div className="nxs-lb-model">
                          <span className="nxs-lb-model-name mono">{entry.model}</span>
                          <span className="nxs-lb-provider">
                            {entry.providerLabel}
                            {entry.vision ? ' · Vision' : ''}
                            {entry.free ? ' · Free fallback' : ''}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`nxs-status-pill ${entry.configured ? 'ok' : 'off'}`}>
                          {entry.configured ? (entry.active || isSelected ? 'Active' : 'Ready') : 'No key'}
                        </span>
                      </td>
                      <td className="mono">
                        {entry.upvotes || entry.downvotes
                          ? `${entry.netVotes >= 0 ? `+${entry.netVotes}` : entry.netVotes} (${entry.upvotes}↑ ${entry.downvotes}↓)`
                          : '—'}
                      </td>
                      <td className="mono">
                        {entry.runs > 0
                          ? `${entry.runs}${entry.successRate !== null ? ` (${entry.successRate}%)` : ''}`
                          : '0'}
                      </td>
                      <td className="mono">
                        {entry.avgLatencyMs ? `${entry.avgLatencyMs}ms` : '—'}
                      </td>
                      <td className="right">
                        <div className="nxs-lb-row-actions">
                          {entry.configured ? (
                            <>
                              <button
                                type="button"
                                className="nxs-mini-btn"
                                disabled={Boolean(probing)}
                                onClick={() => handleProbe(entry)}
                              >
                                {isBusy ? 'Testing…' : 'Probe'}
                              </button>
                              <button
                                type="button"
                                className={`nxs-mini-btn${isSelected ? ' ok' : ' primary'}`}
                                onClick={() => handleSelectModel(entry)}
                              >
                                {isSelected ? <><IconCheck size={12} /> Selected</> : <><IconSpark size={12} /> Use</>}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="nxs-mini-btn"
                              onClick={() => openSettings('models')}
                            >
                              <IconPlug size={12} /> Connect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
