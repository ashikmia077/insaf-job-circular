/**
 * Embed a compact snapshot into index.html so the site looks alive even when
 * opened directly from the filesystem (or in the offline workspace preview).
 * The full dataset always comes from data/jobs.json at runtime.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'jobs.json'), 'utf8'));

const all = data.jobs || [];
const picked = [];
const seen = new Set();
const cats = [...new Set(all.map((j) => j.category))];
for (const cat of cats) {
  all.filter((j) => j.category === cat).slice(0, 3).forEach((j) => { if (!seen.has(j.id)) { picked.push(j); seen.add(j.id); } });
}
for (const j of all) { if (picked.length >= 48) break; if (!seen.has(j.id)) { picked.push(j); seen.add(j.id); } }

const seed = {
  generatedAt: data.generatedAt,
  total: data.total,
  sourceList: data.sourceList || [],
  jobs: picked.map((j) => ({
    id: j.id, title: j.title, url: j.url, source: j.source, sourceName: j.sourceName,
    category: j.category, education: j.education, posted: j.posted, deadline: j.deadline,
    vacancies: j.vacancies, salary: j.salary, image: j.image, hint: j.hint,
    applyUrl: j.applyUrl, pdf: j.pdf, noticeImage: j.noticeImage,
    meta: (j.meta || '').slice(0, 260), also: j.also || [],
  })),
};

const htmlPath = path.join(ROOT, 'index.html');
let html = await fs.readFile(htmlPath, 'utf8');
const start = '<script id="seed-data" type="application/json">';
const end = '</script>';
const i = html.indexOf(start);
if (i === -1) throw new Error('seed marker not found in index.html');
const from = i + start.length;
const to = html.indexOf(end, from);
if (to === -1) throw new Error('closing seed marker not found');
const payload = JSON.stringify(seed).replace(/</g, '\\u003c');
html = html.slice(0, from) + payload + html.slice(to);
await fs.writeFile(htmlPath, html);
console.log(`✓ embedded ${seed.jobs.length} seed jobs into index.html`);
