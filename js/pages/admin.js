// لوحة الإدارة — التبويبات حسب الدور، والصلاحيات الفعلية تفرضها قاعدة البيانات
import { $, $$, esc, toast, errMsg, setApp, setMeta, wrapMsg, confirm2, bars, ago, dayLabel, hasLoc, openModal, closeModal, norm, fullWhen } from '../core/util.js';
import { S, STATUS, ROLES, BSTATUS, isAdmin, isSuper, isStaff } from '../core/state.js';
import { IC, emptyBox, safeImg } from '../core/art.js';
import { avatar, nm, openCase, stars } from '../components/doctor.js';

export async function pageAdmin(tabArg) {
  if (!S.me) { location.hash = '#/login'; return; }
  if (!isStaff()) { setMeta('غير مسموح'); return setApp(wrapMsg('هذه الصفحة للإدارة فقط.')); }
  setMeta('لوحة الإدارة');
  const T = [['over', 'نظرة عامة', 'staff'], ['req', 'طلبات الانضمام', 'admin'], ['ver', 'التوثيق', 'admin'], ['docs', 'الأطباء', 'admin'], ['cases', 'الحالات', 'staff'], ['reviews', 'التقييمات', 'staff'], ['reps', 'البلاغات', 'staff'], ['bookings', 'الحجوزات', 'admin'], ['tips', 'التوعية', 'admin'], ['lists', 'القوائم', 'admin'], ['users', 'المستخدمون', 'admin'], ['audit', 'سجل العمليات', 'admin'], ['settings', 'الإعدادات', 'admin']]
    .filter(t => t[2] === 'staff' || isAdmin());
  const tab = T.some(t => t[0] === tabArg) ? tabArg : S.tab.admin && T.some(t => t[0] === S.tab.admin) ? S.tab.admin : 'over';
  setApp(`<section class="band" style="padding-bottom:0"><div class="wrap"><div class="sec-head"><div><h1 style="font-size:28px">لوحة الإدارة</h1><p>دورك: ${ROLES[S.role]}. كل إجراء إداري يُسجَّل في سجل العمليات.</p></div><button class="btn" id="rf">تحديث</button></div></div></section>
    <nav class="tabs scroll" role="tablist">${T.map(([k, t]) => `<button data-t="${k}" role="tab">${t}<span class="n" id="n-${k}" hidden></span></button>`).join('')}</nav>
    <section class="band"><div class="wrap" id="ac">${'<div class="sk"></div>'.repeat(4)}</div></section>`);
  const go = t => { S.tab.admin = t; history.replaceState(null, '', '#/admin/' + t); $$('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === t); b.setAttribute('aria-selected', b.dataset.t === t); }); $('#ac').innerHTML = '<div class="sk"></div>'.repeat(4); (V[t])().catch(er => $('#ac').innerHTML = emptyBox(errMsg(er))); };
  $('#rf').onclick = () => go(S.tab.admin);
  $$('.tabs button').forEach(b => b.onclick = () => go(b.dataset.t));
  S.api.overview().then(o => { const set = (k, v) => { const e = $('#n-' + k); if (e && v) { e.hidden = false; e.textContent = v; } }; set('req', o.doctors_pending); set('ver', o.verification_open); set('reps', o.reports_open); }).catch(() => { });
  go(tab);
}

const V = {
  async over() {
    const o = await S.api.overview(), c = $('#ac');
    const tiles = [['doctors_approved', 'طبيب منشور'], ['doctors_verified', 'طبيب موثّق'], ['doctors_pending', 'طلب انضمام'], ['verification_open', 'طلب توثيق'], ['cases', 'حالة'], ['reviews', 'تقييم'], ['users', 'مستخدم'], ['bookings_30d', 'حجز (30 يوماً)'], ['bookings_pending', 'حجز بانتظار التأكيد'], ['reports_open', 'بلاغ مفتوح'], ['views_30d', 'زيارة ملفات (30 يوماً)'], ['contacts_30d', 'تواصل وحجز (30 يوماً)']];
    c.innerHTML = `<div class="tiles">${tiles.map(([k, t]) => `<div class="tile"><b>${o[k] ?? 0}</b><span>${t}</span></div>`).join('')}</div>
      <div class="info"><div class="box"><h3 style="margin-bottom:12px">الأكثر تواصلاً (30 يوماً)</h3>${o.top_doctors?.length ? bars(o.top_doctors.map(x => [x.name, x.n])) : '<p class="hint">لا توجد بيانات بعد.</p>'}</div>
      <div class="box"><h3 style="margin-bottom:12px">الأطباء حسب المنطقة</h3>${o.by_area?.length ? bars(o.by_area.map(x => [x.area, x.n])) : '<p class="hint">لا يوجد أطباء بعد.</p>'}</div></div>
      <p class="hint" style="margin-top:14px">كل الأرقام فعلية من قاعدة البيانات، وتُحسب زيارة الجهاز الواحد مرة كل 30 دقيقة.</p>`;
  },
  async req() { const docs = (await S.api.allDoctors()).filter(d => d.status === 'pending'); $('#ac').innerHTML = docs.length ? `<div class="list">${docs.map(d => docRow(d, true)).join('')}</div>` : emptyBox('لا توجد طلبات انضمام جديدة.'); bindDocs($('#ac'), docs); },
  async docs() {
    const docs = await S.api.allDoctors(); const c = $('#ac');
    c.innerHTML = `<div class="acts" style="margin:0 0 12px"><input class="sel" id="ds" type="search" placeholder="ابحث بالاسم أو المنطقة" style="flex:1;max-width:360px"><select class="sel" id="dst"><option value="">كل الحالات</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><div class="list" id="dl"></div>`;
    const draw = () => { const q = norm($('#ds').value), st = $('#dst').value; const L = docs.filter(d => (!q || norm(d.name + ' ' + d.area + ' ' + (d.clinic || '')).includes(q)) && (!st || d.status === st)); $('#dl').innerHTML = L.map(d => docRow(d)).join('') || emptyBox('لا يوجد.'); bindDocs($('#dl'), docs); };
    $('#ds').oninput = draw; $('#dst').onchange = draw; draw();
  },
  async ver() {
    const L = await S.api.verificationQueue(); const c = $('#ac'); const SL = { pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض', needs_info: 'بانتظار مستندات' };
    c.innerHTML = `<p class="hint" style="margin:0 0 12px">${IC.lock} المستندات في مخزن خاص وتُفتح بروابط مؤقتة (10 دقائق). لا تمنح الشارة قبل التحقق من الهوية النقابية.</p><div class="list">${L.length ? L.map(v => `<div class="it" style="align-items:flex-start"><div class="mid"><b>${esc(v.doctors?.name || '—')}</b> <span class="pill ${v.status === 'approved' ? 'approved' : v.status === 'rejected' ? 'rejected' : 'pending'}">${SL[v.status]}</span>
      <span style="display:block">${esc(v.doctors?.spec || '')} · ${esc(v.doctors?.area || '')} · قُدّم ${ago(v.created_at)}${v.reviewed_at ? ' · رُوجع ' + ago(v.reviewed_at) : ''}</span>${v.doctor_note ? `<span style="display:block">ملاحظة الطبيب: ${esc(v.doctor_note)}</span>` : ''}${v.review_note ? `<span style="display:block">ملاحظة الإدارة: ${esc(v.review_note)}</span>` : ''}
      <div class="acts" style="margin-top:8px">${v.documents.map((p, i) => `<button class="btn sm" data-doc="${esc(p)}">${IC.lock}مستند ${i + 1}</button>`).join('')}</div></div>
      ${['pending', 'needs_info'].includes(v.status) ? `<div class="ops"><button class="btn sm pri" data-v="approved" data-id="${esc(v.id)}">توثيق</button><button class="btn sm" data-v="needs_info" data-id="${esc(v.id)}">طلب مستندات</button><button class="btn sm del" data-v="rejected" data-id="${esc(v.id)}">رفض</button></div>` : ''}</div>`).join('') : emptyBox('لا توجد طلبات توثيق.')}</div>`;
    $$('#ac [data-doc]').forEach(b => b.onclick = async () => { b.disabled = true; try { const u = await S.api.docUrl(b.dataset.doc); const pdf = /\.pdf$/i.test(b.dataset.doc); openModal(`<div class="tx"><h3>مستند توثيق — سرّي</h3>${pdf ? `<p style="margin:12px 0"><a class="btn pri" href="${safeImg(u)}" target="_blank" rel="noopener">فتح ملف PDF</a></p>` : `<img src="${safeImg(u)}" alt="مستند" style="width:100%;max-height:70vh;object-fit:contain;border-radius:12px;margin-top:12px;background:var(--soft)">`}<p class="hint" style="margin-top:10px">الرابط صالح 10 دقائق ولا يظهر لغير الإدارة.</p></div>`); } catch (er) { toast(errMsg(er)); } finally { b.disabled = false; } });
    $$('#ac [data-v]').forEach(b => b.onclick = () => { const st = b.dataset.v;
      openModal(`<div class="tx"><h3>${st === 'approved' ? 'توثيق الطبيب' : st === 'rejected' ? 'رفض الطلب' : 'طلب مستندات إضافية'}</h3><form class="f" id="vd" style="margin-top:12px"><label>${st === 'approved' ? 'ملاحظة (اختياري)' : 'السبب (يظهر للطبيب)'}<textarea name="n" maxlength="500" ${st === 'approved' ? '' : 'required'}></textarea></label><button class="btn pri">تأكيد</button></form></div>`);
      $('#vd').onsubmit = async e => { e.preventDefault(); try { await S.api.decideVerification(b.dataset.id, st, new FormData(e.target).get('n')); closeModal(); toast('تم، وأُشعر الطبيب'); V.ver(); } catch (er) { toast(errMsg(er)); } }; });
  },
  async cases() {
    const [cs, docs] = await Promise.all([S.api.allCases(), S.docs.length ? S.docs : S.api.listDoctors()]); const DN = id => docs.find(d => d.id === id)?.name || '—';
    $('#ac').innerHTML = cs.length ? `<div class="list">${cs.map(x => `<div class="it"><img class="th" src="${safeImg(x.after_url)}" alt="" loading="lazy"><div class="mid"><b>${esc(x.title)}</b><span>${esc(DN(x.doctor_id))} · ${esc(x.cat)} · ${ago(x.created_at)}${x.hidden ? ' · مخفية' + (x.hidden_reason ? ': ' + esc(x.hidden_reason) : '') : ''}</span></div><div class="ops"><button class="btn sm" data-view="${esc(x.id)}">عرض</button><button class="btn sm" data-h="${esc(x.id)}">${x.hidden ? 'إظهار' : 'إخفاء'}</button>${isAdmin() || S.role === 'moderator' ? `<button class="btn sm del" data-x="${esc(x.id)}">حذف</button>` : ''}</div></div>`).join('')}</div>` : emptyBox('لا توجد حالات.');
    bindCaseOps($('#ac'), cs);
  },
  async reviews() {
    const L = await S.api.allReviews();
    $('#ac').innerHTML = L.length ? `<div class="list">${L.map(r => `<div class="it"><div class="mid"><b>${esc(r.doctors?.name || '')}</b> ${stars(r.rating)} ${r.status === 'hidden' ? '<span class="pill rejected">مخفي</span>' : ''}<span style="display:block">${esc(r.author_name)} · ${ago(r.created_at)}${r.comment ? ' — ' + esc(r.comment) : ''}</span></div><div class="ops"><button class="btn sm" data-rv="${esc(r.id)}" data-s="${r.status === 'hidden' ? 'published' : 'hidden'}">${r.status === 'hidden' ? 'إظهار' : 'إخفاء'}</button></div></div>`).join('')}</div><p class="hint" style="margin-top:12px">لا يمكن تعديل نص التقييم أو نجومه من أي حساب، فقط إخفاؤه إذا خالف القواعد.</p>` : emptyBox('لا توجد تقييمات.');
    $$('#ac [data-rv]').forEach(b => b.onclick = async () => { const st = b.dataset.s; let reason = null; if (st === 'hidden') { reason = await ask('سبب الإخفاء'); if (reason === null) return; } try { await S.api.setReview(b.dataset.rv, st, reason); toast('تم'); V.reviews(); } catch (er) { toast(errMsg(er)); } });
  },
  async reps() {
    const [reps, cs, rv] = await Promise.all([S.api.reports(), S.api.allCases(), S.api.allReviews()]);
    $('#ac').innerHTML = reps.length ? `<div class="list">${reps.map(r => { const x = cs.find(k => k.id === r.case_id), y = rv.find(k => k.id === r.review_id); return `<div class="it">${x ? `<img class="th" src="${safeImg(x.after_url)}" alt="">` : ''}<div class="mid"><b>${esc(r.reason)}</b><span>${x ? 'حالة: ' + esc(x.title) + (x.hidden ? ' (مخفية)' : '') : y ? 'تقييم: ' + esc(y.comment || '★'.repeat(y.rating)) + (y.status === 'hidden' ? ' (مخفي)' : '') : 'محتوى محذوف'} · ${ago(r.created_at)}</span></div><div class="ops">${x ? `<button class="btn sm" data-view="${esc(x.id)}">عرض</button>${x.hidden ? '' : `<button class="btn sm dk" data-h="${esc(x.id)}">إخفاء الحالة</button>`}` : ''}${y && y.status !== 'hidden' ? `<button class="btn sm dk" data-rh="${esc(y.id)}">إخفاء التقييم</button>` : ''}<button class="btn sm" data-r="${esc(r.id)}">إغلاق البلاغ</button></div></div>`; }).join('')}</div>` : emptyBox('لا توجد بلاغات مفتوحة.');
    bindCaseOps($('#ac'), cs, () => V.reps());
    $$('#ac [data-rh]').forEach(b => b.onclick = async () => { try { await S.api.setReview(b.dataset.rh, 'hidden', 'بلاغ'); toast('أُخفي التقييم'); V.reps(); } catch (er) { toast(errMsg(er)); } });
    $$('#ac [data-r]').forEach(b => b.onclick = async () => { b.disabled = true; try { await S.api.delReport(b.dataset.r); toast('أُغلق البلاغ'); V.reps(); } catch (er) { toast(errMsg(er)); b.disabled = false; } });
  },
  async bookings() {
    const L = await S.api.adminBookings();
    $('#ac').innerHTML = `<p class="hint" style="margin:0 0 12px">نظرة عامة فقط. أسماء المرضى وأرقامهم تبقى عند الطبيب المعني ولا تُعرض هنا.</p>` + (L.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>الطبيب</th><th>الموعد</th><th>الحالة</th><th>أُنشئ</th></tr></thead><tbody>${L.map(b => `<tr><td>${esc(b.doctors?.name || '')}</td><td>${fullWhen(b.start_at)}</td><td><span class="bstat ${b.status}">${BSTATUS[b.status]}</span></td><td>${ago(b.created_at)}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('لا توجد حجوزات بعد.'));
  },
  async tips() {
    const tips = await S.api.tips(); const c = $('#ac');
    c.innerHTML = `<div class="dash"><div class="box"><h3 style="margin-bottom:12px" id="tfh">نصيحة جديدة</h3><form class="f" id="tf"><input type="hidden" name="id"><label>العنوان<input name="title" required maxlength="100"></label><label>النص<textarea name="body" required maxlength="1000"></textarea></label><span class="hint">انشر معلومات طبية موثوقة وعامة، ولا تنشر تشخيصاً فردياً.</span><div class="acts" style="margin:0"><button class="btn pri">حفظ</button><button type="button" class="btn" id="tcl" hidden>إلغاء التعديل</button></div></form></div>
      <div class="list">${tips.map(x => `<div class="it"><div class="mid"><b>${esc(x.title)}</b><span>${esc(x.body).slice(0, 140)}</span></div><div class="ops"><button class="btn sm" data-e="${esc(x.id)}">تعديل</button><button class="btn sm del" data-t="${esc(x.id)}">حذف</button></div></div>`).join('') || emptyBox('لا توجد نصائح.')}</div></div>`;
    $('#tf').onsubmit = async e => { e.preventDefault(); const f = e.target, t = { title: f.title.value.trim(), body: f.body.value.trim() }; try { f.id.value ? await S.api.updateTip(f.id.value, t) : await S.api.addTip(t); S.at = 0; toast('حُفظت النصيحة'); V.tips(); } catch (er) { toast(errMsg(er)); } };
    $$('#ac [data-e]').forEach(b => b.onclick = () => { const t = tips.find(x => x.id === b.dataset.e), f = $('#tf'); f.id.value = t.id; f.title.value = t.title; f.body.value = t.body; $('#tfh').textContent = 'تعديل النصيحة'; $('#tcl').hidden = false; f.title.focus(); });
    $('#tcl').onclick = () => V.tips();
    $$('#ac [data-t]').forEach(b => b.onclick = () => confirm2(b, async () => { await S.api.delTip(b.dataset.t); S.at = 0; toast('حُذفت'); V.tips(); }));
  },
  async lists() {
    const r = await S.api.lists(); const c = $('#ac');
    if (!r) { c.innerHTML = emptyBox('إدارة القوائم تحتاج قاعدة البيانات الحقيقية بعد تشغيل 003_platform.sql.'); return; }
    const T = [['areas', 'المناطق'], ['specializations', 'التخصصات'], ['case_categories', 'تصنيفات الحالات']];
    c.innerHTML = `<div class="info">${T.map(([t, n]) => `<div class="box"><h3>${n}</h3><form class="acts" data-add="${t}" style="margin:10px 0"><input class="sel" name="n" required maxlength="60" placeholder="إضافة جديد" style="flex:1"><button class="btn sm pri">إضافة</button></form><div class="list">${r.raw[t].map(x => `<div class="it" style="padding:8px 10px"><div class="mid"><b style="${x.active ? '' : 'opacity:.5;text-decoration:line-through'}">${esc(x.name)}</b></div><button class="btn sm" data-tg="${t}" data-id="${x.id}" data-a="${x.active ? 0 : 1}">${x.active ? 'إخفاء' : 'إظهار'}</button></div>`).join('')}</div></div>`).join('')}</div><p class="hint" style="margin-top:12px">الإخفاء لا يحذف شيئاً: الأطباء المسجلون بالقيمة القديمة يبقون كما هم.</p>`;
    $$('#ac [data-add]').forEach(f => f.onsubmit = async e => { e.preventDefault(); try { await S.api.listAdd(f.dataset.add, f.n.value.trim()); toast('أُضيف'); V.lists(); } catch (er) { toast(errMsg(er)); } });
    $$('#ac [data-tg]').forEach(b => b.onclick = async () => { try { await S.api.listSet(b.dataset.tg, +b.dataset.id, { active: b.dataset.a === '1' }); V.lists(); } catch (er) { toast(errMsg(er)); } });
  },
  async users() {
    const c = $('#ac'); c.innerHTML = `<div class="acts" style="margin:0 0 12px"><input class="sel" id="us" type="search" placeholder="ابحث بالبريد أو اسم الطبيب" style="flex:1;max-width:360px"><button class="btn sm" id="ug">بحث</button></div>${isSuper() ? '' : '<p class="hint">تغيير الأدوار للمدير الأعلى فقط.</p>'}<div id="ul"></div>`;
    const load = async () => { const L = await S.api.users($('#us').value.trim()); $('#ul').innerHTML = `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>البريد</th><th>صفحة طبيب</th><th>الدور</th><th>انضم</th></tr></thead><tbody>${L.map(u => `<tr><td dir="ltr" style="text-align:right">${esc(u.email)}</td><td>${esc(u.doctor_name || '—')}${u.doctor_status ? ` <span class="pill ${u.doctor_status}">${STATUS[u.doctor_status]}</span>` : ''}</td><td>${isSuper() && u.id !== S.me.id ? `<select class="sel" data-u="${esc(u.id)}">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ROLES[u.role] || u.role}</td><td>${ago(u.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
      $$('#ul [data-u]').forEach(s => s.onchange = async () => { try { await S.api.setRole(s.dataset.u, s.value); toast('تغيّر الدور وسُجّل في السجل'); } catch (er) { toast(errMsg(er)); load(); } }); };
    $('#ug').onclick = load; $('#us').onkeydown = e => e.key === 'Enter' && load(); load();
  },
  async audit() {
    const L = await S.api.audit(); const A = { 'doctor.status': 'تغيير حالة طبيب', 'doctor.verify': 'توثيق طبيب', 'doctor.unverify': 'إلغاء توثيق', 'doctor.feature': 'تمييز طبيب', 'doctor.unfeature': 'إلغاء تمييز', 'doctor.delete': 'حذف طبيب', 'case.hide': 'إخفاء حالة', 'case.unhide': 'إظهار حالة', 'case.delete': 'حذف حالة', 'review.hidden': 'إخفاء تقييم', 'review.published': 'إظهار تقييم', 'user.role': 'تغيير دور', 'verification.approved': 'قبول توثيق', 'verification.rejected': 'رفض توثيق', 'verification.needs_info': 'طلب مستندات', 'report.close': 'إغلاق بلاغ', 'tip.insert': 'نصيحة جديدة', 'tip.update': 'تعديل نصيحة', 'tip.delete': 'حذف نصيحة', broadcast: 'إشعار جماعي', 'migration.apply': 'تحديث قاعدة البيانات' };
    $('#ac').innerHTML = L.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>الوقت</th><th>العملية</th><th>المنفّذ</th><th>التفاصيل</th></tr></thead><tbody>${L.map(x => `<tr><td>${ago(x.created_at)}</td><td>${esc(A[x.action] || x.action)}</td><td>${esc(ROLES[x.actor_role] || x.actor_role || '')}</td><td><code>${esc(Object.entries(x.details || {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '))}</code></td></tr>`).join('')}</tbody></table></div>` : emptyBox('السجل فارغ.');
  },
  async settings() {
    const st = await S.api.settings(); const a = st.announcement || {}; const c = $('#ac');
    c.innerHTML = `<div class="dash"><div class="box"><h3>شريط الإعلان العام</h3><form class="f" id="anf" style="margin-top:12px"><label>النص<input name="t" maxlength="160" value="${esc(a.text)}"></label><label class="consent" style="background:var(--soft)"><input type="checkbox" name="on" ${a.active ? 'checked' : ''}>إظهار الشريط أعلى كل الصفحات</label><button class="btn pri" style="justify-self:start">حفظ</button></form></div>
      <div class="box"><h3>إشعار داخل المنصة</h3><form class="f" id="bcf" style="margin-top:12px"><label>العنوان<input name="t" required maxlength="120"></label><label>النص<textarea name="b" maxlength="500"></textarea></label><label>إلى<select name="g"><option value="doctors">كل الأطباء</option><option value="all">كل المستخدمين</option></select></label><span class="hint">يظهر في مركز الإشعارات داخل المنصة فقط. البريد والواتساب يحتاجان ربطاً خارجياً غير مفعّل.</span><button class="btn pri" style="justify-self:start">إرسال</button></form></div></div>`;
    $('#anf').onsubmit = async e => { e.preventDefault(); const f = e.target; try { await S.api.saveSetting('announcement', { text: f.t.value.trim(), active: f.on.checked }); toast('حُفظ الإعلان'); } catch (er) { toast(errMsg(er)); } };
    $('#bcf').onsubmit = async e => { e.preventDefault(); const f = e.target; try { const n = await S.api.broadcast(f.t.value.trim(), f.b.value.trim(), f.g.value); toast(`أُرسل إلى ${n} مستخدم`); f.reset(); } catch (er) { toast(errMsg(er)); } };
  }
};

function docRow(d, full) {
  return `<div class="it">${avatar(d, 'sm')}<div class="mid"><b>${nm(d)}</b><span>${[d.spec, d.area, d.phone].filter(Boolean).map(esc).join(' · ')} · ${d.case_count || 0} حالة · انضم ${ago(d.created_at)}${hasLoc(d) ? ' · على الخارطة' : ' · بدون موقع'}${d.slug ? ' · /' + esc(d.slug) : ''}</span>${full ? `<span style="display:block;margin-top:4px">${[d.clinic, d.address, d.edu].filter(Boolean).map(esc).join(' · ')}</span>` : ''}</div>
    <div class="ops"><span class="pill ${d.status}">${STATUS[d.status]}</span><a class="btn sm" href="#/d/${encodeURIComponent(d.id)}">مراجعة الملف</a>
    ${d.status !== 'approved' ? `<button class="btn sm dk" data-a="approve" data-id="${esc(d.id)}">${d.status === 'suspended' ? 'إعادة التفعيل' : 'قبول'}</button>` : ''}
    ${d.status === 'pending' ? `<button class="btn sm del" data-a="reject" data-id="${esc(d.id)}">رفض</button>` : ''}
    ${d.status === 'approved' ? `${d.verified ? `<button class="btn sm" data-a="unverify" data-id="${esc(d.id)}">إلغاء التوثيق</button>` : ''}<button class="btn sm" data-a="feature" data-id="${esc(d.id)}">${d.featured ? 'إلغاء التمييز' : 'تمييز'}</button><button class="btn sm del" data-a="suspend" data-id="${esc(d.id)}">إيقاف</button>` : ''}
    ${isSuper() ? `<button class="btn sm del" data-a="del" data-id="${esc(d.id)}">حذف</button>` : ''}</div></div>`;
}
function bindDocs(root, docs) {
  root.querySelectorAll('[data-a]').forEach(b => { const id = b.dataset.id, d = docs.find(x => x.id === id); b.onclick = () => {
    const a = b.dataset.a, done = () => { S.at = 0; toast('تم، وسُجّل في السجل'); $('.tabs button.on').click(); };
    if (['del', 'reject', 'suspend', 'unverify'].includes(a)) return confirm2(b, async () => { a === 'del' ? await S.api.deleteDoctor(id) : await S.api.setDoctor(id, a === 'unverify' ? { verified: false } : { status: a === 'reject' ? 'rejected' : 'suspended' }); done(); });
    b.disabled = true; S.api.setDoctor(id, a === 'approve' ? { status: 'approved' } : { featured: !d.featured }).then(done).catch(er => { toast(errMsg(er)); b.disabled = false; }); }; });
}
function bindCaseOps(c, cs, after) {
  const re = after || (() => V.cases());
  c.querySelectorAll('[data-view]').forEach(b => b.onclick = () => openCase(cs.find(k => k.id === b.dataset.view)));
  c.querySelectorAll('[data-h]').forEach(b => b.onclick = async () => { const x = cs.find(k => k.id === b.dataset.h); let reason = null; if (!x.hidden) { reason = await ask('سبب الإخفاء (يظهر للطبيب)'); if (reason === null) return; } try { await S.api.setCase(x.id, { hidden: !x.hidden, hidden_reason: reason }); toast(x.hidden ? 'أُظهرت الحالة' : 'أُخفيت الحالة وأُشعر الطبيب'); re(); } catch (er) { toast(errMsg(er)); } });
  c.querySelectorAll('[data-x]').forEach(b => b.onclick = () => confirm2(b, async () => { await S.api.deleteCase(cs.find(k => k.id === b.dataset.x)); toast('حُذفت الحالة'); re(); }));
}
function ask(label) {
  return new Promise(res => { let done = false; openModal(`<div class="tx"><form class="f" id="askf"><label>${esc(label)}<input name="v" required maxlength="200"></label><button class="btn pri">تأكيد</button></form></div>`, () => { if (!done) res(null); });
    $('#askf').onsubmit = e => { e.preventDefault(); done = true; const v = e.target.v.value.trim(); closeModal(); res(v); }; });
}
