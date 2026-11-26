#!/usr/bin/env node
// يولّد صفحات ثابتة قابلة للفهرسة لكل طبيب وتخصص ومنطقة + sitemap.xml + robots.txt
// البيانات العامة فقط (الأطباء المقبولون) عبر المفتاح العام. لا أسرار.
// التشغيل: SUPABASE_URL=... SUPABASE_ANON_KEY=... SITE_URL=https://user.github.io/REPO node scripts/build-seo.mjs
// للاختبار بلا اتصال: MOCK_FILE=tests/seo/fixture.json
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const { SUPABASE_URL, SUPABASE_ANON_KEY, MOCK_FILE } = process.env;
const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
const OUT = process.env.OUT_DIR || '.';
if (!SITE) { console.error('SITE_URL مطلوب'); process.exit(1); }

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const seg = s => String(s).trim().replace(/\s+/g, '-');
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmt = t => { if (!t) return ''; let [h, m] = String(t).split(':').map(Number); const p = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return `${h}:${String(m || 0).padStart(2, '0')} ${p}`; };

async function load() {
  if (MOCK_FILE) return JSON.parse(await readFile(MOCK_FILE, 'utf8'));
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('SUPABASE_URL و SUPABASE_ANON_KEY مطلوبان');
  const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  const get = async path => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: h }); if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`); return r.json(); };
  const cols = 'id,slug,title,name,spec,area,clinic,address,phone,whatsapp,days,open_from,open_to,years,edu,bio,services,photo_url,verified,lat,lng,updated_at,booking_enabled';
  const [doctors, ratings, cases] = await Promise.all([get(`doctors?select=${cols}&status=eq.approved`), get('doctor_ratings?select=*').catch(() => []), get('cases?select=doctor_id,title,cat,after_url,created_at&hidden=eq.false&order=created_at.desc&limit=1000')]);
  return { doctors, ratings, cases };
}

const page = ({ title, desc, canonical, body, jsonld, image }) => `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website"><meta property="og:locale" content="ar_IQ"><meta property="og:site_name" content="دكتور أور">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(image || SITE + '/icon-512.png')}">
<meta name="twitter:card" content="summary"><meta name="theme-color" content="#06141E"><link rel="icon" href="${SITE}/favicon.png">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
<style>body{margin:0;background:#06141E;color:#F2ECDF;font:17px/1.8 "IBM Plex Sans Arabic",Tahoma,sans-serif}main{max-width:880px;margin:0 auto;padding:28px 18px 60px}a{color:#E9C77D}h1,h2{font-family:"Readex Pro",Tahoma,sans-serif;line-height:1.2}h1{font-size:32px;margin:10px 0}h2{font-size:21px;color:#F3D892;margin-top:28px}.btn{display:inline-block;background:linear-gradient(180deg,#F6DC9A,#B9893A);color:#1C1305;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600;margin:6px 0 6px 8px}.btn.o{background:none;border:1px solid #D6AE5C;color:#F2ECDF}.card{display:block;border:1px solid rgba(214,174,92,.3);border-radius:16px;padding:14px 16px;margin:10px 0;text-decoration:none;color:inherit}.muted{color:#9FB2BC}.pill{display:inline-block;border:1px solid rgba(214,174,92,.4);border-radius:999px;padding:2px 12px;margin:2px;font-size:14px}img.av{width:110px;height:110px;border-radius:50%;object-fit:cover;border:3px solid #D6AE5C}nav{font-size:14px}</style></head>
<body><main><nav><a href="${SITE}/">دكتور أور</a> › ${body.crumb || ''}</nav>${body.html}
<p class="muted" style="margin-top:40px;font-size:14px">دكتور أور — دليل أطباء الأسنان في محافظة ذي قار. <a href="${SITE}/privacy.html">الخصوصية والشروط</a></p></main></body></html>`;

function doctorPage(d, r, cases) {
  const key = d.slug || d.id, url = `${SITE}/doctor/${encodeURIComponent(key)}/`, app = `${SITE}/#/d/${encodeURIComponent(key)}`;
  const name = `${d.title || 'د.'} ${d.name}`;
  const title = `${name} — ${d.spec} في ${d.area} | دكتور أور`;
  const desc = `${name}، ${d.spec} في ${d.area}${d.clinic ? '، ' + d.clinic : ''}.${d.years ? ` خبرة ${d.years} سنة.` : ''} أوقات الدوام والعنوان والحالات قبل وبعد${d.booking_enabled ? ' والحجز المباشر' : ''}.`;
  const ld = { '@context': 'https://schema.org', '@type': 'Dentist', name, url, medicalSpecialty: 'Dentistry',
    address: { '@type': 'PostalAddress', addressLocality: d.area, addressRegion: 'ذي قار', addressCountry: 'IQ', ...(d.address ? { streetAddress: d.address } : {}) } };
  if (d.phone) ld.telephone = d.phone;
  if (/^https:\/\//.test(d.photo_url || '')) ld.image = d.photo_url;
  if (d.lat && d.lng) ld.geo = { '@type': 'GeoCoordinates', latitude: +d.lat, longitude: +d.lng };
  if ((d.days || []).length && d.open_from && d.open_to) ld.openingHoursSpecification = [{ '@type': 'OpeningHoursSpecification', dayOfWeek: d.days.map(i => SCHEMA_DAYS[i]), opens: d.open_from.slice(0, 5), closes: d.open_to.slice(0, 5) }];
  if (r && r.review_count > 0) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: +r.avg_rating, reviewCount: r.review_count, bestRating: 5, worstRating: 1 };
  const html = `${/^https:\/\//.test(d.photo_url || '') ? `<img class="av" src="${esc(d.photo_url)}" alt="${esc(name)}" width="110" height="110">` : ''}
  <h1>${esc(name)}${d.verified ? ' <span title="موثّق" style="color:#D6AE5C">✓</span>' : ''}</h1>
  <p>${esc(d.spec)} · <a href="${SITE}/area/${encodeURIComponent(seg(d.area))}/">${esc(d.area)}</a>${d.clinic ? ' · ' + esc(d.clinic) : ''}</p>
  ${r && r.review_count ? `<p><span class="pill">★ ${(+r.avg_rating).toFixed(1)} من ${r.review_count} تقييم موثّق</span></p>` : ''}
  <p><a class="btn" href="${app}">${d.booking_enabled ? 'احجز موعداً' : 'افتح صفحة الطبيب'}</a>${d.phone ? `<a class="btn o" href="tel:${esc(String(d.phone).replace(/[^\d+]/g, ''))}">اتصال ${esc(d.phone)}</a>` : ''}</p>
  ${d.bio ? `<h2>نبذة</h2><p>${esc(d.bio)}</p>` : ''}
  ${(d.services || []).length ? `<h2>الخدمات</h2><p>${d.services.map(s => `<span class="pill">${esc(s)}</span>`).join(' ')}</p>` : ''}
  ${d.edu || d.years ? `<h2>المؤهلات والخبرة</h2><p>${esc(d.edu || '')}${d.years ? ` — ${+d.years} سنة في الممارسة` : ''}</p>` : ''}
  <h2>الدوام والعنوان</h2><p>${(d.days || []).length ? d.days.map(i => DAYS[i]).join('، ') : 'لم تُحدَّد الأيام'}${d.open_from ? ` · من ${fmt(d.open_from)} إلى ${fmt(d.open_to)}` : ''}</p><p>${esc(d.address || d.area)}${d.lat && d.lng ? ` · <a href="https://www.google.com/maps/dir/?api=1&destination=${+d.lat},${+d.lng}" rel="noopener">الاتجاهات</a>` : ''}</p>
  ${cases.length ? `<h2>حالات منشورة (${cases.length})</h2>${cases.slice(0, 12).map(c => `<p class="muted">• ${esc(c.title)} — ${esc(c.cat || '')}</p>`).join('')}<p><a href="${app}">شاهد صور قبل وبعد</a></p>` : ''}
  <h2>تخصص مشابه</h2><p><a href="${SITE}/spec/${encodeURIComponent(seg(d.spec))}/">كل أطباء ${esc(d.spec)} في ذي قار</a></p>`;
  return { path: `doctor/${key}`, url, lastmod: d.updated_at, html: page({ title, desc, canonical: url, image: ld.image, jsonld: ld, body: { crumb: `<a href="${SITE}/spec/${encodeURIComponent(seg(d.spec))}/">${esc(d.spec)}</a>`, html } }) };
}
function listPage(kind, label, docs, R) {
  const url = `${SITE}/${kind}/${encodeURIComponent(seg(label))}/`, title = kind === 'spec' ? `أطباء ${label} في ذي قار | دكتور أور` : `أطباء الأسنان في ${label} | دكتور أور`;
  const desc = `${docs.length} طبيب ${kind === 'spec' ? label + ' في محافظة ذي قار' : 'أسنان في ' + label}: العيادات وأوقات الدوام والحالات والحجز.`;
  const html = `<h1>${esc(kind === 'spec' ? `أطباء ${label} في ذي قار` : `أطباء الأسنان في ${label}`)}</h1><p class="muted">${docs.length} طبيب مسجّل ومعتمد في الدليل.</p>
  ${docs.map(d => { const r = R[d.id]; return `<a class="card" href="${SITE}/doctor/${encodeURIComponent(d.slug || d.id)}/"><b>${esc(d.title || 'د.')} ${esc(d.name)}${d.verified ? ' ✓' : ''}</b><br><span class="muted">${esc(d.spec)} · ${esc(d.area)}${d.clinic ? ' · ' + esc(d.clinic) : ''}${r && r.review_count ? ` · ★ ${(+r.avg_rating).toFixed(1)}` : ''}</span></a>`; }).join('')}
  <p><a class="btn" href="${SITE}/#/${kind}/${encodeURIComponent(label)}">افتح في الدليل التفاعلي</a></p>`;
  return { path: `${kind}/${seg(label)}`, url, html: page({ title, desc, canonical: url, body: { crumb: esc(label), html }, jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: title, itemListElement: docs.map((d, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/doctor/${encodeURIComponent(d.slug || d.id)}/` })) } }) };
}

const { doctors, ratings = [], cases = [] } = await load();
const R = Object.fromEntries(ratings.map(r => [r.doctor_id, r]));
const byDoc = {}; cases.forEach(c => (byDoc[c.doctor_id] ||= []).push(c));
const pages = doctors.map(d => doctorPage(d, R[d.id], byDoc[d.id] || []));
const group = k => Object.entries(doctors.reduce((a, d) => ((a[d[k]] ||= []).push(d), a), {}));
group('spec').forEach(([s, L]) => pages.push(listPage('spec', s, L, R)));
group('area').forEach(([s, L]) => pages.push(listPage('area', s, L, R)));
for (const dir of ['doctor', 'spec', 'area']) await rm(join(OUT, dir), { recursive: true, force: true });
for (const p of pages) { await mkdir(join(OUT, p.path), { recursive: true }); await writeFile(join(OUT, p.path, 'index.html'), p.html); }
const today = new Date().toISOString().slice(0, 10);
const urls = [{ url: `${SITE}/`, lastmod: today }, { url: `${SITE}/privacy.html` }, ...pages.map(p => ({ url: p.url, lastmod: (p.lastmod || today).slice(0, 10) }))];
await writeFile(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u.url)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`);
await writeFile(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /offline.html\nDisallow: /404.html\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`✓ ${doctors.length} طبيب، ${pages.length} صفحة، sitemap بـ ${urls.length} رابط`);
