/* ============================================================
   চাকরি বিডি — client app (no framework, no external network)
   ============================================================ */
(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CATS = {
    all: 'সব', govt: 'সরকারি', private: 'বেসরকারি', bank: 'ব্যাংক', ngo: 'এনজিও',
    education: 'শিক্ষা', pharma: 'ফার্মা', defence: 'ডিফেন্স', other: 'অন্যান্য', favorites: 'ফেভারিট',
  };
  const CAT_ICON = { govt: 'i-building', private: 'i-heart', bank: 'i-bank', ngo: 'i-users', education: 'i-graduation', pharma: 'i-file', defence: 'i-building', other: 'i-filter' };
  const EDU_LABEL = { ssc: 'SSC / সমমান', hsc: 'HSC / সমমান', honors: 'Honors / স্নাতক', masters: 'Masters / স্নাতকোত্তর', other: 'অন্যান্য' };

  const DEFAULT_SETTINGS = {
    phone: '+8801953708870',
    shop: 'Insaf Computer',
    address: 'Satkhira Govt College Road, 2nd Gate Opposition',
    template: 'আসসালামু আলাইকুম, {shop} থেকে বলছি। আপনার জন্য একটি নতুন চাকরির খবর পেয়েছি:\n\n{jobs}\n\nবিস্তারিত: {url}\n\nদেখে নিতে পারেন। শুভেচ্ছা — {shop}',
  };

  const STORE = {
    fav: 'chakribd.favorites.v1',
    settings: 'chakribd.settings.v1',
    cache: 'chakribd.jobs.cache.v1',
  };

  const state = {
    jobs: [],
    meta: {},
    favorites: new Set(),
    settings: { ...DEFAULT_SETTINGS },
    category: 'all',
    edu: 'all',
    search: '',
    source: '',
    sort: 'new',
    visible: 24,
    previousHash: '#jobs',
    loading: false,
    firstRoute: true,
  };

  /* ----------------------------- storage ----------------------------- */
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
  }

  /* ------------------------------ utils ------------------------------ */
  function waNumber(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('880')) return digits;
    if (digits.startsWith('0')) return '88' + digits;
    return '88' + digits;
  }
  function parseISO(v) { const d = v ? new Date(v) : null; return d && !isNaN(d) ? d : null; }
  function banglaNum(n) { return String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]); }
  function formatDate(v) {
    const d = parseISO(v);
    if (!d) return '—';
    try { return new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(d); }
    catch { return d.toLocaleDateString('bn-BD'); }
  }
  function relativeDate(v) {
    const d = parseISO(v); if (!d) return '—';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'আজ';
    if (days === 1) return 'কাল';
    if (days < 7) return `${banglaNum(days)} দিন আগে`;
    return formatDate(v);
  }
  function daysLeft(v) {
    const d = parseISO(v); if (!d) return null;
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  }
  function compactNumber(n) {
    if (n == null) return '—';
    return banglaNum(n);
  }
  function icon(name, cls = 'ic') { return `<svg class="${cls}"><use href="#${name}"/></svg>`; }

  function toast(msg, iconName = 'i-check') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${icon(iconName)}<span>${esc(msg)}</span>`;
    $('#toastStack').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3400);
  }

  /* ------------------------------- data ------------------------------ */
  function seedData() {
    try {
      const raw = $('#seed-data')?.textContent || '{}';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.jobs) && parsed.jobs.length ? parsed : null;
    } catch { return null; }
  }

  function adoptData(data, label) {
    if (!data || !Array.isArray(data.jobs) || !data.jobs.length) return false;
    state.jobs = data.jobs;
    state.meta = data;
    writeJSON(STORE.cache, data);
    renderAll();
    if (label) toast(label, 'i-refresh');
    return true;
  }

  async function loadInitial() {
    const seed = seedData();
    const cached = readJSON(STORE.cache, null);
    const best = [seed, cached].filter(Boolean).sort((a, b) => new Date(b.generatedAt || 0) - new Date(a.generatedAt || 0))[0];
    if (best) adoptData(best); else renderAll();

    try {
      const res = await fetch(`data/jobs.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const current = state.meta.generatedAt || 0;
      if (new Date(data.generatedAt || 0) >= new Date(current)) adoptData(data);
    } catch {
      // offline preview or plain file:// — seed data keeps the page usable
    }
  }

  async function refreshData() {
    if (state.loading) return;
    state.loading = true;
    const btns = [$('#refreshBtn'), $('#heroRefresh'), $('#emptyRefresh')].filter(Boolean);
    btns.forEach((b) => { b.disabled = true; b.style.opacity = '.55'; });
    toast('নতুন বিজ্ঞপ্তি আনছি…', 'i-refresh');
    let data = null;
    try {
      const res = await fetch(`/.netlify/functions/refresh?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) data = await res.json();
    } catch { /* function not present on plain static hosting */ }
    if (!data?.jobs?.length) {
      try {
        const res = await fetch(`data/jobs.json?v=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) data = await res.json();
      } catch { /* ignore */ }
    }
    state.loading = false;
    btns.forEach((b) => { b.disabled = false; b.style.opacity = ''; });
    if (data?.jobs?.length) adoptData(data, `${data.total || data.jobs.length} টি চাকরি আপডেট হয়েছে`);
    else toast('আপডেট করা যায়নি। কিছুক্ষণ পর চেষ্টা করুন।', 'i-close');
  }

  /* ---------------------------- filtering ---------------------------- */
  function filtered() {
    const q = state.search.trim().toLowerCase();
    let list = state.jobs.filter((j) => {
      if (state.category === 'favorites') { if (!state.favorites.has(j.id)) return false; }
      else if (state.category !== 'all' && j.category !== state.category) return false;
      if (state.edu !== 'all' && !(j.education || []).includes(state.edu)) return false;
      if (state.source && j.source !== state.source) return false;
      if (q) {
        const hay = `${j.title} ${j.hint || ''} ${j.sourceName || ''} ${j.meta || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sort = state.sort;
    list = [...list].sort((a, b) => {
      if (sort === 'deadline') return (parseISO(a.deadline)?.getTime() || Infinity) - (parseISO(b.deadline)?.getTime() || Infinity);
      if (sort === 'vacancy') return (b.vacancies || 0) - (a.vacancies || 0);
      return (parseISO(b.posted)?.getTime() || parseISO(b.deadline)?.getTime() || 0) - (parseISO(a.posted)?.getTime() || parseISO(a.deadline)?.getTime() || 0);
    });
    return list;
  }

  function countFor(cat) {
    if (cat === 'all') return state.jobs.length;
    if (cat === 'favorites') return state.favorites.size;
    return state.jobs.filter((j) => j.category === cat).length;
  }

  /* ---------------------------- rendering ---------------------------- */
  function renderAll() {
    renderHeader();
    renderStats();
    renderTicker();
    renderCounts();
    renderSources();
    renderSettingsUI();
    renderJobs();
  }

  function renderHeader() {
    const fav = state.favorites.size;
    $('#favCount').textContent = banglaNum(fav);
    $('#toolFavCount').textContent = `${banglaNum(fav)}টি সেভ করা`;
  }

  function renderStats() {
    const jobs = state.jobs;
    if (!jobs.length) return;
    $('#statJobs').textContent = banglaNum(jobs.length);
    $('#statSources').textContent = banglaNum(new Set(jobs.map((j) => j.source)).size || 6);
    const fresh = jobs.filter((j) => { const d = parseISO(j.posted); return d && (Date.now() - d.getTime()) <= 7 * 86400000; }).length;
    $('#statFresh').textContent = banglaNum(fresh);
    const by = (c) => jobs.filter((j) => j.category === c).length;
    $('#miniGovt').textContent = `${banglaNum(by('govt'))}টি চলমান বিজ্ঞপ্তি`;
    $('#miniBank').textContent = `${banglaNum(by('bank'))}টি ব্যাংক জব`;
    $('#miniEdu').textContent = `${banglaNum(by('education') + by('other'))}টি অন্যান্য জব`;
  }

  function renderTicker() {
    const track = $('#tickerTrack');
    if (!state.jobs.length) { track.innerHTML = ''; return; }
    const items = state.jobs.slice(0, 14).map((j) => `<a href="#job/${encodeURIComponent(j.id)}"><em>${j.posted && (Date.now() - new Date(j.posted)) < 172800000 ? 'NEW' : 'JOB'}</em>${esc(j.title.slice(0, 95))}</a>`).join('');
    track.innerHTML = items + items;
  }

  function renderCounts() {
    $$('#categoryChips .chip').forEach((chip) => {
      const n = chip.dataset.category;
      const span = chip.querySelector('span');
      if (span) span.textContent = banglaNum(countFor(n));
    });
    $$('[data-count]').forEach((el) => { el.textContent = `${banglaNum(countFor(el.dataset.count))}টি`; });
  }

  function renderSources() {
    const sources = state.meta.sourceList || [...new Set(state.jobs.map((j) => `${j.source}|${j.sourceName}`))].map((v) => {
      const [id, name] = v.split('|'); return { id, name };
    });
    const select = $('#sourceSelect');
    const current = select.value;
    select.innerHTML = '<option value="">সব উৎস</option>' + sources.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    select.value = current;
    $('#sourceListFooter').innerHTML = sources.map((s) => `<li><a href="${esc(s.home || '#')}" target="_blank" rel="noopener">${esc(s.name || s.id)} ↗</a></li>`).join('');
    const t = state.meta.generatedAt;
    $('#footerUpdated').textContent = t ? `${formatDate(t)} · ${new Intl.DateTimeFormat('bn-BD', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' }).format(new Date(t))}` : '—';
  }

  function cardHTML(j) {
    const cat = j.category || 'other';
    const saved = state.favorites.has(j.id);
    const left = daysLeft(j.deadline);
    const deadlineText = left == null ? '—' : left < 0 ? 'শেষ হয়েছে' : left === 0 ? 'আজ শেষ' : `${banglaNum(left)} দিন বাকি`;
    const img = j.image && /^https?:/i.test(j.image)
      ? `<img class="card-thumb" src="${esc(j.image)}" alt="" loading="lazy" />` : '';
    const fallback = `<div class="thumb-fallback" ${img ? 'hidden' : ''}>${esc((j.sourceName || 'CB').slice(0, 2).toUpperCase())}</div>`;
    const badges = `<span class="badge ${esc(cat)}">${esc(CATS[cat] || 'অন্যান্য')}</span>` +
      (j.posted && (Date.now() - new Date(j.posted)) < 172800000 ? '<span class="badge badge-new">নতুন</span>' : '') +
      `<span class="badge badge-source">${esc(j.sourceName || '')}</span>`;
    const edu = (j.education || []).filter((e) => e !== 'other').slice(0, 3)
      .map((e) => `<span class="edu-tag">${esc(EDU_LABEL[e] || e)}</span>`).join('');

    return `<article class="job-card" data-id="${esc(j.id)}" style="--cc:${cat === 'bank' ? '#e78b16' : cat === 'govt' ? '#4f46e5' : cat === 'private' ? '#e0566b' : '#0d9f7a'}">
      <button class="save-btn ${saved ? 'saved' : ''}" data-act="fav" title="${saved ? 'ফেভারিট বাদ দিন' : 'ফেভারিটে রাখুন'}">${icon('i-bookmark')}</button>
      <div class="card-top">${img}${fallback}
        <div class="card-titles"><div class="card-badges">${badges}</div><h3 class="card-title">${esc(j.title)}</h3></div>
      </div>
      <div class="card-meta">
        <div class="meta-item">${icon('i-clock')}<span>প্রকাশ: ${relativeDate(j.posted)}</span></div>
        <div class="meta-item ${left != null && left <= 2 ? 'danger' : ''}">${icon('i-clock')}<span>শেষ: ${deadlineText}</span></div>
        <div class="meta-item">${icon('i-users')}<span>${j.vacancies ? `${compactNumber(j.vacancies)}টি পদ` : 'পদ সংখ্যা: —'}</span></div>
        <div class="meta-item">${icon('i-graduation')}<span>${esc((j.education || []).filter((e) => e !== 'other').map((e) => e.toUpperCase()).join(' / ') || 'বিস্তারিত দেখুন')}</span></div>
      </div>
      <div class="edu-tags">${edu || '<span class="edu-tag">বিস্তারিত দেখুন</span>'}</div>
      <div class="card-foot">
        <button class="btn btn-card-view" data-act="view">${icon('i-eye')} ভিউ জব</button>
        <button class="btn btn-card-apply" data-act="apply">${icon('i-whatsapp')} অ্যাপ্লাই</button>
      </div>
    </article>`;
  }

  function renderJobs() {
    const grid = $('#jobGrid');
    if (!state.jobs.length) {
      grid.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join('');
      $('#emptyState').hidden = true;
      return;
    }
    const list = filtered();
    $('#resultLine').textContent = `${banglaNum(list.length)}টি চাকরি পাওয়া গেছে · ${state.category === 'favorites' ? 'আপনার ফেভারিট' : CATS[state.category] || 'সব'}`;
    grid.innerHTML = list.slice(0, state.visible).map(cardHTML).join('');
    $$('.card-thumb', grid).forEach((img) => {
      img.addEventListener('error', () => { img.hidden = true; const fb = img.nextElementSibling; if (fb) fb.hidden = false; }, { once: true });
      img.addEventListener('load', () => { const fb = img.nextElementSibling; if (fb) fb.hidden = true; }, { once: true });
    });
    $('#emptyState').hidden = list.length !== 0;
    $('#loadMoreWrap').hidden = list.length <= state.visible;
    $('#loadMoreBtn').textContent = `আরও দেখুন (${banglaNum(list.length - state.visible)}টি বাকি)`;
  }

  /* ------------------------------- detail ----------------------------- */
  function detailHTML(j) {
    const cat = j.category || 'other';
    const left = daysLeft(j.deadline);
    const cells = [
      ['প্রকাশের তারিখ', formatDate(j.posted)],
      ['আবেদনের শেষ তারিখ', j.deadline ? `${formatDate(j.deadline)}${left != null && left >= 0 ? ` (${banglaNum(left)} দিন বাকি)` : ''}` : 'বিজ্ঞপ্তি দেখুন'],
      ['পদ সংখ্যা', j.vacancies ? `${compactNumber(j.vacancies)}টি` : '—'],
      ['বেতন', j.salary || 'বিজ্ঞপ্তি অনুযায়ী'],
      ['শিক্ষাগত যোগ্যতা', (j.education || []).filter((e) => e !== 'other').map((e) => EDU_LABEL[e] || e).join(', ') || 'বিজ্ঞপ্তি দেখুন'],
      ['উৎস', [j.sourceName, ...(j.also || [])].filter(Boolean).join(', ')],
    ];
    const img = j.noticeImage || j.image;
    const cover = img && /^https?:/i.test(img)
      ? `<img class="detail-cover" src="${esc(img)}" alt="বিজ্ঞপ্তি" />`
      : `<div class="detail-cover-fallback">${icon(CAT_ICON[cat] || 'i-file')}</div>`;
    return `${cover}
      <div class="detail-inner">
        <div class="card-badges"><span class="badge ${esc(cat)}">${esc(CATS[cat] || 'অন্যান্য')}</span><span class="badge badge-source">${esc(j.sourceName || '')}</span>${(j.also || []).length ? `<span class="badge badge-source">+${banglaNum(j.also.length)} উৎসে পাওয়া</span>` : ''}</div>
        <h2 id="detailTitle">${esc(j.title)}</h2>
        <div class="detail-grid">${cells.map(([k, v]) => `<div class="detail-cell"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>
        <div class="detail-section"><h3>বিস্তারিত</h3><p>${esc(j.meta || 'সম্পূর্ণ তথ্য ও নোটিশ মূল উৎসের ওয়েবসাইটে দেখুন। নিচের বাটনে ক্লিক করে অফিসিয়াল পেজ খুলুন।')}</p></div>
        <div class="detail-links">
          <a class="btn btn-primary" href="${esc(j.url)}" target="_blank" rel="noopener">নোটিশ / বিস্তারিত দেখুন ${icon('i-link')}</a>
          ${j.pdf ? `<a class="btn outline" href="${esc(j.pdf)}" target="_blank" rel="noopener">PDF বিজ্ঞপ্তি ${icon('i-file')}</a>` : ''}
          ${j.applyUrl ? `<a class="btn outline" href="${esc(j.applyUrl)}" target="_blank" rel="noopener">অফিসিয়াল আবেদন লিংক ${icon('i-link')}</a>` : ''}
          <button class="btn outline" data-detail-act="whatsapp">WhatsApp-এ পাঠান ${icon('i-whatsapp')}</button>
          <button class="btn outline" data-detail-act="fav">${state.favorites.has(j.id) ? 'ফেভারিট বাদ দিন' : 'ফেভারিটে রাখুন'} ${icon('i-bookmark')}</button>
        </div>
        <p class="source-note">তথ্যের শুদ্ধতা ও শেষ তারিখ যাচাই করতে সবসময় মূল উৎসের পেজ দেখুন। এই সাইটটি ব্যক্তিগত ব্যবহারের জন্য তৈরি।</p>
      </div>`;
  }

  function openDetail(id, fromHash = false) {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) { toast('এই চাকরিটি এখন আর তালিকায় নেই।', 'i-close'); return; }
    if (!fromHash) state.previousHash = location.hash || '#jobs';
    $('#detailBody').innerHTML = detailHTML(job);
    $('#detailOverlay').hidden = false;
    $('#detailOverlay').dataset.jobId = id;
    document.body.classList.add('modal-open');
    $('#detailClose').focus();
    if (!fromHash) location.hash = `#job/${encodeURIComponent(id)}`;
  }

  function closeDetail(changeHash = true) {
    $('#detailOverlay').hidden = true;
    document.body.classList.remove('modal-open');
    if (changeHash) {
      const target = state.previousHash && !state.previousHash.startsWith('#job/') ? state.previousHash : '#jobs';
      history.replaceState(null, '', target);
      route();
    }
  }

  /* ------------------------------- actions ---------------------------- */
  function toggleFav(id) {
    if (state.favorites.has(id)) { state.favorites.delete(id); toast('ফেভারিট থেকে বাদ দেওয়া হয়েছে।'); }
    else { state.favorites.add(id); toast('ফেভারিটে সেভ হয়েছে।', 'i-bookmark'); }
    writeJSON(STORE.fav, [...state.favorites]);
    renderHeader(); renderCounts(); renderJobs();
    const overlay = $('#detailOverlay');
    if (!overlay.hidden) {
      const job = state.jobs.find((j) => j.id === id);
      if (job) {
        const btn = $('[data-detail-act="fav"]', overlay);
        if (btn) btn.innerHTML = `${state.favorites.has(id) ? 'ফেভারিট বাদ দিন' : 'ফেভারিটে রাখুন'} ${icon('i-bookmark')}`;
      }
    }
  }

  function waLink(job) {
    const num = waNumber(state.settings.phone);
    if (!num) { openSettings(); toast('প্রথমে সেটিংসে WhatsApp নম্বর দিন।', 'i-close'); return ''; }
    const msg = (state.settings.template || DEFAULT_SETTINGS.template)
      .replace(/\{jobs\}/g, job.title)
      .replace(/\{url\}/g, job.url)
      .replace(/\{shop\}/g, state.settings.shop || DEFAULT_SETTINGS.shop)
      .replace(/\{phone\}/g, state.settings.phone)
      .replace(/\{address\}/g, state.settings.address || '');
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  }

  function applyJob(id) {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) return;
    const link = waLink(job);
    if (!link) return;
    window.open(link, '_blank', 'noopener,noreferrer');
    toast('WhatsApp খুলে গেছে। মেসেজটি কস্টমারকে পাঠাতে পারেন।', 'i-whatsapp');
  }

  /* ------------------------------ settings ---------------------------- */
  function loadSettings() {
    state.settings = { ...DEFAULT_SETTINGS, ...(readJSON(STORE.settings, {}) || {}) };
  }
  function renderSettingsUI() {
    const s = state.settings;
    $('#shopNameSide').textContent = s.shop || DEFAULT_SETTINGS.shop;
    $('#shopAddrSide').textContent = s.address || DEFAULT_SETTINGS.address;
    $('#footerShop').innerHTML = `${esc(s.shop || DEFAULT_SETTINGS.shop)}<br>${esc(s.address || DEFAULT_SETTINGS.address)}<br><span id="footerPhone">${esc(s.phone || DEFAULT_SETTINGS.phone)}</span>`;
    const side = $('#shopWaSide');
    if (side) side.href = `https://wa.me/${waNumber(s.phone)}`;
  }
  function openSettings() {
    const s = state.settings;
    $('#setPhone').value = s.phone; $('#setShop').value = s.shop;
    $('#setAddress').value = s.address; $('#setTemplate').value = s.template;
    $('#settingsOverlay').hidden = false;
    document.body.classList.add('modal-open');
    $('#setPhone').focus();
  }
  function closeSettings() {
    $('#settingsOverlay').hidden = true;
    if ($('#detailOverlay').hidden) document.body.classList.remove('modal-open');
  }

  /* ------------------------------- routing ---------------------------- */
  function route() {
    const hash = location.hash || '#jobs';
    if (hash.startsWith('#job/')) {
      const id = decodeURIComponent(hash.slice(5));
      openDetail(id, true);
      return;
    }
    if (!$('#detailOverlay').hidden) closeDetail(false);
    const [path, query] = hash.split('?');
    const params = new URLSearchParams(query || '');
    if (path === '#favorites') state.category = 'favorites';
    else if (params.get('category')) state.category = params.get('category');
    else if (path === '#jobs' || path === '#home') state.category = 'all';
    state.visible = 24;
    syncFilterUI();
    renderJobs();
    const shouldScroll = !state.firstRoute && (path === '#favorites' || path === '#jobs' || params.get('category'));
    state.firstRoute = false;
    if (shouldScroll) $('#jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $$('.nav-link').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === hash));
  }

  function syncFilterUI() {
    $$('#categoryChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.category === state.category));
    $$('#eduChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.edu === state.edu));
  }

  /* ------------------------------ listeners --------------------------- */
  function bindEvents() {
    document.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-act]');
      if (actionBtn) {
        const card = actionBtn.closest('.job-card');
        const id = card?.dataset.id;
        if (!id) return;
        if (actionBtn.dataset.act === 'fav') toggleFav(id);
        if (actionBtn.dataset.act === 'view') openDetail(id);
        if (actionBtn.dataset.act === 'apply') applyJob(id);
        return;
      }
      const detailAct = e.target.closest('[data-detail-act]');
      if (detailAct) {
        const activeId = $('#detailOverlay').dataset.jobId;
        if (detailAct.dataset.detailAct === 'fav' && activeId) toggleFav(activeId);
        if (detailAct.dataset.detailAct === 'whatsapp' && activeId) applyJob(activeId);
        return;
      }
      const chip = e.target.closest('.chip');
      if (chip) {
        if (chip.dataset.category) {
          state.category = chip.dataset.category;
          state.visible = 24;
          syncFilterUI(); renderJobs();
          const hashTarget = state.category === 'favorites' ? '#favorites' : state.category === 'all' ? '#jobs' : `#jobs?category=${state.category}`;
          history.replaceState(null, '', hashTarget);
          $$('.nav-link').forEach((a) => a.classList.remove('active'));
        } else if (chip.dataset.edu) {
          state.edu = chip.dataset.edu;
          state.visible = 24;
          syncFilterUI(); renderJobs();
        }
        return;
      }
      const tool = e.target.closest('.tool-card');
      if (tool) {
        const cat = tool.dataset.category;
        state.category = cat; state.visible = 24;
        syncFilterUI(); renderJobs();
        history.replaceState(null, '', cat === 'favorites' ? '#favorites' : cat === 'all' ? '#jobs' : `#jobs?category=${cat}`);
        $('#jobs').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    let timer;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(timer);
      const v = e.target.value;
      timer = setTimeout(() => { state.search = v; state.visible = 24; renderJobs(); }, 160);
    });
    $('#sourceSelect').addEventListener('change', (e) => { state.source = e.target.value; state.visible = 24; renderJobs(); });
    $('#sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; renderJobs(); });
    $('#clearFilters').addEventListener('click', () => {
      state.search = ''; state.source = ''; state.edu = 'all'; state.category = 'all'; state.sort = 'new'; state.visible = 24;
      $('#searchInput').value = ''; $('#sourceSelect').value = ''; $('#sortSelect').value = 'new';
      syncFilterUI(); renderJobs(); history.replaceState(null, '', '#jobs'); toast('ফিল্টার রিসেট হয়েছে।');
    });
    $('#loadMoreBtn').addEventListener('click', () => { state.visible += 24; renderJobs(); });

    $('#refreshBtn').addEventListener('click', refreshData);
    $('#heroRefresh').addEventListener('click', refreshData);
    $('#emptyRefresh').addEventListener('click', refreshData);

    $('#settingsBtn').addEventListener('click', openSettings);
    $('#settingsBtnFooter').addEventListener('click', openSettings);
    $('#settingsClose').addEventListener('click', closeSettings);
    $('#settingsOverlay').addEventListener('click', (e) => { if (e.target.id === 'settingsOverlay') closeSettings(); });
    $('#resetSettings').addEventListener('click', () => {
      state.settings = { ...DEFAULT_SETTINGS };
      writeJSON(STORE.settings, state.settings);
      loadSettings(); renderSettingsUI(); openSettings(); toast('ডিফল্ট সেটিংস ফিরিয়ে আনা হয়েছে।');
    });
    $('#settingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      state.settings = {
        phone: $('#setPhone').value.trim(), shop: $('#setShop').value.trim() || DEFAULT_SETTINGS.shop,
        address: $('#setAddress').value.trim() || DEFAULT_SETTINGS.address,
        template: $('#setTemplate').value.trim() || DEFAULT_SETTINGS.template,
      };
      writeJSON(STORE.settings, state.settings);
      renderSettingsUI(); closeSettings(); toast('সেটিংস সেভ হয়েছে।');
    });

    $('#detailClose').addEventListener('click', () => closeDetail());
    $('#detailOverlay').addEventListener('click', (e) => { if (e.target.id === 'detailOverlay') closeDetail(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#settingsOverlay').hidden) closeSettings();
      else if (!$('#detailOverlay').hidden) closeDetail();
    });
    window.addEventListener('hashchange', route);

    // subtle 3D pointer parallax
    const visual = $('#heroVisual');
    const core = $('.visual-core');
    visual.addEventListener('pointermove', (e) => {
      const r = visual.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      core.style.transform = `rotateY(${x * 13}deg) rotateX(${-y * 13}deg)`;
    });
    visual.addEventListener('pointerleave', () => { core.style.transform = ''; });
    const logo = $('.logo3d');
    logo.addEventListener('pointermove', (e) => {
      const r = logo.getBoundingClientRect();
      logo.style.transform = `rotateY(${((e.clientX - r.left) / r.width - .5) * 40}deg) rotateX(${((e.clientY - r.top) / r.height - .5) * -30}deg)`;
    });
    logo.addEventListener('pointerleave', () => { logo.style.transform = ''; });

    // reveal on scroll
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en, i) => {
        if (en.isIntersecting) { setTimeout(() => en.target.classList.add('in'), Math.min(i * 55, 220)); io.unobserve(en.target); }
      });
    }, { threshold: .12 });
    $$('.reveal').forEach((el) => io.observe(el));
  }

  /* -------------------------------- init ------------------------------ */
  function init() {
    state.favorites = new Set(readJSON(STORE.fav, []) || []);
    loadSettings();
    bindEvents();
    loadInitial();
    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
