/**
 * Chakri BD — job circular aggregator
 * Scrapes the public listing pages of the sources configured below and writes
 * data/jobs.json. The same module is imported by the Netlify refresh function.
 */
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 ChakriBD/1.0 (personal use)';

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';
const ascii = (v = '') => String(v).replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
const clean = (v = '') => String(v).replace(/\s+/g, ' ').trim();
const abs = (href, base) => {
  try { return new URL(href, base).href; } catch { return ''; }
};

async function getHtml(url, timeout = 22000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'bn,en;q=0.8', Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try { out[i] = await fn(items[i], i); } catch { out[i] = null; }
    }
  }));
  return out;
}

/* ----------------------------- classification ---------------------------- */

const CATEGORY_RULES = [
  ['bank', /ব্যাংক|\bbank\b|ব্যাংকিং/i],
  ['defence', /ডিফেন্স|\bdefence\b|সশস্ত্র বাহিনী|বাংলাদেশ সেনাবাহিনী|নৌবাহিনী|বিমান বাহিনী/i],
  ['pharma', /ফার্মাসিউটিক্য|pharma|medical|মেডিকেল|নার্সিং|nursing|hospital|হাসপাতাল/i],
  ['ngo', /এনজিও|\bngo\b|foundation|ফাউন্ডেশন/i],
  ['education', /শিক্ষা প্রতিষ্ঠান|educational|বিশ্ববিদ্যালয়|বিশ্ববিদ্যালয়|university|কলেজ|\bcollege\b|স্কুল|\bschool\b|শিক্ষক/i],
  ['private', /প্রাইভেট|private|গ্রুপ অব কোম্পানি|group of companies|কোম্পানি লিমিটেড|corporation ltd/i],
  ['govt', /সরকারি|government|govt|মন্ত্রণালয়|মন্ত্রণালয়|ministry|জেলা প্রশাসক|divisional commissioner|department|অধিদপ্তর|police|পুলিশ|railway|রেলওয়ে|commission|কমিশন|কমিশনার|civil surgeon|সিভিল সার্জন|\bbcs\b|বোর্ড|\bboard\b|ব্যুরো|bureau|কর্পোরেশন|corporation|কর অঞ্চল|tax zone|সচিবালয়|secretariat|জাতীয়|জাতীয়|অ্যাকাডেমী|academy/i],
];

function inferCategory(text = '', hint = '') {
  const hay = `${hint} ${text}`;
  for (const [key, re] of CATEGORY_RULES) if (re.test(hay)) return key;
  return 'other';
}

function educationLevels(text = '') {
  const t = ascii(text);
  const out = [];
  if (/master|মাস্টার|স্নাতকোত্তর|post[\s-]?graduate|এম\.?ফিল|ph\.?d/i.test(t)) out.push('masters');
  if (/honou?rs?|অনার্স|স্নাতক|graduate|degree|ডিগ্রি|\bbsc\b|\bb\.?sc\b|ইঞ্জিনিয়ারিং|engineering|medical|narsing|নার্সিং/i.test(t)) out.push('honors');
  if (/hsc|এইচএসসি|এইচ\.এস\.সি|higher secondary/i.test(t)) out.push('hsc');
  if (/ssc|এসএসসি|এস\.এস\.সি|secondary school/i.test(t)) out.push('ssc');
  if (/জেএসসি|jsc| eighth|৮ম শ্রেণি|class 8|৫ম শ্রেণি|class 5/i.test(t)) out.push('ssc');
  return out.length ? out : ['other'];
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
  জানুয়ারি: 1, জানুয়ারি: 1, ফেব্রুয়ারি: 2, ফেব্রুয়ারি: 2, মার্চ: 3, এপ্রিল: 4, মে: 5,
  জুন: 6, জুলাই: 7, আগস্ট: 8, অগাস্ট: 8, সেপ্টেম্বর: 9, অক্টোবর: 10, নভেম্বর: 11,
  ডিসেম্বর: 12, নভের: 11, ডিসে: 12,
};

function parseDate(text = '') {
  const s = ascii(text).replace(/[,\.]/g, ' ').replace(/\s+/g, ' ').trim();
  const monthRe = Object.keys(MONTHS).join('|');
  const m = s.match(new RegExp(`(\\d{1,2})\\s*(?:${monthRe})\\s*(\\d{4})`, 'i'));
  if (m) {
    const month = Object.entries(MONTHS).find(([k]) => k.toLowerCase() === m[2].toLowerCase())?.[1];
    if (month) {
      const d = new Date(Date.UTC(+m[3], month - 1, +m[1], 18, 0, 0));
      return d.toISOString();
    }
  }
  const iso = s.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return new Date(`${iso[0]}T18:00:00+06:00`).toISOString();
  return null;
}

