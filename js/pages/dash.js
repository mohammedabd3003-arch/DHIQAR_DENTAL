// لوحة الطبيب
import { $, $$, esc, DAYS, fmt, hm, fullWhen, dayLabel, todayBG, isoDay, localToISO, isoToLocal, toast, errMsg, setApp, setMeta, wrapMsg, confirm2, bars, copy, share, pageUrl, docHref, openModal, closeModal, ago, hasLoc, store } from '../core/util.js';
import { S, STATUS, BSTATUS } from '../core/state.js';
import { IC, IX, IB, ZIG, emptyBox, safeImg } from '../core/art.js';
import { avatar, nm, initial, stars } from '../components/doctor.js';
import { compress, checkImage, checkDoc } from '../core/media.js';
import { loadLeaflet, baseMap, docIcon, getGPS, CENTER, killMaps, loadScript } from '../core/maps.js';
import { isNative, saveImage, LIB } from '../core/native.js';

const TABS = [['home', 'الرئيسية'], ['bookings', 'المواعيد'], ['cases', 'حالاتي'], ['profile', 'ملفي'], ['verify', 'التوثيق'], ['stats', 'الإحصائيات'], ['reviews', 'التقييمات'], ['qr', 'بطاقة QR'], ['account', 'الحساب']];

export async function pageDash(tabArg, refreshUser) {
  if (!S.me) { location.hash = '#/login'; return; }
  setMeta('لوحة الطبيب'); setApp(wrapMsg('جارٍ تحميل لوحتك…'));
  let d = await S.api.getDoctor(S.me.id, true); const has = !!d; d = d || {};
  const banner = has ? `<div class="banner ${d.status}">${{ pending: 'طلبك قيد المراجعة. صفحتك لن تظهر للناس حتى الموافقة، ويمكنك تجهيز حالاتك وتقديم طلب التوثيق الآن.', approved: 'صفحتك منشورة ويراها المرضى.', rejected: 'لم تتم الموافقة على صفحتك. راجع بياناتك أو تواصل مع الإدارة.', suspended: 'صفحتك موقوفة مؤقتاً من الإدارة.' }[d.status]}</div>` : '<div class="banner pending">أكمل بياناتك وأرسلها للإدارة لتظهر صفحتك في الدليل.</div>';
  const tab = has ? (tabArg && TABS.some(t => t[0] === tabArg) ? tabArg : S.tab.dash || 'home') : 'profile';
  setApp(`<section class="band" style="padding-bottom:0"><div class="wrap"><div class="sec-head"><div style="display:flex;gap:14px;align-items:center">${has ? avatar(d, 'sm') : ''}<div><h1 style="font-size:26px">${has ? nm(d) : 'إنشاء صفحة طبيب'}</h1><p dir="ltr" style="text-align:right;margin:2px 0 0">${esc(S.me.email)}</p></div></div>
    <div class="acts" style="margin:0">${has ? `<a class="btn" href="${docHref(d)}">عرض صفحتي</a>` : ''}<button class="btn" id="out">خروج</button></div></div>${banner}</div></section>
  <nav class="tabs scroll" role="tablist">${(has ? TABS : [['profile', 'ملفي'], ['account', 'الحساب']]).map(([k, t]) => `<button data-t="${k}" role="tab">${t}</button>`).join('')}</nav>
  <section class="band"><div class="wrap" id="dc"></div></section>`);
  $('#out').onclick = async () => { await S.api.signOut(); await refreshUser(); location.hash = '#/'; };
  const go = t => { killMaps(); S.tab.dash = t; $$('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === t); b.setAttribute('aria-selected', b.dataset.t === t); }); ({ home, bookings, cases, profile, verify, stats, reviews, qr, account })[t](d, has, refreshUser); };
  $$('.tabs button').forEach(b => b.onclick = () => go(b.dataset.t)); go(tab);
}

/* ---------- الرئيسية ---------- */
async function home(d) {
  const c = $('#dc'); c.innerHTML = skelTiles();
  const [st, bk, vr] = await Promise.all([S.api.stats(30).catch(() => []), S.api.doctorBookings(new Date(Date.now() - 864e5).toISOString()).catch(() => []), S.api.myVerifications().catch(() => [])]);
  const sum = k => st.reduce((a, r) => a + (r[k] || 0), 0), pend = bk.filter(b => b.status === 'pending'), next = bk.filter(b => b.status === 'confirmed' && new Date(b.start_at) > new Date()).slice(0, 3);
  const v = vr[0];
  c.innerHTML = `<div class="tiles"><div class="tile"><b>${sum('views')}</b><span>زيارة للملف (30 يوماً)</span></div><div class="tile"><b>${sum('wa')}</b><span>نقرات واتساب</span></div><div class="tile"><b>${sum('calls')}</b><span>اتصالات</span></div><div class="tile"><b>${pend.length}</b><span>طلب حجز جديد</span></div><div class="tile"><b>${d.case_count || 0}</b><span>حالة منشورة</span></div><div class="tile"><b>${d.review_count ? (+d.avg_rating).toFixed(1) : '—'}</b><span>متوسط التقييم (${d.review_count || 0})</span></div></div>
  <div class="info">
    <div class="box"><h3>التوثيق</h3><p>${d.verified ? '✓ حسابك موثّق' : v ? { pending: 'طلبك قيد المراجعة', needs_info: 'الإدارة تطلب مستندات إضافية', rejected: 'رُفض الطلب الأخير', approved: 'موثّق' }[v.status] : 'لم تقدّم طلب توثيق بعد'}</p>${d.verified ? '' : '<button class="btn sm" style="margin-top:10px" data-go="verify">إدارة التوثيق</button>'}</div>
    <div class="box"><h3>المواعيد القادمة</h3>${next.length ? next.map(b => `<p style="margin:4px 0">${fullWhen(b.start_at)} — ${esc(b.patient_name)}</p>`).join('') : `<p class="hint">${d.booking_enabled ? 'لا مواعيد مؤكدة قادمة.' : 'الحجز الداخلي غير مفعّل.'}</p>`}<button class="btn sm" style="margin-top:10px" data-go="bookings">${d.booking_enabled ? 'إدارة المواعيد' : 'تفعيل الحجز'}</button></div>
    <div class="box"><h3>اكتمال الملف</h3>${completeness(d)}</div></div>`;
  c.querySelectorAll('[data-go]').forEach(b => b.onclick = () => $(`.tabs button[data-t="${b.dataset.go}"]`).click());
}
const skelTiles = () => `<div class="tiles">${'<div class="sk" style="height:96px"></div>'.repeat(6)}</div>`;
function completeness(d) {
  const items = [['صورة شخصية', !!d.photo_url], ['موقع على الخارطة', hasLoc(d)], ['أوقات الدوام', (d.days || []).length > 0], ['نبذة', !!d.bio], ['خدمات', (d.services || []).length > 0], ['رابط مخصص', !!d.slug], ['حالة منشورة', (d.case_count || 0) > 0]];
  const n = items.filter(x => x[1]).length;
  return `<div class="brow" style="grid-template-columns:minmax(0,1fr) 3em"><span><i style="width:${n / items.length * 100}%"></i></span><span class="num">${Math.round(n / items.length * 100)}%</span></div><p class="hint" style="margin-top:8px">${items.filter(x => !x[1]).map(x => x[0]).join('، ') || 'ملفك مكتمل 👌'}</p>`;
}

/* ---------- المواعيد ---------- */
async function bookings(d, has, refreshUser) {
  const c = $('#dc');
  c.innerHTML = `<div class="box" style="margin-bottom:16px"><form class="f" id="bset"><h3>إعدادات الحجز</h3>
    <label class="consent" style="background:var(--soft)"><input type="checkbox" name="en" ${d.booking_enabled ? 'checked' : ''}>تفعيل الحجز الداخلي (يظهر زر «احجز موعداً» في صفحتك)</label>
    <div class="row2"><label>مدة الموعد<select name="sm">${[10, 15, 20, 30, 45, 60].map(m => `<option value="${m}" ${+d.slot_minutes === m ? 'selected' : ''}>${m} دقيقة</option>`).join('')}</select></label>
    <label>ملاحظة للمرضى<input name="bn" maxlength="200" value="${esc(d.booking_note)}" placeholder="مثلاً: يرجى الحضور قبل الموعد بـ10 دقائق"></label></div>
    <p class="hint" style="margin:0">المواعيد تُحسب من أيام وساعات الدوام في «ملفي» بتوقيت بغداد. قاعدة البيانات تمنع حجز موعدين في الوقت نفسه.</p>
    <button class="btn pri" style="justify-self:start">حفظ الإعدادات</button></form></div>
    <div class="box" style="margin-bottom:16px"><h3>الإجازات والعطل</h3><form class="row2" id="offf" style="margin:10px 0;align-items:end"><label class="f" style="display:grid;gap:4px">من<input class="sel" type="date" name="a" required min="${isoDay(todayBG())}"></label><label class="f" style="display:grid;gap:4px">إلى<input class="sel" type="date" name="b" required min="${isoDay(todayBG())}"></label><input class="sel" name="n" maxlength="100" placeholder="سبب (اختياري)"><button class="btn sm">إضافة إجازة</button></form><div id="offs"></div></div>
    <div class="sec-head"><h2 style="font-size:22px">طلبات الحجز</h2><div class="seg2" id="bseg"><button data-v="new" class="on">الجديدة</button><button data-v="up">المؤكدة القادمة</button><button data-v="past">السابقة والملغاة</button></div></div>
    <div class="list" id="blist">${'<div class="sk"></div>'.repeat(3)}</div>`;
  $('#bset').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); try { await S.api.updateMyDoctor({ booking_enabled: !!f.get('en'), slot_minutes: +f.get('sm'), booking_note: String(f.get('bn')).trim() || null }); d.booking_enabled = !!f.get('en'); d.slot_minutes = +f.get('sm'); S.at = 0; toast('حُفظت إعدادات الحجز'); } catch (er) { toast(errMsg(er)); } };
  const offs = async () => { const l = await S.api.timeOff().catch(() => []); $('#offs').innerHTML = l.length ? l.map(t => `<div class="it"><div class="mid"><b>${dayLabel(t.starts_on + 'T12:00:00Z')} → ${dayLabel(t.ends_on + 'T12:00:00Z')}</b><span>${esc(t.note || '')}</span></div><button class="btn sm del" data-x="${esc(t.id)}">حذف</button></div>`).join('') : '<p class="hint">لا توجد إجازات قادمة.</p>'; $$('#offs [data-x]').forEach(b => b.onclick = () => confirm2(b, async () => { await S.api.delTimeOff(b.dataset.x); offs(); })); };
  $('#offf').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); if (f.get('b') < f.get('a')) return toast('تاريخ النهاية قبل البداية'); try { await S.api.addTimeOff(f.get('a'), f.get('b'), f.get('n')); e.target.reset(); offs(); toast('أُضيفت الإجازة، ولن تظهر مواعيد في أيامها'); } catch (er) { toast(errMsg(er)); } };
  offs();
  let all = [], view = 'new';
  const load = async () => { all = await S.api.doctorBookings(new Date(Date.now() - 30 * 864e5).toISOString()); draw(); };
  const draw = () => {
    const now = new Date(), L = view === 'new' ? all.filter(b => b.status === 'pending') : view === 'up' ? all.filter(b => b.status === 'confirmed' && new Date(b.end_at) > new Date(now - 6 * 36e5)) : all.filter(b => !['pending'].includes(b.status) && (new Date(b.start_at) < now || ['cancelled', 'rejected'].includes(b.status))).reverse();
    $('#blist').innerHTML = L.length ? L.map(b => bookingRow(b)).join('') : emptyBox(view === 'new' ? 'لا توجد طلبات جديدة.' : 'لا توجد مواعيد هنا.');
    $$('#blist [data-a]').forEach(btn => btn.onclick = () => act(btn));
  };
  const act = async btn => {
    const id = btn.dataset.id, a = btn.dataset.a, b = all.find(x => x.id === id);
    if (a === 'propose' || a === 'reschedule') {
      openModal(`<div class="tx"><h3>${a === 'propose' ? 'اقتراح موعد بديل' : 'تغيير الموعد'}</h3><form class="f" id="pf2" style="margin-top:12px"><label>الموعد الجديد (بتوقيت بغداد)<input type="datetime-local" name="t" required value="${isoToLocal(b.start_at)}"></label><label>ملاحظة للمريض<input name="n" maxlength="200"></label><button class="btn pri">${a === 'propose' ? 'إرسال الاقتراح' : 'حفظ الموعد'}</button></form></div>`);
      $('#pf2').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); try { await S.api.bookingAction(id, a, f.get('n'), localToISO(f.get('t'))); closeModal(); toast('تم'); load(); } catch (er) { toast(errMsg(er)); } };
      return;
    }
    if (['reject', 'cancel', 'no_show'].includes(a) && btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = 'تأكيد؟'; return; }
    btn.disabled = true; try { await S.api.bookingAction(id, a, null, null); toast({ confirm: 'تم تأكيد الموعد', reject: 'رُفض الطلب', complete: 'سُجّل الموعد مكتملاً، وصار بإمكان المريض تقييمك', no_show: 'سُجّل عدم الحضور', cancel: 'أُلغي الموعد' }[a] || 'تم'); load(); } catch (er) { toast(errMsg(er)); btn.disabled = false; }
  };
  $$('#bseg button').forEach(b => b.onclick = () => { view = b.dataset.v; $$('#bseg button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  load().catch(er => $('#blist').innerHTML = emptyBox(errMsg(er)));
}
function bookingRow(b) {
  const past = new Date(b.start_at) <= new Date(), B = (a, t, cls = '') => `<button class="btn sm ${cls}" data-a="${a}" data-id="${esc(b.id)}">${t}</button>`;
  const ops = b.status === 'pending' ? B('confirm', 'تأكيد', 'pri') + B('propose', 'اقتراح موعد آخر') + B('reject', 'رفض', 'del')
    : b.status === 'confirmed' ? (past ? B('complete', 'تم الموعد', 'pri') + B('no_show', 'لم يحضر', 'del') : B('reschedule', 'تغيير الموعد') + B('cancel', 'إلغاء', 'del')) : '';
  return `<div class="bk"><div class="when"><b>${hm(b.start_at)}</b><span>${fullWhen(b.start_at).split(' · ')[0]}</span></div>
    <div><b>${esc(b.patient_name)}</b> · <a dir="ltr" href="tel:${esc(b.patient_phone)}">${esc(b.patient_phone)}</a>${b.note ? `<div class="hint">${esc(b.note)}</div>` : ''}${b.proposed_start_at ? `<div class="hint">اقترحت: ${fullWhen(b.proposed_start_at)} (بانتظار رد المريض)</div>` : ''}<div class="hint">طُلب ${ago(b.created_at)}</div></div>
    <span class="bstat ${b.status}">${BSTATUS[b.status]}</span>${ops ? `<div class="ops">${ops}<a class="btn sm" href="https://wa.me/964${esc(String(b.patient_phone).slice(1))}" target="_blank" rel="noopener">واتساب المريض</a></div>` : ''}</div>`;
}

/* ---------- الحالات ---------- */
function dropCard(key, label) { return `<div class="drop" id="dz-${key}"><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="صورة ${label}"><span class="tagx">${label}</span><div class="ph">${IC.up}<b>صورة ${label}</b><span>اسحبها هنا أو اضغط للاختيار</span></div></div>`; }
async function cases(d) {
  const files = { before: null, after: null };
  $('#dc').innerHTML = `<div class="dash"><div class="box"><h3 style="margin-bottom:12px">نشر حالة جديدة</h3>
    <div class="banner pending" style="margin-bottom:12px;font-weight:400">قبل النشر: احصل على موافقة المريض، وتأكد أن الصور لا تُظهر وجهه كاملاً أو أي اسم أو رقم. المنشور مسؤوليتك ويخضع لمراجعة الإدارة.</div>
    <form class="f" id="cf"><div class="drops">${dropCard('before', 'قبل')}${dropCard('after', 'بعد')}</div><span class="hint">«بعد» مطلوبة و«قبل» اختيارية. تُضغط الصور تلقائياً قبل الرفع.</span>
    <label>عنوان الحالة<input name="title" required maxlength="80" placeholder="تقويم ثابت لازدحام الأسنان الأمامية"></label>
    <div class="row2"><label>النوع<select name="cat">${S.lists.cats.map(c => `<option>${esc(c)}</option>`).join('')}</select></label><label>مدة العلاج<input name="sessions" maxlength="40" placeholder="3 جلسات / 14 شهراً"></label></div>
    <label>وصف مختصر<textarea name="note" maxlength="400" placeholder="المشكلة، الخطة العلاجية، النتيجة"></textarea></label>
    <label class="consent"><input type="checkbox" required name="ok">أؤكد حصولي على موافقة المريض الصريحة على نشر هذه الصور، وأنها لا تكشف هويته.</label>
    <div class="prog" id="prog"><div class="tr"><i></i></div><span></span></div>
    <button class="btn pri" id="cs">نشر الحالة</button></form></div>
    <div><h3 style="margin-bottom:12px">حالاتي</h3><div class="list" id="mine">${'<div class="sk"></div>'.repeat(3)}</div></div></div>`;
  ['before', 'after'].forEach(k => {
    const z = $('#dz-' + k), inp = z.querySelector('input'), lbl = k === 'before' ? 'قبل' : 'بعد';
    const set = f => { if (f) { try { checkImage(f); } catch (er) { return toast(er.message); } } files[k] = f || null; z.querySelectorAll('img,.rm').forEach(n => n.remove()); z.querySelector('.ph').hidden = !!f;
      if (f) { const im = new Image(); im.src = URL.createObjectURL(f); im.alt = lbl; const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'rm'; rm.setAttribute('aria-label', 'إزالة الصورة'); rm.textContent = '×'; rm.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); inp.value = ''; set(null); }; z.append(im, rm); } };
    inp.onchange = () => set(inp.files[0]);
    ['dragenter', 'dragover'].forEach(t => z.addEventListener(t, e => { e.preventDefault(); z.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(t => z.addEventListener(t, e => { e.preventDefault(); z.classList.remove('over'); }));
    z.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) set(f); });
  });
  const big = S.api.mode === 'live' ? 1600 : 800, q = S.api.mode === 'live' ? .84 : .62;
  const prog = (p, t) => { const P = $('#prog'); if (!P) return; P.classList.toggle('on', p != null); if (p != null) { P.querySelector('i').style.width = p + '%'; P.querySelector('span').textContent = t; } };
  $('#cf').onsubmit = async e => {
    e.preventDefault(); if (!files.after) return toast('أضف صورة «بعد» أولاً'); const fd = new FormData(e.target); if (!fd.get('ok')) return toast('أكّد موافقة المريض'); if (String(fd.get('title')).trim().length < 2) return toast('اكتب عنوان الحالة');
    const b = $('#cs'); b.disabled = true;
    try {
      prog(10, 'جارٍ ضغط الصور…'); const ab = await compress(files.after, big, q), bb = files.before ? await compress(files.before, big, q) : null;
      prog(35, files.before ? 'جارٍ رفع صورة «قبل»…' : 'جارٍ رفع الصورة…'); const before_url = bb ? await S.api.upload(bb, 'before') : null;
      prog(65, 'جارٍ رفع صورة «بعد»…'); const after_url = await S.api.upload(ab, 'after');
      prog(90, 'جارٍ حفظ الحالة…'); await S.api.addCase({ title: String(fd.get('title')).trim(), cat: fd.get('cat'), sessions: String(fd.get('sessions')).trim(), note: String(fd.get('note')).trim(), before_url, after_url });
      prog(100, 'تم النشر ✓'); e.target.reset(); ['before', 'after'].forEach(k => { files[k] = null; const z = $('#dz-' + k); z.querySelectorAll('img,.rm').forEach(n => n.remove()); z.querySelector('.ph').hidden = false; });
      S.at = 0; toast('نُشرت الحالة'); mine(); setTimeout(() => prog(null), 1500);
    } catch (er) { prog(null); toast(errMsg(er)); } finally { b.disabled = false; }
  };
  const mine = async () => {
    const cs = await S.api.casesOf(S.me.id, false); const m = $('#mine'); if (!m) return;
    m.innerHTML = cs.length ? cs.map(c => `<div class="it"><img class="th" src="${safeImg(c.after_url)}" alt="" loading="lazy"><div class="mid"><b>${esc(c.title)}</b><span>${esc(c.cat)} · ${ago(c.created_at)}${c.hidden ? ` · <b style="display:inline;color:var(--danger)">أخفتها الإدارة${c.hidden_reason ? ': ' + esc(c.hidden_reason) : ''}</b>` : ' · منشورة'}</span></div><div class="ops"><button class="btn sm" data-e="${esc(c.id)}">تعديل</button><button class="btn sm del" data-x="${esc(c.id)}">حذف</button></div></div>`).join('') : emptyBox('لم تنشر حالات بعد.');
    m.querySelectorAll('[data-x]').forEach(b => b.onclick = () => confirm2(b, async () => { await S.api.deleteCase(cs.find(c => c.id === b.dataset.x)); S.at = 0; toast('حُذفت الحالة'); mine(); }));
    m.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { const c = cs.find(x => x.id === b.dataset.e);
      openModal(`<div class="tx"><h3>تعديل الحالة</h3><form class="f" id="ef" style="margin-top:12px"><label>العنوان<input name="title" required maxlength="80" value="${esc(c.title)}"></label><div class="row2"><label>النوع<select name="cat">${S.lists.cats.map(x => `<option ${x === c.cat ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label><label>مدة العلاج<input name="sessions" maxlength="40" value="${esc(c.sessions)}"></label></div><label>الوصف<textarea name="note" maxlength="400">${esc(c.note)}</textarea></label><span class="hint">لتغيير الصور احذف الحالة وانشرها من جديد.</span><button class="btn pri">حفظ</button></form></div>`);
      $('#ef').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); try { await S.api.updateCase(c.id, { title: String(f.get('title')).trim(), cat: f.get('cat'), sessions: String(f.get('sessions')).trim(), note: String(f.get('note')).trim() }); closeModal(); toast('حُفظت التعديلات'); mine(); } catch (er) { toast(errMsg(er)); } };
    });
  };
  mine();
}

/* ---------- ملفي ---------- */
function profile(d, has) {
  let photoFile = null, loc = hasLoc(d) ? [+d.lat, +d.lng] : null;
  $('#dc').innerHTML = `<div class="box" style="max-width:880px"><form class="f" id="pf" novalidate>
    <div class="avup"><div class="ring"><div id="avp">${safeImg(d.photo_url) ? `<img src="${safeImg(d.photo_url)}" alt="">` : initial(d.name ? d : { name: 'د' })}</div></div>
      <div style="display:grid;gap:6px"><b style="font-family:'Readex Pro'">الصورة الشخصية أو شعار العيادة</b><span class="hint">صورة واضحة لوجهك تزيد ثقة المرضى. JPG أو PNG أو WEBP، تُضغط تلقائياً.</span>
      <div class="acts" style="margin:0"><span class="btn sm filebtn">${IC.up}اختيار صورة<input type="file" accept="image/jpeg,image/png,image/webp" id="photo" aria-label="اختيار الصورة الشخصية"></span><button type="button" class="btn sm" id="avx" hidden>تراجع</button></div></div></div>
    <div class="row2"><label>اللقب المهني<select name="title">${['د.', 'أ.د.', 'أ.م.د.', 'م.د.'].map(t => `<option ${t === (d.title || 'د.') ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>الاسم كما يظهر للمرضى<input name="name" required maxlength="60" value="${esc(d.name)}"></label></div>
    <div class="row2"><label>التخصص<select name="spec">${S.lists.specs.map(s => `<option ${s === d.spec ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label><label>المنطقة<select name="area">${S.lists.areas.map(s => `<option ${s === d.area ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label></div>
    <label>الرابط المخصص لصفحتك<div style="display:flex;gap:6px;align-items:center" dir="ltr"><span class="hint" style="white-space:nowrap">…/#/d/</span><input name="slug" maxlength="40" pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" placeholder="dr-ali-hassan" value="${esc(d.slug)}" style="flex:1"></div><span class="hint">حروف إنجليزية صغيرة وأرقام وشرطة. الرابط القديم بالمعرّف يبقى يعمل دائماً.</span></label>
    <div class="row2"><label>اسم العيادة<input name="clinic" maxlength="60" value="${esc(d.clinic)}"></label><label>سنوات الخبرة<input name="years" type="number" min="0" max="60" inputmode="numeric" value="${esc(d.years)}"></label></div>
    <div class="row2"><label>رقم الهاتف<input name="phone" type="tel" dir="ltr" maxlength="20" value="${esc(d.phone)}" placeholder="07xx xxx xxxx"></label><label>رقم واتساب<input name="whatsapp" type="tel" dir="ltr" maxlength="20" value="${esc(d.whatsapp)}"></label></div>
    <fieldset class="fs"><legend>موقع العيادة على الخارطة</legend>
      <span class="hint">اضغط على الخارطة لتحديد عيادتك، أو استخدم موقعك الحالي إذا كنت داخلها، ويمكنك سحب الدبوس.</span>
      <div class="minimap"><div id="pmap" dir="ltr"></div></div>
      <div class="acts" style="margin:0;align-items:center"><button type="button" class="btn sm pri" id="pgps">${IC.gps}موقعي الحالي</button><button type="button" class="btn sm" id="pclr">مسح الموقع</button><span class="hint" id="pcoord" dir="ltr"></span></div>
      <label>العنوان التفصيلي<input name="address" maxlength="120" value="${esc(d.address)}" placeholder="الحي، الشارع، أقرب نقطة دالة"></label>
      <label>رابط خرائط Google (اختياري)<input name="map_url" type="url" dir="ltr" placeholder="https://maps.app.goo.gl/…" value="${esc(d.map_url)}"></label></fieldset>
    <fieldset class="fs"><legend>الدوام (بتوقيت بغداد)</legend><div class="dchk">${DAYS.map((n, i) => `<label><input type="checkbox" name="day" value="${i}" ${(d.days || []).includes(i) ? 'checked' : ''}>${n}</label>`).join('')}</div>
    <div class="row2"><label>من الساعة<input name="open_from" type="time" value="${esc(d.open_from || '16:00')}"></label><label>إلى الساعة<input name="open_to" type="time" value="${esc(d.open_to || '21:00')}"></label></div></fieldset>
    <label>المؤهلات العلمية<input name="edu" maxlength="160" value="${esc(d.edu)}"></label>
    <label>الخدمات (افصل بينها بفاصلة)<input name="services" maxlength="300" value="${esc((d.services || []).join('، '))}"></label>
    <label>نبذة عنك<textarea name="bio" maxlength="600">${esc(d.bio)}</textarea></label>
    <p class="hint" id="perr" role="alert" style="color:var(--danger);margin:0"></p>
    <button class="btn pri" id="ps">${has ? 'حفظ التعديلات' : 'إرسال للإدارة'}</button></form></div>`;
  const showCoord = () => { $('#pcoord').textContent = loc ? `${loc[0].toFixed(5)}, ${loc[1].toFixed(5)}` : 'لم يُحدَّد الموقع بعد'; }; showCoord();
  $('#photo').onchange = e => { const f = e.target.files[0]; if (!f) return; try { checkImage(f); } catch (er) { return toast(er.message); } photoFile = f; $('#avp').innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`; $('#avx').hidden = false; };
  $('#avx').onclick = () => { photoFile = null; $('#photo').value = ''; $('#avp').innerHTML = safeImg(d.photo_url) ? `<img src="${safeImg(d.photo_url)}" alt="">` : initial(d.name ? d : { name: 'د' }); $('#avx').hidden = true; };
  let pm = null, mk = null;
  const setLoc = (ll, center) => { loc = ll; showCoord(); if (!pm) return; if (!ll) { mk && mk.remove(); mk = null; return; }
    if (!mk) { mk = L.marker(ll, { draggable: true, icon: docIcon({ ...d, name: $('#pf').name.value || 'د' }) }).addTo(pm); mk.on('dragend', () => { const p = mk.getLatLng(); loc = [p.lat, p.lng]; showCoord(); }); } else mk.setLatLng(ll);
    if (center) pm.setView(ll, 16); };
  loadLeaflet().then(() => { if (!$('#pmap')) return; pm = baseMap($('#pmap'), loc || CENTER, loc ? 15 : 12); if (loc) setLoc(loc); pm.on('click', e => setLoc([e.latlng.lat, e.latlng.lng])); }).catch(() => { $('#pmap').innerHTML = emptyBox('تعذّر تحميل الخارطة. يمكنك استخدام زر الموقع.'); });
  $('#pgps').onclick = async e => { const b = e.currentTarget; b.disabled = true; try { setLoc(await getGPS(), true); toast('تم تحديد موقعك'); } catch (er) { toast(er.message); } finally { b.disabled = false; } };
  $('#pclr').onclick = () => setLoc(null);
  $('#pf').onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target), b = $('#ps'), err = $('#perr'); err.textContent = '';
    const map = String(fd.get('map_url') || '').trim(), slug = String(fd.get('slug') || '').trim().toLowerCase(), name = String(fd.get('name')).trim().replace(/^(د|أ\.?د|م\.?د)\s*\.\s*/, '');
    if (name.length < 2) return err.textContent = 'اكتب اسمك';
    if (map && !/^https:\/\//.test(map)) return err.textContent = 'رابط الخريطة يجب أن يبدأ بـ https://';
    if (slug && !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return err.textContent = 'الرابط المخصص: حروف إنجليزية صغيرة وأرقام وشرطة فقط (3–40)';
    const row = { title: fd.get('title'), name, spec: fd.get('spec'), area: fd.get('area'), slug: slug || null, clinic: String(fd.get('clinic')).trim(), years: fd.get('years') ? +fd.get('years') : null, address: String(fd.get('address')).trim(), map_url: map, phone: String(fd.get('phone')).trim(), whatsapp: String(fd.get('whatsapp')).trim(), days: fd.getAll('day').map(Number), open_from: fd.get('open_from'), open_to: fd.get('open_to'), edu: String(fd.get('edu')).trim(), bio: String(fd.get('bio')).trim(), services: String(fd.get('services')).split(/[،,]/).map(s => s.trim()).filter(Boolean).slice(0, 15), lat: loc ? +loc[0].toFixed(6) : null, lng: loc ? +loc[1].toFixed(6) : null };
    b.disabled = true;
    try { if (photoFile) { b.textContent = 'جارٍ رفع الصورة…'; row.photo_url = await S.api.upload(await compress(photoFile, 480, .86), 'photo'); }
      b.textContent = 'جارٍ الحفظ…'; await S.api.saveDoctor(row); S.at = 0; toast(has ? 'حُفظت التعديلات' : 'أُرسل طلبك للإدارة'); S.tab.dash = has ? 'profile' : 'verify'; const h = '#/dash/' + S.tab.dash; if (!has) { location.hash = h; location.reload(); } else if (location.hash !== h) location.hash = h; else dispatchEvent(new HashChangeEvent('hashchange')); }
    catch (er) { err.textContent = errMsg(er); b.disabled = false; b.textContent = 'حفظ'; }
  };
}

/* ---------- التوثيق ---------- */
async function verify(d) {
  const c = $('#dc'); c.innerHTML = skelTiles();
  const list = await S.api.myVerifications().catch(() => []); const open = list.find(v => ['pending', 'needs_info'].includes(v.status));
  const SL = { pending: 'قيد المراجعة', approved: 'مقبول ✓', rejected: 'مرفوض', needs_info: 'مطلوب مستندات إضافية' };
  const canSubmit = !d.verified && (!open || open.status === 'needs_info');
  c.innerHTML = `<div class="dash"><div class="box"><h3>${d.verified ? '✓ حسابك موثّق' : 'طلب التوثيق المهني'}</h3>
    <p class="hint" style="margin:8px 0 14px">التوثيق مجاني ولا يرتبط بأي اشتراك. أرفق هوية نقابة أطباء الأسنان أو إجازة ممارسة المهنة. المستندات تُحفظ في مخزن خاص لا تراه إلا الإدارة، وتُراجع يدوياً.</p>
    ${open?.status === 'needs_info' ? `<div class="banner pending">طلب الإدارة: ${esc(open.review_note || 'مستندات إضافية')}</div>` : ''}
    ${canSubmit ? `<form class="f" id="vf"><label>المستندات (صور أو PDF، حتى 8 ميغابايت لكل ملف)<input type="file" id="vdocs" multiple accept="image/jpeg,image/png,image/webp,application/pdf"></label><div class="hint" id="vlist"></div>
      <label>ملاحظة للإدارة (اختياري)<textarea name="n" maxlength="500" placeholder="مثلاً: رقم الهوية النقابية، الجامعة، سنة التخرج"></textarea></label>
      <div class="prog" id="vprog"><div class="tr"><i></i></div><span></span></div><button class="btn pri" id="vs">${open ? 'إرسال المستندات الإضافية' : 'تقديم طلب التوثيق'}</button></form>` : d.verified ? '<p>شارة التوثيق ظاهرة في صفحتك.</p>' : '<p>طلبك قيد المراجعة، سيصلك إشعار بالنتيجة.</p>'}</div>
    <div><h3 style="margin-bottom:12px">سجل الطلبات</h3><div class="list">${list.length ? list.map(v => `<div class="it"><div class="mid"><b>${SL[v.status]}</b><span>${dayLabel(v.created_at)} · ${v.documents.length} مستند${v.review_note ? ' · ملاحظة الإدارة: ' + esc(v.review_note) : ''}${v.reviewed_at ? ' · رُوجع ' + ago(v.reviewed_at) : ''}</span></div></div>`).join('') : emptyBox('لا توجد طلبات سابقة.')}</div></div></div>`;
  if (!canSubmit) return;
  let files = [];
  $('#vdocs').onchange = e => { files = [...e.target.files]; try { files.forEach(checkDoc); } catch (er) { files = []; e.target.value = ''; return toast(er.message); } $('#vlist').textContent = files.map(f => f.name).join('، '); };
  $('#vf').onsubmit = async e => {
    e.preventDefault(); if (!files.length) return toast('أرفق مستنداً واحداً على الأقل'); const b = $('#vs'), P = $('#vprog'); b.disabled = true; P.classList.add('on');
    try { const paths = []; for (const [i, f] of files.entries()) { P.querySelector('i').style.width = ((i + .5) / files.length * 90) + '%'; P.querySelector('span').textContent = `جارٍ رفع ${i + 1} من ${files.length}…`; paths.push(await S.api.uploadDoc(f, f.type === 'application/pdf' ? null : await compress(f, 2000, .88))); }
      await S.api.submitVerification(paths, new FormData(e.target).get('n'), open?.status === 'needs_info' ? open : null); toast('أُرسل طلب التوثيق للإدارة'); verify(d); }
    catch (er) { toast(errMsg(er)); b.disabled = false; P.classList.remove('on'); }
  };
}

/* ---------- الإحصائيات ---------- */
async function stats(d) {
  const c = $('#dc'); let days = 30;
  const draw = async () => {
    c.innerHTML = `<div class="sec-head"><h2 style="font-size:22px">إحصائيات التفاعل</h2><div class="seg2" id="per">${[[7, 'أسبوع'], [30, 'شهر'], [90, '3 أشهر']].map(([n, t]) => `<button data-n="${n}" class="${n === days ? 'on' : ''}">${t}</button>`).join('')}</div></div>${skelTiles()}`;
    $$('#per button').forEach(b => b.onclick = () => { days = +b.dataset.n; draw(); });
    let rows; try { rows = await S.api.stats(days * 2); } catch (er) { c.insertAdjacentHTML('beforeend', emptyBox(errMsg(er))); return; }
    const prev = rows.slice(0, rows.length - days), cur = rows.slice(-days), s = (L, k) => L.reduce((a, r) => a + (r[k] || 0), 0);
    const tile = (k, t) => { const a = s(cur, k), b = s(prev, k), pct = b ? Math.round((a - b) / b * 100) : null; return `<div class="tile"><b>${a}</b><span>${t}</span><div class="cmp ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}">${pct === null ? (a ? 'جديد' : '—') : (pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '') + Math.abs(pct) + '% عن الفترة السابقة'}</div></div>`; };
    const contacts = s(cur, 'wa') + s(cur, 'calls') + s(cur, 'books'), conv = s(cur, 'views') ? Math.round(contacts / s(cur, 'views') * 100) : 0;
    const chart = days <= 30 ? cur.map(r => [new Date(r.day + 'T12:00:00Z').toLocaleDateString('ar-IQ', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }), (r.wa || 0) + (r.calls || 0) + (r.books || 0)]) : weeks(cur);
    c.querySelector('.tiles').outerHTML = `<div class="tiles">${tile('views', 'زيارة للملف')}${tile('wa', 'نقرة واتساب')}${tile('calls', 'اتصال')}${tile('books', 'طلب حجز')}${tile('shares', 'مشاركة')}<div class="tile"><b>${conv}%</b><span>تحويل الزيارات إلى تواصل</span></div></div>`;
    c.insertAdjacentHTML('beforeend', `<div class="info"><div class="box"><h3>التواصل ${days <= 30 ? 'اليومي' : 'الأسبوعي'}</h3><p class="hint" style="margin:4px 0 12px">واتساب + اتصال + حجز</p>${bars(chart)}</div>
      <div class="box"><h3>مصادر التفاعل</h3>${bars([['زيارات', s(cur, 'views')], ['واتساب', s(cur, 'wa')], ['اتصال', s(cur, 'calls')], ['حجز', s(cur, 'books')], ['مشاركة', s(cur, 'shares')]])}<p class="hint" style="margin-top:12px">أرقام فعلية مسجّلة، تُحسب الزيارة المتكررة من نفس الجهاز مرة كل 30 دقيقة، ولا تُحسب زياراتك لصفحتك.</p></div></div>`);
  };
  draw();
}
const weeks = rows => { const out = []; for (let i = 0; i < rows.length; i += 7) { const w = rows.slice(i, i + 7); out.push([`أسبوع ${out.length + 1}`, w.reduce((a, r) => a + (r.wa || 0) + (r.calls || 0) + (r.books || 0), 0)]); } return out; };

/* ---------- التقييمات ---------- */
async function reviews(d) {
  const c = $('#dc'); c.innerHTML = skelTiles(); const l = await S.api.myReviews().catch(() => []);
  c.innerHTML = `<div class="box"><h3>تقييمات المرضى</h3><p class="hint" style="margin:6px 0 12px">التقييمات تأتي فقط من مرضى أتممت موعدهم عبر المنصة، ولا يمكن تعديلها أو حذفها من لوحتك. إذا رأيت تقييماً مخالفاً أبلغ عنه من صفحتك.</p>
    ${l.length ? l.map(r => `<div class="rev"><div class="who"><span><b style="color:var(--ink)">${esc(r.author_name)}</b> ${stars(r.rating)}${r.status === 'hidden' ? ' <span class="pill rejected">مخفي</span>' : ''}</span><span>${dayLabel(r.created_at)}</span></div>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}</div>`).join('') : emptyBox('لا توجد تقييمات بعد. فعّل الحجز وأكمل المواعيد ليستطيع مرضاك تقييمك.')}</div>`;
}

/* ---------- QR ---------- */
async function qr(d) {
  const url = pageUrl(d);
  $('#dc').innerHTML = `<div class="qrwrap"><div class="qrcard" id="qrcard"><div class="top"><small>دكتور أور · دليل أطباء الأسنان</small><h3>${esc(d.title || 'د.')} ${esc(d.name)}</h3><p>${esc(d.spec)}${d.clinic ? ' · ' + esc(d.clinic) : ''}</p><p style="font-size:14px">${esc(d.area)}</p><div class="zz">${ZIG}</div></div>
    <div class="code" id="qrbox"><span class="hint">جارٍ التوليد…</span></div><div class="bt"><b>امسح الكود</b>لمشاهدة حالاتي وأوقات الدوام والحجز</div></div>
    <div class="box"><h3>بطاقة العيادة</h3><p style="color:var(--muted);margin-bottom:14px">اطبعها لمكتب الاستقبال أو انشرها في حساباتك. الكود يفتح صفحتك مباشرة${d.slug ? ' برابطك المخصص' : ''}.</p>
    ${d.status !== 'approved' ? '<div class="banner pending" style="margin-bottom:14px">صفحتك قيد المراجعة، الكود سيعمل للناس بعد موافقة الإدارة.</div>' : ''}
    <div class="acts" style="margin:0"><button class="btn pri" id="qdl">${IC.up}تحميل البطاقة (PNG)</button><button class="btn" id="qpr">طباعة</button><button class="btn" id="qcp">نسخ الرابط</button><button class="btn" id="qsh">${IB.share}مشاركة</button></div>
    <p class="hint" style="margin-top:12px" dir="ltr">${esc(url)}</p></div></div>`;
  $('#qcp').onclick = () => copy(url); $('#qpr').onclick = () => isNative ? $('#qdl').click() : window.print(); $('#qsh').onclick = () => share(d.name, url);
  let qrCanvas = null;
  try { if (!window.QRCode) await loadScript(LIB.qrcode); const tmp = document.createElement('div'); new QRCode(tmp, { text: url, width: 600, height: 600, colorDark: '#0B2C3D', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    qrCanvas = tmp.querySelector('canvas'); const img = new Image(); img.alt = 'رمز QR لصفحة الطبيب'; img.src = qrCanvas.toDataURL('image/png'); $('#qrbox').innerHTML = ''; $('#qrbox').append(img); }
  catch { $('#qrbox').innerHTML = '<span class="hint">تعذّر توليد الكود، تأكد من الإنترنت.</span>'; }
  $('#qdl').onclick = async () => { if (!qrCanvas) return toast('الكود غير جاهز'); try { if (isNative) return await saveImage(await renderCard(d, qrCanvas), `basma-qr-${d.slug || 'card'}.png`, 'بطاقة العيادة'); const a = document.createElement('a'); a.download = `basma-qr-${d.slug || 'card'}.png`; a.href = await renderCard(d, qrCanvas); document.body.append(a); a.click(); a.remove(); } catch { toast('تعذّر التحميل، استخدم الطباعة'); } };
}
async function renderCard(d, qr) {
  try { await document.fonts.ready; } catch { }
  const W = 1080, H = 1440, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#FAF8F4'; x.fillRect(0, 0, W, H); x.fillStyle = '#0B2C3D'; x.fillRect(0, 0, W, 600);
  x.strokeStyle = 'rgba(200,155,60,.45)'; x.lineWidth = 3; [[200, 564, 680, 30], [320, 534, 440, 30], [420, 508, 240, 26]].forEach(r => x.strokeRect(...r));
  x.fillStyle = '#C89B3C'; x.fillRect(0, 594, W, 8);
  const F = '"Readex Pro","IBM Plex Sans Arabic",sans-serif'; x.direction = 'rtl'; x.textAlign = 'center';
  let ay = 70; const photo = safeImg(d.photo_url);
  if (photo) { try { const im = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = photo.replace(/&amp;/g, '&'); });
    x.save(); x.beginPath(); x.arc(W / 2, ay + 80, 80, 0, Math.PI * 2); x.closePath(); x.clip(); const s = Math.max(160 / im.width, 160 / im.height); x.drawImage(im, W / 2 - im.width * s / 2, ay + 80 - im.height * s / 2, im.width * s, im.height * s); x.restore();
    x.strokeStyle = '#C89B3C'; x.lineWidth = 6; x.beginPath(); x.arc(W / 2, ay + 80, 82, 0, Math.PI * 2); x.stroke(); ay += 190; } catch { } }
  x.fillStyle = '#E6C77E'; x.font = `500 30px ${F}`; x.fillText('دكتور أور · دليل أطباء الأسنان', W / 2, ay + 30);
  x.fillStyle = '#F4EEE2'; x.font = `700 64px ${F}`; x.fillText(`${d.title || 'د.'} ${d.name || ''}`, W / 2, ay + 120);
  x.font = `500 36px ${F}`; x.globalAlpha = .88; x.fillText([d.spec, d.clinic].filter(Boolean).join(' · '), W / 2, ay + 180); x.fillText(String(d.area || ''), W / 2, ay + 232); x.globalAlpha = 1;
  x.fillStyle = '#fff'; x.strokeStyle = '#C89B3C'; x.lineWidth = 6; const qx = W / 2 - 260, qy = 660; x.beginPath(); x.roundRect ? x.roundRect(qx, qy, 520, 520, 36) : x.rect(qx, qy, 520, 520); x.fill(); x.stroke();
  x.drawImage(qr, qx + 40, qy + 40, 440, 440);
  x.fillStyle = '#0F1E26'; x.font = `700 44px ${F}`; x.fillText('امسح الكود', W / 2, 1260);
  x.fillStyle = '#5A6B73'; x.font = `400 32px ${F}`; x.fillText('لمشاهدة حالاتي وأوقات الدوام والحجز', W / 2, 1316);
  x.fillStyle = '#C89B3C'; x.fillRect(0, H - 24, W, 24);
  try { return c.toDataURL('image/png'); } catch { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; return c2.toDataURL(); }
}

/* ---------- الحساب ---------- */
async function account(d, has, refreshUser) {
  const p = await S.api.myProfile().catch(() => ({}));
  $('#dc').innerHTML = `<div class="dash"><div class="box"><h3>بيانات الحساب</h3><p style="margin:8px 0" dir="ltr">${esc(S.me.email)}</p><p class="hint">الدور: ${esc({ patient: 'مريض', doctor: 'طبيب', moderator: 'مشرف', admin: 'مدير', super_admin: 'مدير أعلى' }[S.role] || S.role)}</p>
    <form class="f" id="accf" style="margin-top:12px"><label>الاسم الكامل (خاص، لا يظهر للعامة)<input name="n" maxlength="80" value="${esc(p?.full_name)}"></label><button class="btn sm" style="justify-self:start">حفظ</button></form></div>
    <div class="box"><h3>تغيير كلمة المرور</h3><form class="f" id="pwf" style="margin-top:12px"><label>كلمة المرور الجديدة<input name="p" type="password" minlength="8" required dir="ltr" autocomplete="new-password"></label><label>تأكيدها<input name="p2" type="password" minlength="8" required dir="ltr" autocomplete="new-password"></label><button class="btn pri" style="justify-self:start">تغيير</button></form>
    <div class="acts"><a class="btn sm" href="#/my">حجوزاتي كمريض</a><button class="btn sm del" id="out2">تسجيل الخروج</button></div></div></div>`;
  $('#accf').onsubmit = async e => { e.preventDefault(); try { await S.api.saveProfile({ full_name: new FormData(e.target).get('n').trim() || null }); toast('حُفظ'); } catch (er) { toast(errMsg(er)); } };
  $('#pwf').onsubmit = async e => { e.preventDefault(); const f = e.target; if (f.p.value !== f.p2.value) return toast('كلمتا المرور غير متطابقتين'); try { await S.api.updatePassword(f.p.value); f.reset(); toast('تم تغيير كلمة المرور'); } catch (er) { toast(errMsg(er)); } };
  $('#out2').onclick = async () => { await S.api.signOut(); await refreshUser(); location.hash = '#/'; };
}
