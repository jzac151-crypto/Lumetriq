require('dotenv').config();
const express = require('express');
const https   = require('https');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── /api/claude — secure Anthropic proxy ─────────────────────
app.post('/api/claude', (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in environment variables' });
  }

  const payload = JSON.stringify({
    model:      req.body.model      || 'claude-opus-4-6',
    max_tokens: req.body.max_tokens || 1024,
    ...(req.body.system   ? { system:   req.body.system   } : {}),
    ...(req.body.messages ? { messages: req.body.messages } : {}),
  });

  const opts = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':          key,
      'anthropic-version': '2023-06-01',
      'Content-Length':    Buffer.byteLength(payload),
    },
  };

  const pr = https.request(opts, upstream => {
    let buf = '';
    upstream.on('data', d => buf += d);
    upstream.on('end', () => {
      try {
        res.status(upstream.statusCode).json(JSON.parse(buf));
      } catch(e) {
        res.status(500).json({ error: 'Invalid response from Anthropic' });
      }
    });
  });

  pr.on('error', e => res.status(502).json({ error: e.message }));
  pr.write(payload);
  pr.end();
});

// Fallback — serve index.html for all other routes
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// Railway requires listening on 0.0.0.0
app.listen(PORT, '0.0.0.0', () =>
  console.log(`Lumetriq Art Studios running on port ${PORT}`)
);
