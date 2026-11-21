// الحجز: نافذة اختيار اليوم والموعد، صفحة متابعة الحجز، حجوزاتي
import { $, $$, esc, todayBG, isoDay, DAYS, MONTHS, hm, fullWhen, validPhone, toast, errMsg, openModal, closeModal, setApp, setMeta, wrapMsg, waLink, telLink, docHref, copy, baseUrl, hasLoc } from '../core/util.js';
import { S, BSTATUS, myTokens, saveToken } from '../core/state.js';
import { IB, IX, emptyBox } from '../core/art.js';
import { avatar } from '../components/doctor.js';

export function openBooking(d) {
  const t0 = todayBG(), days = [];
  for (let i = 0; i < 21 && days.length < 14; i++) { const dt = new Date(+t0 + i * 864e5); if ((d.days || []).includes(dt.getUTCDay())) days.push(dt); }
  let day = null, slot = null;
  openModal(`<div class="tx"><div class="stepper"><i class="on"></i><i id="st2"></i><i id="st3"></i></div>
    <h2 style="margin-bottom:4px">حجز موعد</h2><p class="hint" style="margin:0 0 14px">${esc(d.title || 'د.')} ${esc(d.name)} · ${esc(d.clinic || d.area)} · مدة الموعد ${d.slot_minutes || 20} دقيقة</p>
    <h3 style="font-size:15px;margin-bottom:8px">اختر اليوم</h3>
    <div class="days14" id="days">${days.length ? days.map(dt => `<button class="dchip" data-d="${isoDay(dt)}"><span>${DAYS[dt.getUTCDay()]}</span><b>${dt.getUTCDate()}</b><span>${MONTHS[dt.getUTCMonth()]}</span></button>`).join('') : '<p class="hint">لا توجد أيام دوام محددة.</p>'}</div>
    <div id="slotBox" style="margin-top:16px"></div><div id="formBox"></div></div>`);
  $$('#days .dchip').forEach(b => b.onclick = async () => {
    $$('#days .dchip').forEach(x => x.classList.toggle('on', x === b)); day = b.dataset.d; slot = null; $('#formBox').innerHTML = ''; $('#st2').className = 'on'; $('#st3').className = '';
    $('#slotBox').innerHTML = `<h3 style="font-size:15px;margin-bottom:8px">الأوقات المتاحة</h3><div class="slots">${'<div class="sk" style="height:44px"></div>'.repeat(8)}</div>`;
    try {
      const sl = await S.api.slots(d.id, day); if (day !== b.dataset.d) return;
      $('#slotBox').innerHTML = `<h3 style="font-size:15px;margin-bottom:8px">الأوقات المتاحة (بتوقيت بغداد)</h3>` + (sl.length ? `<div class="slots">${sl.map(s => `<button class="slot" data-s="${esc(s.slot_start)}">${hm(s.slot_start)}</button>`).join('')}</div>` : emptyBox('لا توجد مواعيد متاحة في هذا اليوم، جرّب يوماً آخر.'));
      $$('#slotBox .slot').forEach(x => x.onclick = () => { $$('#slotBox .slot').forEach(y => y.classList.toggle('on', y === x)); slot = x.dataset.s; $('#st3').className = 'on'; form(); });
    } catch (er) { $('#slotBox').innerHTML = emptyBox(errMsg(er)); }
  });
  function form() {
    const last = (() => { try { return JSON.parse(localStorage.getItem('basma_patient') || '{}'); } catch { return {}; } })();
    $('#formBox').innerHTML = `<form class="f" id="bf" style="margin-top:16px" novalidate><div class="banner approved" style="margin:0">${fullWhen(slot)}</div>
      <label>الاسم<input name="n" required minlength="2" maxlength="60" autocomplete="name" value="${esc(last.n || '')}"></label>
      <label>رقم الهاتف<input name="p" type="tel" inputmode="tel" dir="ltr" required placeholder="07xx xxx xxxx" autocomplete="tel" value="${esc(last.p || '')}"></label>
      <label>سبب الزيارة (اختياري)<input name="note" maxlength="200" placeholder="مثلاً: ألم في ضرس، تنظيف، استشارة تقويم"></label>
      <label class="consent"><input type="checkbox" required name="ok">أوافق على مشاركة اسمي ورقمي مع العيادة لتأكيد الموعد فقط.</label>
      <p class="hint" id="berr" role="alert" style="color:var(--danger);margin:0"></p>
      <button class="btn pri" id="bsend">إرسال طلب الحجز</button></form>`;
    $('#bf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), err = $('#berr'); err.textContent = '';
      if (String(f.get('n')).trim().length < 2) return err.textContent = 'اكتب اسمك';
      if (!validPhone(f.get('p'))) return err.textContent = 'رقم الهاتف غير صحيح، اكتبه بصيغة 07xxxxxxxxx';
      if (!f.get('ok')) return err.textContent = 'يجب الموافقة على مشاركة بياناتك مع العيادة';
      const b = $('#bsend'); b.disabled = true; b.textContent = 'جارٍ الإرسال…';
      try {
        const r = await S.api.createBooking(d.id, slot, String(f.get('n')).trim(), f.get('p'), String(f.get('note') || '').trim());
        try { localStorage.setItem('basma_patient', JSON.stringify({ n: f.get('n'), p: f.get('p') })); } catch { }
        saveToken(r.token, { doctor: d.name, start_at: r.start_at });
        const link = baseUrl() + '#/b/' + r.token;
        $('#mbox').querySelector('.tx').innerHTML = `<div style="text-align:center;display:grid;gap:12px;justify-items:center;padding:10px 0">
          <div style="width:72px;height:72px;border-radius:50%;background:var(--ok-soft);color:var(--ok);display:grid;place-items:center;font-size:36px">✓</div>
          <h2>وصل طلبك للعيادة</h2><p style="margin:0">${fullWhen(r.start_at)}<br><span class="hint">الحالة: ${BSTATUS.pending}. ستصلك النتيجة في صفحة متابعة الحجز.</span></p>
          <a class="btn pri" href="#/b/${esc(r.token)}">متابعة الحجز</a><button class="btn sm" id="cpl">نسخ رابط المتابعة</button>
          <p class="hint">احفظ الرابط: هو طريقتك لمتابعة الحجز أو إلغائه${S.me ? '' : ' من أي جهاز'}.</p></div>`;
        $('#cpl').onclick = () => copy(link);
      } catch (er) { err.textContent = errMsg(er); b.disabled = false; b.textContent = 'إرسال طلب الحجز'; if (/متاح|سبقك/.test(er.message)) $(`#days .dchip[data-d="${day}"]`)?.click(); }
    };
  }
  $('#days .dchip')?.click();
}

