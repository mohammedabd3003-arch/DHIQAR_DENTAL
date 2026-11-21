// مكوّنات مشتركة: الطبيب، الحالة، النجوم، نافذة الحالة
import { esc, openNow, docHref, kmTxt, waLink, openModal, toast, errMsg, sessionKey, dayLabel } from '../core/util.js';
import { safeImg, VF, IX } from '../core/art.js';
import { S } from '../core/state.js';
const COLORS = ['#0B2C3D', '#174A5E', '#6B4A1A', '#2C4A6A', '#3D4F3A', '#5A2E3A'];
export const initial = d => esc(String(d.name || '؟').replace(/^د\s*\.?\s*/, '').trim().charAt(0) || '؟');
const colorOf = d => { let h = 0; for (const c of String(d.id || d.name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
export const avatar = (d, cls = '') => { const src = safeImg(d.photo_url); return src ? `<div class="av ${cls}"><img src="${src}" alt="" loading="lazy"></div>` : `<div class="av ${cls}" style="background:${colorOf(d)}" aria-hidden="true">${initial(d)}</div>`; };
export const nm = d => `${d.title ? esc(d.title) + ' ' : ''}${esc(d.name)}${d.verified ? VF : ''}`;
export const openPill = d => { const o = openNow(d); return o === null ? '' : `<span class="pill ${o ? 'open' : ''}">${o ? 'مفتوح الآن' : 'مغلق الآن'}</span>`; };
export const stars = (v, size = '') => { const r = Math.round(+v || 0); return `<span class="stars" style="${size}" aria-label="${(+v || 0).toFixed(1)} من 5">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= r ? '' : 'off'}">★</span>`).join('')}</span>`; };
export const ratingPill = d => d.review_count ? `<span class="pill gold">★ ${(+d.avg_rating).toFixed(1)} (${d.review_count})</span>` : '';
export const docCard = (d, km) => `<a class="card ${d.featured ? 'feat' : ''}" href="${docHref(d)}">${avatar(d)}<div style="flex:1"><b>${nm(d)}</b><span class="sub">${esc(d.spec)} · ${esc(d.area)}${d.clinic ? ' · ' + esc(d.clinic) : ''}</span><div class="meta">${d.featured ? '<span class="pill gold">مميّز</span>' : ''}${openPill(d)}${ratingPill(d)}<span class="pill">${d.case_count || 0} حالة</span>${d.booking_enabled ? '<span class="pill">حجز مباشر</span>' : ''}${km != null ? `<span class="pill gold">${kmTxt(km)}</span>` : ''}</div></div></a>`;
export const tile = (c, d) => `<button class="case" data-c="${esc(c.id)}"><div class="ph"><img src="${safeImg(c.after_url)}" alt="${esc(c.title)}" loading="lazy" decoding="async"><span class="tag">${esc(c.cat)}</span>${c.hidden ? '<span class="hid">مخفية</span>' : ''}</div><div class="tx"><b>${esc(c.title)}</b><span>${d ? esc(d.name) : ''}</span></div></button>`;
export function bindTiles(root, list, d) { root.querySelectorAll('.case').forEach(b => b.onclick = () => openCase(list.find(c => c.id === b.dataset.c), d)); }
export const popHtml = (d, km) => `<div class="pop"><div class="hd">${avatar(d, 'sm')}<div><b>${nm(d)}</b><span class="sp">${esc(d.spec)} · ${esc(d.area)}</span></div></div>
  <div class="meta" style="margin:0">${openPill(d)}${km != null ? `<span class="pill gold">${kmTxt(km)}</span>` : ''}${ratingPill(d)}</div>
  <div class="pb"><a class="btn sm dk" href="${docHref(d)}">ملف الطبيب</a>${d.whatsapp || d.phone ? `<a class="btn sm wa" data-wa="${esc(d.id)}" href="${waLink(d)}" target="_blank" rel="noopener">واتساب</a>` : ''}</div></div>`;
export function openCase(c, dd) {
  if (!c) return; const d = dd || S.docs.find(x => x.id === c.doctor_id), b = safeImg(c.before_url), a = safeImg(c.after_url);
  openModal(`${b ? `<div class="ba" dir="ltr"><img src="${b}" alt="قبل العلاج"><div class="after" id="af" style="clip-path:inset(0 0 0 50%)"><img src="${a}" alt="بعد العلاج"></div><div class="bar" id="bar" style="left:50%"></div><span class="lb" style="left:12px">قبل</span><span class="lb" style="right:12px">بعد</span><input type="range" min="0" max="100" value="50" id="rg" aria-label="اسحب لمقارنة قبل وبعد"></div>` : `<div class="ba"><img src="${a}" alt="${esc(c.title)}"></div>`}
  <div class="tx"><div class="acts" style="margin:0 0 8px;justify-content:space-between;align-items:center"><span class="pill gold">${esc(c.cat)}</span><span class="hint">${dayLabel(c.created_at)}</span></div>
  <h2 style="margin:4px 0 6px">${esc(c.title)}</h2>${c.sessions ? `<p style="color:var(--muted);margin:0 0 8px">مدة العلاج: ${esc(c.sessions)}</p>` : ''}<p style="margin:0 0 14px">${esc(c.note)}</p>
  <div class="acts" style="margin:0 0 12px"><a class="btn sm" href="${a}" target="_blank" rel="noopener">تكبير الصورة</a>${b ? `<a class="btn sm" href="${b}" target="_blank" rel="noopener">صورة «قبل» كاملة</a>` : ''}</div>
  ${d ? `<a class="card" href="${docHref(d)}">${avatar(d)}<div><b>${nm(d)}</b><span class="sub">${esc(d.spec)} · ${esc(d.area)}</span></div></a>` : ''}
  <div id="rep" style="margin-top:12px"><button class="linkb" id="repb">الإبلاغ عن هذه الحالة</button></div></div>`);
  const rg = document.getElementById('rg'); rg && (rg.oninput = () => { document.getElementById('af').style.clipPath = `inset(0 0 0 ${rg.value}%)`; document.getElementById('bar').style.left = rg.value + '%'; });
  document.getElementById('repb').onclick = () => reportForm(document.getElementById('rep'), { caseId: c.id });
}
export const REASONS = ['الصورة تُظهر هوية المريض', 'نُشرت دون موافقة المريض', 'محتوى غير لائق', 'ليست من عمل الطبيب', 'معلومات مضللة', 'سبب آخر'];
export function reportForm(box, { caseId = null, reviewId = null }) {
  box.innerHTML = `<form class="f" id="repf"><label>سبب البلاغ<select name="r">${REASONS.map(r => `<option>${r}</option>`).join('')}</select></label><label>تفاصيل (اختياري)<input name="d" maxlength="200"></label><button class="btn pri">إرسال البلاغ للإدارة</button></form>`;
  box.querySelector('#repf').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); const b = e.target.querySelector('button'); b.disabled = true;
    try { await S.api.report(caseId, reviewId, [f.get('r'), f.get('d')].filter(Boolean).join(' — ')); box.innerHTML = '<p style="color:var(--ok)">وصل بلاغك للإدارة، شكراً لك.</p>'; } catch (er) { toast(errMsg(er)); b.disabled = false; } };
}
