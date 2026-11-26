// نقطة البداية: اختيار الخدمة، التوجيه، الشريط العلوي والسفلي، الإشعارات، السمة، تحديث التطبيق
import { $, $$, esc, toast, toastAction, setApp, setDact, wrapMsg, closeModal, openModal, setMeta, store, ago, errMsg } from './core/util.js';
import { S, isStaff, myTokens } from './core/state.js';
import { BI, IB, IX, emptyBox } from './core/art.js';
import { killMaps } from './core/maps.js';
import { Live } from './services/live.js';
import { Demo } from './services/demo.js';
import { isNative, initNative, statusBar } from './core/native.js';
import { pageHome, readQuery } from './pages/home.js';
import { pageMap } from './pages/map.js';
import { pageDoctor } from './pages/doctor.js';
import { pageTrack, pageMy } from './pages/booking.js';
import { pageLogin, pageNewPass } from './pages/auth.js';

export const VERSION = '5.1.0';
const cfg = window.BASMA_CONFIG || {};
const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
S.api = LIVE ? Live(cfg) : Demo();

/* ---------- السمة ---------- */
function applyTheme(t) { document.documentElement.dataset.theme = t; store.set('basma_theme', t); const m = document.querySelector('meta[name=theme-color]'); m && m.setAttribute('content', t === 'light' ? '#F7F3EA' : '#06141E'); statusBar(t); const b = $('#themeBtn'); if (b) { b.innerHTML = t === 'light' ? IB.moon : IB.sun; b.setAttribute('aria-label', t === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'); } }

/* ---------- التنقل ---------- */
function nav() {
  const r = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  const L = [['', 'الأطباء'], ['map', 'خارطة الأطباء'], ['cases', 'الحالات']];
  if (isStaff()) L.push(['admin', 'الإدارة']);
  if (S.me) L.push(S.role === 'patient' ? ['my', 'حجوزاتي'] : ['dash', 'لوحتي']);
  else { if (myTokens().length) L.push(['my', 'حجوزاتي']); L.push(['login', 'دخول']); }
  const on = k => r === k || (k === 'dash' && r === 'login') || (k === '' && ['d', 'spec', 'area'].includes(r));
  $('#nav').innerHTML = L.map(([k, t], i) => `<a href="#/${k}" class="${on(k) ? 'on' : ''} ${i === L.length - 1 ? 'cta' : ''}" ${on(k) ? 'aria-current="page"' : ''}>${i === L.length - 1 ? IX.user : ''}${t}</a>`).join('');
  const short = { '': 'الأطباء', map: 'الخارطة', cases: 'الحالات', admin: 'الإدارة', dash: 'لوحتي', login: 'دخول', my: 'حجوزاتي' };
  const BL = L.filter(([k]) => !(k === 'my' && L.some(x => x[0] === 'login')));
  $('#bnav').innerHTML = BL.map(([k]) => `<a href="#/${k}" class="${on(k) ? 'on' : ''}" ${on(k) ? 'aria-current="page"' : ''}><i>${BI[k] || BI.dash}</i>${short[k]}</a>`).join('');
  $('#bell').hidden = !S.me;
}

/* ---------- الإشعارات ---------- */
async function refreshBell() { if (!S.me) return; try { S.unread = await S.api.unreadCount(); const c = $('#bellCnt'); c.hidden = !S.unread; c.textContent = S.unread > 9 ? '9+' : S.unread; } catch { } }
async function openBell() {
  openModal(`<div class="tx"><div class="sec-head" style="margin-bottom:12px"><h2>الإشعارات</h2><button class="btn sm" id="allr">تعليم الكل كمقروء</button></div><div class="list" id="nl">${'<div class="sk" style="height:60px"></div>'.repeat(3)}</div></div>`);
  let L = []; try { L = await S.api.notifications(); } catch (er) { $('#nl').innerHTML = emptyBox(errMsg(er)); return; }
  $('#nl').innerHTML = L.length ? L.map(n => `<button class="ntf ${n.read_at ? '' : 'unread'}" data-id="${esc(n.id)}" data-l="${esc(n.link || '')}"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}<span>${ago(n.created_at)}</span></button>`).join('') : emptyBox('لا توجد إشعارات.');
  $$('#nl .ntf').forEach(b => b.onclick = async () => { await S.api.markRead(b.dataset.id); closeModal(); refreshBell(); if (b.dataset.l) location.hash = b.dataset.l; });
  $('#allr').onclick = async () => { await S.api.markAllRead(); closeModal(); refreshBell(); };
}

/* ---------- المستخدم ---------- */
async function refreshUser() { S.me = await S.api.user(); S.role = S.me ? await S.api.role().catch(() => 'patient') : null; nav(); refreshBell(); }

/* ---------- التوجيه ---------- */
async function route() {
  closeModal(); killMaps(); setDact(''); nav();
  const raw = location.hash.replace(/^#\/?/, ''), [path, qs] = raw.split('?'), p = path.split('/').map(decodeURIComponent), params = new URLSearchParams(qs || '');
  try {
    switch (p[0]) {
      case '': readQuery(qs); return await pageHome();
      case 'cases': return await pageHome({ toCases: true });
      case 'spec': return await pageHome({ preset: { spec: p[1] || '' } });
      case 'area': return await pageHome({ preset: { area: p[1] || '' } });
      case 'map': return await pageMap();
      case 'd': return await pageDoctor(p[1]);
      case 'b': return await pageTrack(p[1]);
      case 'my': return await pageMy();
      case 'login': return pageLogin(params, refreshUser);
      case 'newpass': return pageNewPass();
      case 'dash': { const { pageDash } = await import('./pages/dash.js'); return await pageDash(p[1], refreshUser); }
      case 'admin': { const { pageAdmin } = await import('./pages/admin.js'); return await pageAdmin(p[1]); }
      default: setMeta('الصفحة غير موجودة'); setApp(`<div class="nf"><b>404</b><h1 style="font-size:26px">الصفحة غير موجودة</h1><p class="hint">ربما تغيّر الرابط.</p><a class="btn pri" href="#/">العودة للدليل</a></div>`);
    }
  } catch (e) { console.error(e); setApp(wrapMsg(`تعذّر تحميل البيانات. ${esc(errMsg(e))} <button class="btn sm" data-reload>إعادة المحاولة</button>`)); }
}

/* ---------- تحديث التطبيق (PWA) ---------- */
function registerSW() {
  // داخل التطبيق لا Service Worker: التحديثات تأتي من المتجر، والملفات مضمّنة أصلاً
  if (isNative || !('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const prompt = w => toastAction('نسخة جديدة من التطبيق جاهزة', 'تحديث', () => w.postMessage('skipWaiting'));
    if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w); }); });
    setInterval(() => reg.update().catch(() => { }), 30 * 60e3);
  }).catch(() => { });
  let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

