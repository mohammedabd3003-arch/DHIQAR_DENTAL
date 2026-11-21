// أدوات عامة: DOM، النصوص، الوقت بتوقيت بغداد، الهاتف، الرسائل
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- النص العربي ---------- */
export const norm = s => String(s || '').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();

/* ---------- الوقت: العراق UTC+3 ثابت بلا توقيت صيفي ---------- */
const BAGHDAD_MS = 3 * 3600e3;
export const bg = d => new Date(new Date(d).getTime() + BAGHDAD_MS); // استخدم getUTC* على الناتج
export const todayBG = () => { const n = bg(Date.now()); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };
export const isoDay = d => d.toISOString().slice(0, 10);
export const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
export const hm = d => { const b = bg(d); let h = b.getUTCHours(); const m = b.getUTCMinutes(); const p = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return `${h}:${String(m).padStart(2, '0')} ${p}`; };
export const dayLabel = d => { const b = bg(d); return `${DAYS[b.getUTCDay()]} ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`; };
export const fullWhen = d => `${dayLabel(d)} · ${hm(d)}`;
export const fmt = t => { if (!t) return ''; let [h, m] = String(t).split(':').map(Number); const p = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return `${h}:${String(m || 0).padStart(2, '0')} ${p}`; };
// قيمة datetime-local تُفسَّر بتوقيت بغداد
export const localToISO = v => v ? new Date(v + ':00+03:00').toISOString() : null;
export const isoToLocal = iso => { if (!iso) return ''; const b = bg(iso); return b.toISOString().slice(0, 16); };
const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
export function openNow(d) {
  if (!Array.isArray(d.days) || !d.days.length || !d.open_from || !d.open_to) return null;
  const b = bg(Date.now()), day = b.getUTCDay(), m = b.getUTCHours() * 60 + b.getUTCMinutes(), a = toMin(d.open_from), z = toMin(d.open_to);
  if (z > a) return d.days.includes(day) && m >= a && m < z;
  const prev = (day + 6) % 7; // دوام يمتد بعد منتصف الليل
  return (d.days.includes(day) && m >= a) || (d.days.includes(prev) && m < z);
}
export const ago = iso => { const s = (Date.now() - new Date(iso)) / 1000; if (s < 60) return 'الآن'; if (s < 3600) return 'قبل ' + Math.round(s / 60) + ' دقيقة'; if (s < 86400) return 'قبل ' + Math.round(s / 3600) + ' ساعة'; if (s < 86400 * 30) return 'قبل ' + Math.round(s / 86400) + ' يوم'; return dayLabel(iso); };

/* ---------- الهاتف والتواصل ---------- */
export const normPhone = p => { let d = String(p || '').replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, ''); if (/^9647\d{9}$/.test(d)) d = '0' + d.slice(3); else if (/^7\d{9}$/.test(d)) d = '0' + d; return d; };
export const validPhone = p => /^07\d{9}$/.test(normPhone(p));
const intl = p => { let n = String(p || '').replace(/\D/g, ''); if (n.startsWith('00')) n = n.slice(2); if (n.startsWith('0')) n = '964' + n.slice(1); return n; };
export const waLink = (d, msg = 'مرحباً دكتور، أتواصل معك عن طريق دليل بسمة ذي قار.') => `https://wa.me/${intl(d.whatsapp || d.phone)}?text=${encodeURIComponent(msg)}`;
export const telLink = d => `tel:${String(d.phone || '').replace(/[^\d+]/g, '')}`;

