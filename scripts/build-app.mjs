#!/usr/bin/env node
// يجهّز مجلد www/ لتطبيق Capacitor من نفس ملفات الموقع — لا يغيّر أي ملف في المشروع.
//  - ينسخ ملفات الويب، ويضمّن المكتبات والخطوط محلياً (لا تحميل من الإنترنت عند فتح التطبيق)
//  - يشدّد سياسة CSP لنسخة التطبيق فقط، ولا ينسخ Service Worker
//  - يرفض البناء بلا إعدادات Supabase أو بمفتاح سري
// التشغيل: npm run build:app   (يحتاج إنترنت أول مرة لتنزيل المكتبات إلى .vendor-cache/)
// بلا إنترنت: VENDOR_DIR=مجلد_فيه_الملفات npm run build:app
import { readFile, writeFile, mkdir, rm, cp, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'www');
const CACHE = process.env.VENDOR_DIR || join(ROOT, '.vendor-cache');
const exists = p => access(p).then(() => true, () => false);
const die = m => { console.error('\n✖ ' + m + '\n'); process.exit(1); };

/* ---------- 1) الإعدادات ---------- */
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
if (!await exists(join(ROOT, 'config.js'))) die('config.js غير موجود. انسخ config.example.js باسم config.js وضع فيه رابط ومفتاح Supabase.');
const cfgSrc = await readFile(join(ROOT, 'config.js'), 'utf8');
const sandbox = { window: {} }; try { vm.runInNewContext(cfgSrc, sandbox, { timeout: 500 }); } catch (e) { die('config.js فيه خطأ كتابة: ' + e.message); }
const cfg = { ...(sandbox.window.BASMA_CONFIG || {}) };
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.SUPABASE_URL || '')) die('SUPABASE_URL في config.js فارغ أو غير صحيح — التطبيق لن يُبنى بالوضع التجريبي.');
const key = String(cfg.SUPABASE_ANON_KEY || '');
if (!key) die('SUPABASE_ANON_KEY فارغ في config.js.');
if (/^sb_secret_/i.test(key)) die('المفتاح في config.js مفتاح سري (sb_secret_). ضع المفتاح العام Publishable فقط.');
if (key.split('.').length === 3) { try { const p = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); if (p.role === 'service_role') die('المفتاح في config.js هو service_role. ضع المفتاح العام anon فقط.'); } catch { } }
cfg.PUBLIC_SITE_URL = String(cfg.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || pkg.basma?.publicSiteUrl || '').trim();
if (!/^https:\/\//.test(cfg.PUBLIC_SITE_URL)) die('PUBLIC_SITE_URL مطلوب (رابط الموقع العام) في config.js أو package.json → basma.publicSiteUrl.');
if (!cfg.PUBLIC_SITE_URL.endsWith('/')) cfg.PUBLIC_SITE_URL += '/';

/* ---------- 2) المكتبات والخطوط ---------- */
const LIBS = [
  ['supabase.js', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@' + (pkg.basma?.supabaseJs || '2') + '/dist/umd/supabase.js'],
  ['leaflet.js', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'],
  ['leaflet.css', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'],
  ['qrcode.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js']
];
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
async function get(url, bin) {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return bin ? Buffer.from(await r.arrayBuffer()) : r.text();
}
await mkdir(join(CACHE, 'fonts'), { recursive: true });
for (const [name, url] of LIBS) {
  const p = join(CACHE, name);
  if (await exists(p)) continue;
  if (process.env.VENDOR_DIR) die(`الملف ${name} غير موجود في ${CACHE}`);
  console.log('↓', name); try { await writeFile(p, await get(url, true)); } catch (e) { die('تعذّر تنزيل ' + name + ' (تحقق من الإنترنت): ' + e.message); }
}
const fontsCssPath = join(CACHE, 'fonts.css');
if (!await exists(fontsCssPath)) {
  if (process.env.VENDOR_DIR) die(`fonts.css غير موجود في ${CACHE}`);
  console.log('↓ الخطوط');
  let css; try { css = await get(FONTS_CSS); } catch (e) { die('تعذّر تنزيل الخطوط: ' + e.message); }
  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))];
  let i = 0;
  for (const u of urls) { const f = `f${++i}.woff2`; await writeFile(join(CACHE, 'fonts', f), await get(u, true)); css = css.split(u).join(`../js/vendor/fonts/${f}`); }
  await writeFile(fontsCssPath, css);
}

/* ---------- 3) نسخ ملفات الويب ---------- */
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const f of ['css', 'js']) await cp(join(ROOT, f), join(OUT, f), { recursive: true });
for (const f of ['favicon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'privacy.html']) if (await exists(join(ROOT, f))) await cp(join(ROOT, f), join(OUT, f));
await mkdir(join(OUT, 'js/vendor/fonts'), { recursive: true });
for (const [name] of LIBS) await cp(join(CACHE, name), join(OUT, 'js/vendor', name));
await cp(join(CACHE, 'fonts'), join(OUT, 'js/vendor/fonts'), { recursive: true });
await cp(fontsCssPath, join(OUT, 'css/fonts.css'));

// config.js للتطبيق: نفس القيم + الرابط العام
await writeFile(join(OUT, 'config.js'), `// مولّد تلقائياً بواسطة scripts/build-app.mjs — لا تعدّله هنا\nwindow.BASMA_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);

/* ---------- 4) index.html لنسخة التطبيق ---------- */
let html = await readFile(join(ROOT, 'index.html'), 'utf8');
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org; connect-src 'self' https://*.supabase.co wss://*.supabase.co; base-uri 'self'; form-action 'self'; object-src 'none'";
const before = html;
html = html.replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*">/, `<meta http-equiv="Content-Security-Policy" content="${CSP}">`)
  .replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>\n?/, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, '<link rel="stylesheet" href="css/fonts.css">')
  .replace(/<link rel="manifest"[^>]*>\n?/, '');
if (html === before || !html.includes('css/fonts.css') || html.includes('googleapis')) die('تعذّر تعديل index.html لنسخة التطبيق — تغيّر شكل الملف؟');
await writeFile(join(OUT, 'index.html'), html);

/* ---------- 5) فحص نهائي: لا روابط CDN في ملفات التطبيق ---------- */
const { readdir } = await import('node:fs/promises');
async function* walk(d) { for (const e of await readdir(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) yield* walk(p); else yield p; } }
let files = 0;
for await (const p of walk(OUT)) { files++; if (!/\.(js|html)$/.test(p) || p.includes('/vendor/')) continue; const s = await readFile(p, 'utf8'); if (/fonts\.googleapis|<script[^>]+src="https?:/.test(s)) die('ما زال هناك تحميل من الإنترنت في ' + p); }
console.log(`✔ www/ جاهز (${files} ملف) — الرابط العام: ${cfg.PUBLIC_SITE_URL}`);
console.log('  التالي: npx cap sync');
