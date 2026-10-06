/* MovieBox frontend - vanilla JS, hash router, reusable components */
const IMG = 'https://image.tmdb.org/t/p/';
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), modal = $('#modal');
let genreMap = {};

/* ---------- API ---------- */
async function api(path, params = {}) {
  const res = await fetch(`/api/${path}?${new URLSearchParams({ language: 'en-US', ...params })}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.status_message || data.error || `Request failed (${res.status})`);
  return data;
}
const CATEGORIES = {
  trending: { label: 'Trending', path: 'trending/movie/week' },
  popular: { label: 'Popular', path: 'movie/popular' },
  top_rated: { label: 'Top Rated', path: 'movie/top_rated' },
  upcoming: { label: 'Upcoming', path: 'movie/upcoming' },
};

/* ---------- Watchlist (localStorage) ---------- */
const WL_KEY = 'moviebox_watchlist';
const wl = {
  all: () => { try { return JSON.parse(localStorage.getItem(WL_KEY)) || []; } catch { return []; } },
  has: id => wl.all().some(m => m.id === id),
  toggle(m) {
    let list = wl.all(); const exists = list.some(x => x.id === m.id);
    list = exists ? list.filter(x => x.id !== m.id)
      : [{ id: m.id, title: m.title, poster_path: m.poster_path, release_date: m.release_date, vote_average: m.vote_average, genre_ids: m.genre_ids || (m.genres || []).map(g => g.id) }, ...list];
    localStorage.setItem(WL_KEY, JSON.stringify(list));
    wl.badge(); toast(exists ? 'Removed from watchlist' : 'Added to watchlist');
    return !exists;
  },
  badge() { const n = wl.all().length, b = $('#wl-count'); b.textContent = n; b.classList.toggle('hidden', !n); },
};

/* ---------- Small UI helpers ---------- */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.style.opacity = 1;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.style.opacity = 0), 1800);
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const year = d => (d ? d.slice(0, 4) : 'TBA');
const rating = v => (v ? v.toFixed(1) : 'NR');
const genreNames = (ids = [], n = 2) => ids.map(i => genreMap[i]).filter(Boolean).slice(0, n).join(', ') || 'Movie';

/* ---------- Components ---------- */
const MovieCard = m => `
  <article class="card group relative cursor-pointer rounded-xl overflow-hidden bg-[var(--surface)] border border-[var(--line)] shrink-0" data-id="${m.id}" tabindex="0" role="button" aria-label="${esc(m.title)}">
    <div class="aspect-[2/3] overflow-hidden bg-[#1b2130] relative">
      ${m.poster_path ? `<img loading="lazy" src="${IMG}w342${m.poster_path}" alt="${esc(m.title)} poster" class="w-full h-full object-cover">`
        : `<div class="w-full h-full grid place-items-center text-slate-500 text-sm p-4 text-center">No poster</div>`}
      <span class="absolute top-2 left-2 bg-black/75 backdrop-blur text-[var(--accent)] text-xs font-semibold px-2 py-1 rounded-md">★ ${rating(m.vote_average)}</span>
      <button data-wl="${m.id}" aria-label="Toggle watchlist" class="absolute top-2 right-2 w-8 h-8 grid place-items-center rounded-full bg-black/75 hover:bg-[var(--accent)] hover:text-black transition ${wl.has(m.id) ? 'text-[var(--accent)]' : 'text-white'}">${wl.has(m.id) ? '♥' : '♡'}</button>
    </div>
    <div class="p-3">
      <h3 class="font-semibold text-sm leading-snug line-clamp-1" style="font-family:Outfit">${esc(m.title)}</h3>
      <p class="text-xs text-slate-400 mt-1">${year(m.release_date)} · ${esc(genreNames(m.genre_ids))}</p>
    </div>
  </article>`;

const Skeletons = (n = 10, row = false) => Array.from({ length: n }, () =>
  `<div class="animate-pulse rounded-xl bg-[var(--surface)] border border-[var(--line)] ${row ? 'w-40 sm:w-44 shrink-0' : ''}"><div class="aspect-[2/3] bg-[#1b2130]"></div><div class="p-3 space-y-2"><div class="h-3 bg-[#1b2130] rounded w-3/4"></div><div class="h-3 bg-[#1b2130] rounded w-1/2"></div></div></div>`).join('');

const Empty = (title, text, cta = '') => `<div class="text-center py-20 col-span-full"><div class="text-5xl mb-4">🎞️</div><h3 class="display text-xl font-bold">${title}</h3><p class="text-slate-400 mt-2 max-w-sm mx-auto text-sm">${text}</p>${cta}</div>`;
const ErrorBox = (msg, retry = 'location.reload()') => `<div class="text-center py-20 col-span-full"><div class="text-5xl mb-4">⚠️</div><h3 class="display text-xl font-bold">Something went wrong</h3><p class="text-slate-400 mt-2 text-sm max-w-md mx-auto">${esc(msg)}</p><button onclick="${retry}" class="mt-5 px-5 py-2 rounded-full bg-[var(--accent)] text-black font-medium">Try again</button></div>`;
const Section = (title, link, body) => `<section class="max-w-7xl mx-auto px-4 mt-12"><div class="flex items-end justify-between mb-4"><h2 class="display text-2xl md:text-3xl font-bold">${title}</h2>${link ? `<a href="${link}" class="text-sm text-[var(--accent)] hover:underline">See all</a>` : ''}</div>${body}</section>`;

/* Paginated grid with "Load more". `fetcher(page)` returns TMDB list response. */
function PaginatedGrid(container, fetcher, emptyHtml) {
  let page = 1;
  container.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" id="g">${Skeletons(12)}</div><div class="text-center mt-8" id="more"></div>`;
  const grid = $('#g', container), more = $('#more', container);
  async function load() {
    more.innerHTML = page > 1 ? '<span class="text-slate-400 text-sm animate-pulse">Loading…</span>' : '';
    try {
      const d = await fetcher(page);
      if (page === 1) grid.innerHTML = '';
      if (page === 1 && !d.results.length) { grid.innerHTML = emptyHtml; more.innerHTML = ''; return; }
      grid.insertAdjacentHTML('beforeend', d.results.map(MovieCard).join(''));
      more.innerHTML = page < Math.min(d.total_pages, 500) ? `<button class="px-7 py-3 rounded-full border border-[var(--line)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition font-medium">Load more</button>` : '';
      $('button', more)?.addEventListener('click', () => { page++; load(); });
    } catch (e) { grid.innerHTML = ErrorBox(e.message, ''); $('button', grid).onclick = () => { grid.innerHTML = Skeletons(12); load(); }; more.innerHTML = ''; }
  }
  load();
}

/* ---------- Views ---------- */
async function homeView() {
  app.innerHTML = `
  <section class="relative overflow-hidden">
    <div id="hero-bg" class="absolute inset-0 bg-cover bg-center opacity-30 transition-opacity duration-700"></div>
    <div class="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/70 to-[var(--bg)]/30"></div>
    <div class="relative max-w-3xl mx-auto px-4 py-20 md:py-32 text-center">
      <h1 class="display text-4xl md:text-6xl font-extrabold leading-tight">Tonight's film is one search away</h1>
      <p class="text-slate-300 mt-4">Search thousands of movies, check ratings and cast, and save what you want to watch.</p>
      <form id="search-form" class="mt-8 flex bg-[var(--surface)]/90 border border-[var(--line)] rounded-full p-1.5 focus-within:border-[var(--accent)] transition shadow-2xl" role="search">
        <input id="q" type="search" autocomplete="off" placeholder="Search movies by title…" class="flex-1 bg-transparent px-5 py-3 outline-none text-base min-w-0" aria-label="Search movies">
        <button class="px-6 md:px-8 rounded-full bg-[var(--accent)] text-black font-semibold hover:brightness-110 transition">Search</button>
      </form>
    </div>
  </section>
  <div id="rows"></div>
  <section class="max-w-7xl mx-auto px-4 mt-12"><h2 class="display text-2xl md:text-3xl font-bold mb-4">Browse by genre</h2><div id="genre-chips" class="flex flex-wrap gap-2"></div></section>`;
  $('#search-form').onsubmit = e => { e.preventDefault(); const q = $('#q').value.trim(); if (q) location.hash = `#/search/${encodeURIComponent(q)}`; };
  $('#genre-chips').innerHTML = GenreChips();

  const rows = $('#rows');
  Object.entries(CATEGORIES).forEach(([key, c]) => {
    rows.insertAdjacentHTML('beforeend', Section(c.label + ' Movies', `#/movies/${key}`, `<div id="row-${key}" class="flex gap-4 overflow-x-auto no-scrollbar pb-2">${Skeletons(8, true)}</div>`));
    api(c.path).then(d => {
      $(`#row-${key}`).innerHTML = d.results.map(m => `<div class="w-40 sm:w-44 shrink-0">${MovieCard(m)}</div>`).join('');
      if (key === 'trending' && d.results[0]?.backdrop_path) $('#hero-bg').style.backgroundImage = `url(${IMG}w1280${d.results[0].backdrop_path})`;
    }).catch(e => ($(`#row-${key}`).innerHTML = ErrorBox(e.message, 'location.reload()')));
  });
}

const GenreChips = (active) => Object.entries(genreMap).map(([id, n]) =>
  `<a href="#/genres/${id}" class="px-4 py-2 rounded-full text-sm border transition ${+active === +id ? 'bg-[var(--accent)] text-black border-[var(--accent)] font-semibold' : 'border-[var(--line)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}">${n}</a>`).join('');

function pageShell(title, sub, extra = '') {
  app.innerHTML = `<div class="max-w-7xl mx-auto px-4 py-10"><h1 class="display text-3xl md:text-4xl font-extrabold">${title}</h1>${sub ? `<p class="text-slate-400 mt-1">${sub}</p>` : ''}${extra}<div id="content" class="mt-6"></div></div>`;
  return $('#content');
}

function moviesView(cat = 'popular') {
  if (!CATEGORIES[cat]) cat = 'popular';
  const tabs = `<div class="flex gap-2 mt-5 overflow-x-auto no-scrollbar">${Object.entries(CATEGORIES).map(([k, c]) =>
    `<a href="#/movies/${k}" class="px-4 py-2 rounded-full text-sm whitespace-nowrap border transition ${k === cat ? 'bg-[var(--accent)] text-black border-[var(--accent)] font-semibold' : 'border-[var(--line)] hover:border-[var(--accent)]'}">${c.label}</a>`).join('')}</div>`;
  const c = pageShell('Movies', 'Explore what the world is watching.', tabs);
  PaginatedGrid(c, p => api(CATEGORIES[cat].path, { page: p }), Empty('No movies found', 'Try another category.'));
}

function genresView(id) {
  const chips = `<div class="flex flex-wrap gap-2 mt-5">${GenreChips(id)}</div>`;
  const c = pageShell(id ? genreMap[id] || 'Genre' : 'Genres', 'Pick a genre to start exploring.', chips);
  if (!id) return (c.innerHTML = Empty('Choose a genre', 'Select one above to see the most popular movies in it.'));
  PaginatedGrid(c, p => api('discover/movie', { with_genres: id, sort_by: 'popularity.desc', page: p }), Empty('Nothing here yet', 'No movies found for this genre.'));
}

function searchView(q) {
  const c = pageShell(`Results for “${esc(q)}”`, '', `<form id="sf" class="mt-5 flex max-w-xl bg-[var(--surface)] border border-[var(--line)] rounded-full p-1 focus-within:border-[var(--accent)]"><input id="q" value="${esc(q)}" class="flex-1 bg-transparent px-4 py-2 outline-none min-w-0" aria-label="Search movies"><button class="px-5 rounded-full bg-[var(--accent)] text-black font-semibold">Search</button></form>`);
  $('#sf').onsubmit = e => { e.preventDefault(); const v = $('#q').value.trim(); if (v) location.hash = `#/search/${encodeURIComponent(v)}`; };
  PaginatedGrid(c, p => api('search/movie', { query: q, page: p, include_adult: false }),
    Empty('No results', `Nothing matched “${esc(q)}”. Check the spelling or try a shorter title.`));
}

function watchlistView() {
  const list = wl.all();
  const c = pageShell('My Watchlist', `${list.length} saved movie${list.length === 1 ? '' : 's'}`);
  c.innerHTML = list.length
    ? `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">${list.map(MovieCard).join('')}</div>`
    : Empty('Your watchlist is empty', 'Tap the heart on any movie to save it here.', '<a href="#/movies/popular" class="inline-block mt-5 px-5 py-2 rounded-full bg-[var(--accent)] text-black font-medium">Find movies</a>');
}

/* ---------- Movie details modal ---------- */
async function openMovie(id) {
  modal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
  modal.innerHTML = `<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" data-close></div><div class="relative h-full overflow-y-auto" data-close><div class="min-h-full grid place-items-center p-0 md:p-6"><div class="w-full max-w-5xl bg-[var(--surface)] md:rounded-2xl p-20 text-center text-slate-400 animate-pulse">Loading movie…</div></div></div>`;
  try {
    const m = await api(`movie/${id}`, { append_to_response: 'credits,videos,similar' });
    const trailer = m.videos?.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') || m.videos?.results.find(v => v.site === 'YouTube');
    const cast = (m.credits?.cast || []).slice(0, 12);
    const director = (m.credits?.crew || []).find(c => c.job === 'Director');
    const rt = m.runtime ? `${Math.floor(m.runtime / 60)}h ${m.runtime % 60}m` : 'N/A';
    const saved = wl.has(m.id);
    modal.innerHTML = `
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" data-close></div>
    <div class="relative h-full overflow-y-auto" data-close><div class="min-h-full md:grid md:place-items-center md:p-6" data-close>
      <div class="modal-in relative w-full max-w-5xl bg-[var(--surface)] md:rounded-2xl overflow-hidden" role="dialog" aria-modal="true" aria-label="${esc(m.title)}">
        <button data-close aria-label="Close" class="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/70 hover:bg-[var(--accent)] hover:text-black text-xl transition">✕</button>
        <div class="relative h-56 md:h-80 bg-[#1b2130]">
          ${m.backdrop_path ? `<img src="${IMG}w1280${m.backdrop_path}" alt="" class="w-full h-full object-cover">` : ''}
          <div class="absolute inset-0 bg-gradient-to-t from-[var(--surface)] to-transparent"></div>
        </div>
        <div class="px-5 md:px-10 pb-10 -mt-24 md:-mt-40 relative flex flex-col md:flex-row gap-6 md:gap-8">
          <img src="${m.poster_path ? IMG + 'w500' + m.poster_path : ''}" alt="${esc(m.title)} poster" class="w-40 md:w-64 rounded-xl shadow-2xl border border-[var(--line)] self-center md:self-start bg-[#1b2130] aspect-[2/3] object-cover">
          <div class="flex-1 md:pt-44">
            <h2 class="display text-3xl md:text-4xl font-extrabold">${esc(m.title)} <span class="text-slate-400 font-semibold text-xl">(${year(m.release_date)})</span></h2>
            ${m.tagline ? `<p class="italic text-slate-400 mt-1">${esc(m.tagline)}</p>` : ''}
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm">
              <span class="bg-[var(--accent)] text-black font-bold px-2.5 py-1 rounded-md">★ ${rating(m.vote_average)}</span>
              <span class="text-slate-400">${m.vote_count.toLocaleString()} votes</span><span>${rt}</span>
              <span>${m.release_date ? new Date(m.release_date).toLocaleDateString('en-US', { dateStyle: 'long' }) : 'Release date TBA'}</span>
            </div>
            <div class="flex flex-wrap gap-2 mt-4">${m.genres.map(g => `<a href="#/genres/${g.id}" data-close class="text-xs px-3 py-1 rounded-full border border-[var(--line)] hover:border-[var(--accent)]">${g.name}</a>`).join('')}</div>
            <h3 class="font-semibold mt-6 mb-1">Overview</h3>
            <p class="text-slate-300 leading-relaxed">${esc(m.overview) || 'No overview available.'}</p>
            ${director ? `<p class="text-sm text-slate-400 mt-3">Directed by <span class="text-white">${esc(director.name)}</span></p>` : ''}
            <div class="flex flex-wrap gap-3 mt-6">
              ${trailer ? `<button id="trailer-btn" data-key="${trailer.key}" class="px-6 py-3 rounded-full bg-[var(--accent)] text-black font-semibold hover:brightness-110 transition">▶ Watch trailer</button>` : '<span class="px-6 py-3 rounded-full border border-[var(--line)] text-slate-500 text-sm">Trailer unavailable</span>'}
              <button id="wl-btn" class="px-6 py-3 rounded-full border border-[var(--line)] hover:border-[var(--accent)] transition font-medium">${saved ? '♥ In watchlist' : '♡ Add to watchlist'}</button>
            </div>
            <div id="trailer-box" class="mt-5 hidden aspect-video rounded-xl overflow-hidden bg-black"></div>
          </div>
        </div>
        ${cast.length ? `<div class="px-5 md:px-10 pb-8"><h3 class="display text-xl font-bold mb-3">Cast</h3><div class="flex gap-4 overflow-x-auto no-scrollbar pb-2">${cast.map(c => `
          <div class="w-24 shrink-0 text-center"><div class="w-24 h-24 rounded-full overflow-hidden bg-[#1b2130] mx-auto">${c.profile_path ? `<img loading="lazy" src="${IMG}w185${c.profile_path}" alt="${esc(c.name)}" class="w-full h-full object-cover">` : '<div class="w-full h-full grid place-items-center text-2xl">👤</div>'}</div>
          <p class="text-xs font-medium mt-2 line-clamp-1">${esc(c.name)}</p><p class="text-[11px] text-slate-400 line-clamp-1">${esc(c.character)}</p></div>`).join('')}</div></div>` : ''}
        ${m.similar?.results.length ? `<div class="px-5 md:px-10 pb-10"><h3 class="display text-xl font-bold mb-3">Similar movies</h3><div class="flex gap-4 overflow-x-auto no-scrollbar pb-2">${m.similar.results.slice(0, 10).map(s => `<div class="w-36 shrink-0">${MovieCard(s)}</div>`).join('')}</div></div>` : ''}
      </div></div></div>`;
    $('#wl-btn').onclick = e => { const on = wl.toggle(m); e.target.textContent = on ? '♥ In watchlist' : '♡ Add to watchlist'; };
    $('#trailer-btn')?.addEventListener('click', e => {
      const box = $('#trailer-box'); box.classList.remove('hidden');
      box.innerHTML = `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${e.target.dataset.key}?autoplay=1" title="Trailer" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  } catch (e) {
    modal.innerHTML = `<div class="absolute inset-0 bg-black/80" data-close></div><div class="relative h-full grid place-items-center p-4" data-close><div class="bg-[var(--surface)] rounded-2xl p-6 max-w-md">${ErrorBox(e.message, 'closeModal()')}</div></div>`;
  }
}
function closeModal() { modal.classList.add('hidden'); modal.innerHTML = ''; document.body.style.overflow = ''; }

/* ---------- Global events ---------- */
document.addEventListener('click', e => {
  const wlBtn = e.target.closest('[data-wl]');
  if (wlBtn) { // heart on a card
    e.stopPropagation();
    const id = +wlBtn.dataset.wl, card = wlBtn.closest('[data-id]');
    api(`movie/${id}`).then(m => {
      const on = wl.toggle(m); wlBtn.textContent = on ? '♥' : '♡'; wlBtn.classList.toggle('text-[var(--accent)]', on);
      if (location.hash === '#/watchlist') watchlistView();
    }).catch(err => toast(err.message));
    return;
  }
  const card = e.target.closest('[data-id]');
  if (card) return openMovie(+card.dataset.id);
  if (modal.classList.contains('hidden')) return;
  const inDialog = e.target.closest('[role=dialog]');
  if (inDialog ? e.target.closest('button[data-close], a[data-close]') : e.target.closest('[data-close]')) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && e.target.matches('[data-id]')) openMovie(+e.target.dataset.id);
});
$('#menu-btn').onclick = () => { const n = $('#mobile-nav'); n.classList.toggle('hidden'); n.classList.toggle('flex'); };
$('#year').textContent = new Date().getFullYear();

/* ---------- Router ---------- */
function route() {
  closeModal();
  $('#mobile-nav').classList.add('hidden'); $('#mobile-nav').classList.remove('flex');
  const [, page = '', arg] = location.hash.split('/');
  document.querySelectorAll('[data-link]').forEach(a => {
    const on = a.dataset.link === (page || 'home') || (page === 'search' && a.dataset.link === 'home');
    a.classList.toggle('bg-white/10', on); a.classList.toggle('text-[var(--accent)]', on);
  });
  window.scrollTo(0, 0); app.classList.remove('view'); void app.offsetWidth; app.classList.add('view');
  if (page === 'movies') moviesView(arg);
  else if (page === 'genres') genresView(arg);
  else if (page === 'watchlist') watchlistView();
  else if (page === 'search') searchView(decodeURIComponent(arg || ''));
  else homeView();
}
window.addEventListener('hashchange', route);

(async function init() {
  wl.badge();
  try { (await api('genre/movie/list')).genres.forEach(g => (genreMap[g.id] = g.name)); }
  catch (e) { app.innerHTML = `<div class="max-w-7xl mx-auto px-4 py-10">${ErrorBox(e.message + ' Check your TMDB credentials in the .env file.')}</div>`; return; }
  route();
})();