/* ---------- الجغرافيا ---------- */
export const hasLoc = d => d && d.lat !== null && d.lat !== '' && d.lng !== null && Number.isFinite(+d.lat) && Number.isFinite(+d.lng) && !(+d.lat === 0 && +d.lng === 0);
export function haversine(a, b) { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
export const kmTxt = k => k < 1 ? `${Math.round(k * 1000)} م` : `${k < 10 ? k.toFixed(1) : Math.round(k)} كم`;

/* ---------- المعرّفات والروابط ---------- */
export const isUUID = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
export const docKey = d => d.slug || d.id;
export const docHref = d => '#/d/' + encodeURIComponent(docKey(d));
export const baseUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
export const pageUrl = d => baseUrl() + docHref(d);
export const uidGen = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

/* ---------- التخزين المحلي الآمن ---------- */
export const store = {
  get(k, def = null) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};
export const sessionKey = () => { let k = store.get('basma_sk'); if (!k) { k = uidGen(); store.set('basma_sk', k); } return k; };

/* ---------- واجهة المستخدم ---------- */
export function toast(t, ms = 3200) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), ms); }
export function toastAction(t, label, fn) { const e = $('#toast'); e.innerHTML = `${esc(t)} <button class="btn sm pri" style="margin-inline-start:10px">${esc(label)}</button>`; e.style.pointerEvents = 'auto'; e.classList.add('on'); e.querySelector('button').onclick = fn; }
export async function copy(t) { try { await navigator.clipboard.writeText(t); toast('تم النسخ'); } catch { toast(t); } }
export async function share(title, url) { if (navigator.share) { try { await navigator.share({ title, url }); return; } catch { return; } } copy(url); }
export const setApp = h => { $('#app').innerHTML = h; };
export const wrapMsg = t => `<div class="band"><div class="wrap"><div class="msg">${t}</div></div></div>`;
export function setDact(h) { const e = $('#dact'); e.innerHTML = h; e.hidden = !h; document.body.classList.toggle('has-dact', !!h); }
export function openModal(html, onClose) {
  const m = $('#modal'); $('#mbox').innerHTML = `<button class="x" id="mx" aria-label="إغلاق">×</button>${html}`;
  m.classList.add('on'); m._onClose = onClose; $('#mx').onclick = closeModal;
  const f = $('#mbox').querySelector('input,select,textarea,button:not(#mx)'); setTimeout(() => f && f.focus({ preventScroll: true }), 50);
}
export function closeModal() { const m = $('#modal'); if (!m.classList.contains('on')) return; m.classList.remove('on'); const f = m._onClose; m._onClose = null; f && f(); }
export function confirm2(b, fn) { if (b.dataset.sure !== '1') { const t = b.textContent; b.dataset.sure = '1'; b.textContent = 'تأكيد؟'; setTimeout(() => { b.dataset.sure = ''; b.textContent = t; }, 4000); return; } b.disabled = true; fn().catch(er => { toast(errMsg(er)); b.disabled = false; }); }
export const skel = (n, h = 98) => `<div class="sk" style="height:${h}px"></div>`.repeat(n);
export function bars(rows) { const mx = Math.max(1, ...rows.map(r => r[1])); return `<div class="bars">${rows.map(([l, v]) => `<div class="brow"><span>${esc(l)}</span><span><i style="width:${Math.max(2, v / mx * 100)}%"></i></span><span class="num">${v}</span></div>`).join('')}</div>`; }
export function setMeta(title, desc) { document.title = title ? `${title} — بسمة ذي قار` : 'بسمة ذي قار — دليل أطباء الأسنان'; const m = document.querySelector('meta[name=description]'); if (m && desc) m.setAttribute('content', desc); }

/* ---------- رسائل الأخطاء ---------- */
export function errMsg(e) {
  const m = String(e?.message || e || '');
  if (/Invalid login/i.test(m)) return 'البريد أو كلمة المرور غير صحيحة';
  if (/already registered/i.test(m)) return 'هذا البريد مسجّل مسبقاً، استخدم تسجيل الدخول';
  if (/Password should|weak password/i.test(m)) return 'كلمة المرور قصيرة أو ضعيفة (8 أحرف على الأقل)';
  if (/Email not confirmed/i.test(m)) return 'فعّل حسابك من رسالة البريد أولاً';
  if (/rate limit|too many/i.test(m)) return 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'تعذّر الاتصال بالإنترنت، تحقّق من الشبكة';
  if (/doctors_slug_uidx|duplicate key.*slug/i.test(m)) return 'هذا الرابط المخصص مستخدم، اختر غيره';
  if (/doctors_slug_chk/.test(m)) return 'الرابط المخصص: حروف إنجليزية صغيرة وأرقام وشرطة فقط (3–40)';
  if (/column .*does not exist|function .* does not exist|relation .* does not exist/i.test(m)) return 'قاعدة البيانات تحتاج تحديثاً: شغّل ملف 003_platform.sql';
  if (/mime|file size|Payload too large|exceeded/i.test(m)) return 'الملف كبير أو نوعه غير مسموح';
  if (m === 'img' || m === 'big') return 'تعذّر قراءة الصورة، جرّب صورة أخرى';
  if (/row-level security|permission denied|غير مسموح/i.test(m)) return 'ليست لديك صلاحية لهذا الإجراء';
  if (/[؀-ۿ]/.test(m)) return m.replace(/^.*?ERROR:\s*/, '');
  return 'حدث خطأ غير متوقع، أعد المحاولة';
}
