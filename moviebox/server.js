// MovieBox server: serves the frontend and proxies TMDB so secrets never reach the browser.
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const TMDB = 'https://api.themoviedb.org/3';
const { TMDB_API_KEY, TMDB_ACCESS_TOKEN } = process.env;
const hasToken = TMDB_ACCESS_TOKEN && !TMDB_ACCESS_TOKEN.startsWith('PASTE');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/*', async (req, res) => {
  try {
    const url = new URL(`${TMDB}/${req.params[0]}`);
    Object.entries(req.query).forEach(([k, v]) => url.searchParams.set(k, v));
    const headers = { accept: 'application/json' };
    if (hasToken) headers.Authorization = `Bearer ${TMDB_ACCESS_TOKEN}`;
    else if (TMDB_API_KEY) url.searchParams.set('api_key', TMDB_API_KEY);
    else return res.status(500).json({ error: 'TMDB credentials missing. Check your .env file.' });

    const r = await fetch(url, { headers });
    res.set('Cache-Control', 'public, max-age=300').status(r.status).json(await r.json());
  } catch (e) {
    res.status(502).json({ error: 'Could not reach TMDB.' });
  }
});

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`MovieBox running at http://localhost:${port}`));
}
module.exports = app;
