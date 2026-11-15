/* Typed SSE helpers used by the agent and the terminal. */

export function startSSE(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(': connected\n\n');
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closed */ } }, 15_000);
  let closed = false;
  return {
    send(event, data) {
      if (closed) return;
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch { closed = true; }
    },
    comment(text) { if (!closed) { try { res.write(`: ${text}\n\n`); } catch { closed = true; } } },
    close() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      try { res.write('event: end\ndata: {}\n\n'); res.end(); } catch { /* already gone */ }
    },
    get closed() { return closed; },
  };
}