/* ---------- البداية ---------- */
(async () => {
  try { initNative({ isModalOpen: () => $('#modal').classList.contains('on'), closeModal }); } catch (e) { console.error(e); }
  applyTheme(store.get('basma_theme', 'dark'));
  $('#themeBtn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  $('#bell').onclick = openBell;
  document.addEventListener('click', e => { if (e.target.closest('[data-reload]')) location.reload(); });
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  const off = () => { $('#offline').hidden = navigator.onLine; }; addEventListener('online', off); addEventListener('offline', off); off();
  try { await S.api.init(); }
  catch (e) { console.error(e); setApp(wrapMsg(`تعذّر الاتصال بالخادم الآن. تحقّق من الإنترنت ثم <button class="btn sm pri" data-reload>أعد المحاولة</button>`)); return; }
  $('#demoBar').hidden = S.api.mode !== 'demo';
  const [lists, settings] = await Promise.all([S.api.lists().catch(() => null), S.api.settings().catch(() => ({}))]);
  if (lists) S.lists = { areas: lists.areas, specs: lists.specs, cats: lists.cats };
  S.settings = settings || {}; const an = S.settings.announcement;
  if (an?.active && an.text) { const e = $('#announce'); e.textContent = an.text; e.hidden = false; }
  await refreshUser();
  S.api.onAuth(async ev => { if (ev === 'PASSWORD_RECOVERY') { location.hash = '#/newpass'; return; } if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') { await refreshUser(); if (ev === 'SIGNED_OUT') S.tab = {}; } });
  addEventListener('hashchange', () => { route(); scrollTo(0, 0); });
  route();
  setInterval(refreshBell, 60e3);
  registerSW();
})();