export async function pageTrack(token) {
  setMeta('متابعة الحجز'); setApp(wrapMsg('جارٍ تحميل الحجز…'));
  let b; try { b = await S.api.getBooking(token); } catch (er) { return setApp(wrapMsg(errMsg(er))); }
  if (!b) return setApp(wrapMsg('لم نجد هذا الحجز. تأكد من الرابط.'));
  const d = b.doctor, active = ['pending', 'confirmed'].includes(b.status) && new Date(b.start_at) > new Date();
  setApp(`<section class="band"><div class="wrap" style="max-width:720px"><div class="sec-head"><div><h1 style="font-size:28px">حجزك</h1><p>رقم المتابعة محفوظ في هذا الرابط فقط، لا تشاركه.</p></div><span class="bstat ${b.status}">${BSTATUS[b.status]}</span></div>
    <div class="box" style="display:grid;gap:14px">
      <a class="card" href="${docHref(d)}">${avatar(d)}<div><b>${esc(d.name)}</b><span class="sub">${esc(d.spec)} · ${esc(d.clinic || d.area)}</span></div></a>
      <div class="tiles" style="margin:0"><div class="tile"><span>الموعد</span><b style="font-size:20px">${hm(b.start_at)}</b><span>${fullWhen(b.start_at).split(' · ')[0]}</span></div><div class="tile"><span>باسم</span><b style="font-size:20px">${esc(b.patient_name)}</b></div></div>
      ${b.proposed_start_at && b.status === 'pending' ? `<div class="banner pending" style="margin:0">اقترح الطبيب موعداً بديلاً: <b>${fullWhen(b.proposed_start_at)}</b><div class="acts"><button class="btn pri sm" id="acc">قبول الموعد البديل</button></div></div>` : ''}
      ${b.doctor_note ? `<div class="banner approved" style="margin:0">ملاحظة العيادة: ${esc(b.doctor_note)}</div>` : ''}
      ${b.status === 'pending' && !b.proposed_start_at ? '<p class="hint" style="margin:0">بانتظار تأكيد العيادة. يمكنك التواصل معها عبر واتساب إن استعجلت.</p>' : ''}
      <div class="acts" style="margin:0">${d.whatsapp || d.phone ? `<a class="btn wa" href="${waLink(d, `مرحباً، بخصوص حجزي باسم ${b.patient_name} يوم ${fullWhen(b.start_at)}`)}" target="_blank" rel="noopener">${IX.wa}واتساب العيادة</a>` : ''}${d.phone ? `<a class="btn" href="${telLink(d)}">${IX.call}اتصال</a>` : ''}${hasLoc(d) ? `<a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${+d.lat},${+d.lng}" target="_blank" rel="noopener">${IX.pin}الاتجاهات</a>` : ''}${active ? '<button class="btn del" id="cnl">إلغاء الحجز</button>' : ''}</div>
      <div id="revBox"></div></div></div></section>`);
  saveToken(token, { doctor: d.name, start_at: b.start_at, status: b.status });
  $('#cnl') && ($('#cnl').onclick = async e => { const x = e.currentTarget; if (x.dataset.sure !== '1') { x.dataset.sure = '1'; x.textContent = 'متأكد من الإلغاء؟'; return; } x.disabled = true; try { await S.api.cancelBooking(token); toast('أُلغي الحجز'); pageTrack(token); } catch (er) { toast(errMsg(er)); x.disabled = false; } });
  $('#acc') && ($('#acc').onclick = async e => { e.currentTarget.disabled = true; try { await S.api.acceptProposal(token); toast('تم تأكيد الموعد الجديد'); pageTrack(token); } catch (er) { toast(errMsg(er)); e.currentTarget.disabled = false; } });
  const rb = $('#revBox');
  if (b.status === 'completed' && !b.review) {
    let rating = 0;
    rb.innerHTML = `<form class="f" id="rf" style="border-top:1px solid var(--line);padding-top:14px"><h3>قيّم زيارتك</h3><div id="rst" role="radiogroup" aria-label="التقييم" style="display:flex;gap:4px">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${n} من 5" data-n="${n}" style="background:none;border:0;font-size:34px;color:var(--line);cursor:pointer;min-width:44px">★</button>`).join('')}</div>
      <label>تعليقك (اختياري)<textarea name="c" maxlength="600" placeholder="كيف كانت تجربتك؟ لا تكتب معلومات طبية خاصة."></textarea></label><button class="btn pri" id="rsend">نشر التقييم</button></form>`;
    $$('#rst button').forEach(x => x.onclick = () => { rating = +x.dataset.n; $$('#rst button').forEach(y => { const on = +y.dataset.n <= rating; y.style.color = on ? 'var(--gold)' : 'var(--line)'; y.setAttribute('aria-checked', +y.dataset.n === rating); }); });
    $('#rf').onsubmit = async e => { e.preventDefault(); if (!rating) return toast('اختر عدد النجوم'); const btn = $('#rsend'); btn.disabled = true; try { await S.api.addReview(token, rating, new FormData(e.target).get('c')); toast('شكراً، نُشر تقييمك'); pageTrack(token); } catch (er) { toast(errMsg(er)); btn.disabled = false; } };
  } else if (b.review) rb.innerHTML = `<p style="border-top:1px solid var(--line);padding-top:14px;margin:0">تقييمك: <span class="stars">${'★'.repeat(b.review.rating)}</span> ${b.review.comment ? '— ' + esc(b.review.comment) : ''}</p>`;
}

export async function pageMy() {
  setMeta('حجوزاتي');
  const local = myTokens(); let acc = [];
  if (S.me) { try { acc = await S.api.myPatientBookings(); } catch { } }
  const map = new Map(); local.forEach(x => map.set(x.token, x)); acc.forEach(x => map.set(x.token, { token: x.token, doctor: x.doctors?.name, start_at: x.start_at, status: x.status }));
  const all = [...map.values()].sort((a, b) => String(b.start_at).localeCompare(String(a.start_at)));
  setApp(`<section class="band"><div class="wrap" style="max-width:760px"><div class="sec-head"><div><h1 style="font-size:28px">حجوزاتي</h1><p>${S.me ? 'حجوزات حسابك وهذا الجهاز.' : 'الحجوزات المحفوظة على هذا الجهاز. سجّل الدخول لتتابعها من أي جهاز.'}</p></div>${S.me ? '' : '<a class="btn" href="#/login">تسجيل الدخول</a>'}</div>
    <div class="list">${all.length ? all.map(x => `<a class="bk" href="#/b/${esc(x.token)}" style="text-decoration:none"><div class="when"><b>${hm(x.start_at)}</b><span>${fullWhen(x.start_at).split(' · ')[0]}</span></div><div><b>${esc(x.doctor || 'طبيب')}</b><div class="hint">اضغط للمتابعة</div></div>${x.status ? `<span class="bstat ${esc(x.status)}">${BSTATUS[x.status] || ''}</span>` : ''}</a>`).join('') : emptyBox('لا توجد حجوزات بعد.', '<a class="btn sm pri" href="#/">ابحث عن طبيب</a>')}</div>
    ${S.me && S.role === 'patient' ? '<div class="box" style="margin-top:20px"><h3>أنت طبيب أسنان؟</h3><p class="hint" style="margin:6px 0 12px">أنشئ صفحتك المهنية من نفس الحساب.</p><a class="btn" href="#/dash">إنشاء صفحة طبيب</a></div>' : ''}</div></section>`);
}