function parseVacancies(text = '') {
  const m = ascii(text).match(/(\d{1,5})\s*(?:টি)?\s*(?:পদ|posts?|vacanc)/i);
  return m ? +m[1] : null;
}

function parseSalary(text = '') {
  const m = ascii(text).match(/(?:৳|tk\.?|টাকা)\s*([\d,\s]{3,15})/i);
  return m ? `৳${m[1].replace(/\s/g, '')}` : null;
}

/* --------------------------------- sources -------------------------------- */

const sourceList = [
  {
    id: 'bdgovtjob', name: 'BD Govt Job', home: 'https://bdgovtjob.net/',
    pages: [
      'https://bdgovtjob.net/',
      'https://bdgovtjob.net/category/government-jobs-circular/',
      'https://bdgovtjob.net/category/private-jobs/',
      'https://bdgovtjob.net/category/bank-jobs/',
      'https://bdgovtjob.net/category/ngo-job-circular/',
      'https://bdgovtjob.net/category/educational-institution-jobs/',
      'https://bdgovtjob.net/category/university-job-circular/',
      'https://bdgovtjob.net/category/pharmaceuticals-job-circular/',
      'https://bdgovtjob.net/category/defence-job-circular/',
    ],
    selector: 'article.bdg-card',
    parse($, el) {
      const title = clean($(el).find('h3.bdg-card-title').text());
      const url = abs($(el).find('h3.bdg-card-title a').attr('href') || '', this.home);
      const hint = clean($(el).find('.bdg-card-cat').text());
      const meta = clean($(el).find('.jc-info').text());
      const deadlineRaw = clean($(el).find('.is-dl .dt').text());
      const deadlineCode = $(el).find('.is-dl').attr('data-days') || '';
      let deadline = null;
      if (/^\d{8}T\d{4}$/.test(deadlineCode)) {
        const y = +deadlineCode.slice(0, 4), mo = +deadlineCode.slice(4, 6), d = +deadlineCode.slice(6, 8);
        deadline = new Date(Date.UTC(y, mo - 1, d, 12)).toISOString();
      } else deadline = parseDate(deadlineRaw);
      let img = $(el).find('img.bdg-card-img').attr('src') || '';
      if (img.includes('-150x150')) img = img.replace('-150x150', '');
      if (img.includes('-192x192')) img = img.replace('-192x192', '');
      return { title, url, hint, meta, deadline, image: img, classes: $(el).attr('class') || '' };
    },
  },
  {
    id: 'bdgovtinfo', name: 'BD Govt Info', home: 'https://bdgovt.info/',
    pages: [
      'https://bdgovt.info/',
      'https://bdgovt.info/category/govt-job/',
      'https://bdgovt.info/category/private-job/',
      'https://bdgovt.info/category/bank-job/',
      'https://bdgovt.info/category/ngo-job/',
      'https://bdgovt.info/category/educational-job/',
      'https://bdgovt.info/category/university-job/',
      'https://bdgovt.info/category/pharmaceuticals-job-circular/',
    ],
    selector: 'article.post',
    parse($, el) {
      const title = clean($(el).find('h2.entry-title').text().replace(/নতুন|🔥 হট/g, ''));
      const url = abs($(el).find('h2.entry-title a').attr('href') || '', this.home);
      let img = $(el).find('.post-image img').attr('src') || '';
      if (/^data:image/.test(img)) img = $(el).find('.post-image img').attr('data-src') || '';
      const cells = $(el).find('.bdgi-cc').map((_, c) => clean($(c).text())).get();
      return {
        title, url, image: img, hint: clean(cells[0] || ''),
        educationRaw: clean(cells[1] || ''), salaryRaw: clean(cells[3] || ''),
        meta: clean($(el).find('.entry-summary').text()),
        deadline: parseDate(clean($(el).find('.bdgi-cm-dl').text())),
        posted: $(el).find('time[datetime]').attr('datetime') || null,
        classes: $(el).attr('class') || '',
      };
    },
  },
  {
    id: 'bdgovtnotice', name: 'BD Govt Notice', home: 'https://bdgovtnotice.com/',
    pages: ['https://bdgovtnotice.com/', 'https://bdgovtnotice.com/category/govt-job-circular/', 'https://bdgovtnotice.com/category/private-job-circular/'],
    selector: 'article.post',
    parse($, el) {
      const imgEl = $(el).find('.post-image img');
      let img = imgEl.attr('src') || '';
      if (/^data:image/.test(img)) img = imgEl.attr('data-src') || '';
      return {
        title: clean($(el).find('h2.entry-title').text()),
        url: abs($(el).find('h2.entry-title a').attr('href') || '', this.home),
        image: img, hint: clean($(el).find('.cat-links').text()),
        meta: clean($(el).find('.entry-summary').text()).slice(0, 420),
        posted: $(el).find('time[datetime]').attr('datetime') || null,
        classes: $(el).attr('class') || '',
      };
    },
  },
  {
    id: 'banglacyber', name: 'Bangla Cyber', home: 'https://www.banglacyber.com/',
    pages: [
      'https://www.banglacyber.com/category/%e0%a6%9a%e0%a6%be%e0%a6%95%e0%a6%b0%e0%a6%bf%e0%a6%b0-%e0%a6%96%e0%a6%ac%e0%a6%b0/',
      'https://www.banglacyber.com/category/govt-job-bd/',
      'https://www.banglacyber.com/category/others-job/',
    ],
    selector: '.td-module-container',
    parse($, el) {
      const a = $(el).find('h3.entry-title a');
      const style = $(el).find('.td-thumb-css').attr('style') || '';
      const im = style.match(/url\(['"]?([^'")]+)/i);
      return {
        title: clean(a.text()), url: abs(a.attr('href') || '', this.home),
        image: im ? im[1] : '', meta: clean($(el).find('.td-module-meta-info').text()).slice(0, 240),
        posted: $(el).find('time[datetime]').attr('datetime') || null,
        hint: clean($(el).find('.td-category').text()),
        classes: '',
      };
    },
  },
  {
    id: 'studyonlinebd', name: 'Study Online BD', home: 'https://studyonlinebd.com/',
    pages: ['https://studyonlinebd.com/user/all-jobs-circular/'],
    selector: 'a[href*="jobs-circular-details/"]',
    parse($, el) {
      return { title: clean($(el).text()), url: abs($(el).attr('href') || '', this.home), image: '', meta: '', hint: 'চাকরির বিজ্ঞপ্তি', classes: '' };
    },
  },
  {
    id: 'nextjobz', name: 'NextJobz', home: 'https://nextjobz.com.bd/',
    pages: ['https://nextjobz.com.bd/gov-jobs', 'https://nextjobz.com.bd/jobs'],
    selector: 'a[href^="/gov-jobs/"], a[href^="/jobs/"]',
    parse($, el) {
      const text = clean($(el).text());
      const deadlineRaw = (text.match(/আবেদনের শেষ তারিখ[:]?\s*([^Grade]+?)(?:Grade|পদ সংখ্যা|$)/) || [])[1] || '';
      return {
        title: clean($(el).find('.card-title').text()) || text.split(/আশুগঞ্জ|পদ সংখ্যা|Grade/)[0].trim(),
        url: abs($(el).attr('href') || '', this.home),
        image: ($(el).find('img').attr('src') || '').replace(/w=\d+/, 'w=256'),
        meta: text.slice(0, 420), hint: 'সরকারি চাকরি',
        deadline: parseDate(deadlineRaw),
        vacancies: parseVacancies((text.match(/পদ সংখ্যা[:]?\s*([^\n]+)/) || [])[1] || ''),
        salary: parseSalary(text),
        classes: '',
      };
    },
  },
];

/* -------------------------------- enrichment ------------------------------ */

async function enrich(job) {
  let educationFromDetail = null;
  const html = await getHtml(job.url, 9000);
  const $ = cheerio.load(html);
  const domain = new URL(job.url).hostname.replace(/^www\./, '');
  const goodDomains = /teletalk|\.gov\.bd|jobs|apply|recruit|career|jobportal|job\.com\.bd/i;
  let best = { score: -1, url: '' };
  let pdf = '';
  let noticeImage = '';

  $('a[href]').each((_, a) => {
    const href = abs($(a).attr('href') || '', job.url);
    if (!href || /^(javascript|mailto|tel:)/i.test(href)) return;
    if (/\.pdf(\?|$)/i.test(href) && !pdf) pdf = href;
    let host = '';
    try { host = new URL(href).hostname.replace(/^www\./, ''); } catch { return; }
    if (host === domain) return;
    if (/facebook|twitter|youtube|linkedin|instagram|pinterest|t\.me|whatsapp|ads|doubleclick|google/i.test(host)) return;
    const label = clean($(a).text()) + ' ' + href;
    let score = 0;
    if (goodDomains.test(host)) score += 5;
    if (/আবেদন|apply|অনলাইন|online|form|ফরম/i.test(label)) score += 4;
    if (/teletalk|gov\.bd/i.test(href)) score += 3;
    if (/pdf|\.bd/i.test(href)) score += 1;
    if (score > best.score) best = { score, url: href };
  });
  if (best.score < 4) best.url = '';

  const scope = $('.entry-content, .post-content, article, main').first().length ? $('.entry-content, .post-content, article, main').first() : $('body');
  scope.find('img').each((_, img) => {
    let src = $(img).attr('data-src') || $(img).attr('src') || '';
    if (/^data:image/.test(src)) src = '';
    if (!src || /logo|icon|avatar|banner|ads?/i.test(src)) return;
    const w = +($(img).attr('width') || 0);
    if (w && w < 300) return;
    if (!noticeImage) noticeImage = abs(src, job.url);
  });

  if (job.education?.length === 1 && job.education[0] === 'other') {
    const detailText = clean(scope.text()).slice(0, 18000);
    const found = educationLevels(detailText);
    if (!found.includes('other')) educationFromDetail = found;
  }

  return { applyUrl: best.url, pdf, noticeImage, education: educationFromDetail || job.education };
}

/* --------------------------------- build ---------------------------------- */

function normalizeTitle(t) {
  return ascii(t).toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\b(২০\d{2}|20\d{2}|job|circular|নিয়োগ|নিয়োগ|বিজ্ঞপ্তি|new|নতুন)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 52);
}

async function scrape({ enrichCount = 110 } = {}) {
  const raw = [];
  const errors = [];

  await mapLimit(sourceList, 4, async (source) => {
    for (const pageUrl of source.pages) {
      try {
        const html = await getHtml(pageUrl);
        const $ = cheerio.load(html);
        $(source.selector).each((_, el) => {
          const item = source.parse.call(source, $, el);
          if (!item.title || !item.url || item.title.length < 12) return;
          if (/ফলাফল|result|সময়সূচী|সময়সূচী|schedule|নিয়োগপত্র|নিয়োগপত্র|admit card|এডমিট/i.test(item.title)) return;
          if (!/নিয়োগ|নিয়োগ|চাকরি|job|circular|recruit|vacancy|পদ/i.test(`${item.title} ${item.meta || ''} ${item.hint || ''}`)) return;
          const text = `${item.title} ${item.meta || ''}`;
          raw.push({
            title: item.title,
            url: item.url,
            source: source.id,
            sourceName: source.name,
            image: item.image || '',
            hint: item.hint || '',
            classes: item.classes || '',
            meta: (item.meta || '').replace(/\s+/g, ' ').trim().slice(0, 500),
            posted: item.posted || null,
            deadline: item.deadline || null,
            vacancies: item.vacancies ?? parseVacancies(`${item.hint} ${text}`),
            salary: item.salary || parseSalary(text),
            education: educationLevels(`${item.educationRaw || ''} ${item.hint} ${text}`),
            category: inferCategory(text, `${item.hint} ${item.classes}`),
          });
        });
      } catch (e) {
        errors.push(`${source.id}: ${pageUrl} — ${e.message}`);
      }
    }
  });

  // merge near-duplicates from different sources
  const byTitle = new Map();
  for (const job of raw) {
    const key = normalizeTitle(job.title);
    if (!key) continue;
    const prev = byTitle.get(key);
    if (prev) {
      if (!prev.also.includes(job.sourceName)) prev.also.push(job.sourceName);
      if (!prev.image && job.image) prev.image = job.image;
      if (!prev.deadline && job.deadline) prev.deadline = job.deadline;
      if (!prev.vacancies && job.vacancies) prev.vacancies = job.vacancies;
      if (!prev.salary && job.salary) prev.salary = job.salary;
      if (!prev.meta && job.meta) prev.meta = job.meta;
      const ed = new Set([...prev.education, ...job.education]);
      prev.education = [...ed];
      if (job.category !== 'other' && prev.category === 'other') prev.category = job.category;
    } else {
      byTitle.set(key, { ...job, also: [], applyUrl: '', pdf: '', noticeImage: '' });
    }
  }

  let jobs = [...byTitle.values()].filter((j) => j.title && j.url);
  jobs.sort((a, b) => new Date(b.posted || b.deadline || 0) - new Date(a.posted || a.deadline || 0));
  jobs = jobs.slice(0, 260);

  const enrichable = jobs.slice(0, enrichCount);
  await mapLimit(enrichable, 8, async (job) => Object.assign(job, await enrich(job)));

  jobs = jobs.map((j) => ({ ...j, id: Buffer.from(j.url).toString('base64url').slice(0, 40) }));

  return {
    generatedAt: new Date().toISOString(),
    sourceList: sourceList.map(({ id, name, home }) => ({ id, name, home })),
    total: jobs.length,
    errors,
    jobs,
  };
}

async function main() {
  const data = await scrape();
  await fs.mkdir(path.join(ROOT, 'data'), { recursive: true });
  await fs.writeFile(path.join(ROOT, 'data', 'jobs.json'), JSON.stringify(data, null, 2));
  console.log(`✓ ${data.total} jobs written to data/jobs.json`);
  if (data.errors.length) console.log(`⚠ ${data.errors.length} source page(s) failed:\n` + data.errors.join('\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

export { scrape, sourceList };
