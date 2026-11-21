// ملف الطبيب العام: الحالات، التقييمات، المواعيد والموقع، الحجز، المشاركة
import { $, $$, esc, fmt, DAYS, hasLoc, haversine, kmTxt, waLink, telLink, setApp, setDact, share, setMeta, pageUrl, dayLabel, wrapMsg } from '../core/util.js';
import { S, STATUS } from '../core/state.js';
import { SCENE, tooth3D, IX, IB, emptyBox } from '../core/art.js';
import { avatar, nm, openPill, tile, bindTiles, stars, reportForm, popHtml } from '../components/doctor.js';
import { loadLeaflet, baseMap, docIcon, killMaps } from '../core/maps.js';
import { openBooking } from './booking.js';

export async function pageDoctor(key) {
  setApp(`<section class="dhead band"><div class="wrap" style="display:flex;gap:18px;align-items:center"><div class="sk" style="width:110px;height:110px;border-radius:50%;opacity:.3"></div><div style="flex:1;display:grid;gap:10px"><div class="sk" style="height:28px;width:60%;opacity:.3"></div><div class="sk" style="height:16px;width:40%;opacity:.3"></div></div></div></section>`);
  const d = await S.api.getDoctor(key);
  if (!d) { setMeta('الصفحة غير موجودة'); return setApp(wrapMsg('لم نجد صفحة هذا الطبيب، ربما تغيّر الرابط أو لم تُعتمد الصفحة بعد. <a href="#/">العودة للدليل</a>')); }
  const [cases, reviews] = await Promise.all([S.api.casesOf(d.id, true), S.api.reviewsOf(d.id).catch(() => [])]);
  if (S.me?.id !== d.id) S.api.logEvent(d.id, 'view');
  setMeta(`${d.title || 'د.'} ${d.name} — ${d.spec} في ${d.area}`, `${d.name}، ${d.spec} في ${d.area}${d.clinic ? '، ' + d.clinic : ''}. الحالات قبل وبعد وأوقات الدوام والحجز.`);
  const pub = d.status === 'approved', km = S.myLoc && hasLoc(d) ? haversine(S.myLoc, [+d.lat, +d.lng]) : null;
  const canBook = pub && d.booking_enabled;
  setApp(`<section class="dhead band" style="padding-bottom:64px">${SCENE}<div class="wrap dgrid"><div><a class="back" href="#/">${IX.home} → كل الأطباء</a>
    ${pub ? '' : `<div class="banner ${d.status}">هذه الصفحة ${STATUS[d.status]} ولا تظهر للناس.</div>`}
    <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">${avatar(d, 'lg')}
    <div class="who"><h1>${nm(d)}</h1><p>${[d.spec, d.area, d.clinic].filter(Boolean).map(esc).join(' - ')}</p>
    <div class="meta" style="color:inherit">${openPill(d)}${d.review_count ? `<span class="pill gold">★ ${(+d.avg_rating).toFixed(1)} · ${d.review_count} تقييم</span>` : ''}<span class="pill gold">✓ ${cases.length} حالة</span>${d.years ? `<span class="pill" style="background:rgba(255,255,255,.08)">${+d.years} سنة خبرة</span>` : ''}${km != null ? `<span class="pill" style="background:rgba(255,255,255,.08)">يبعد ${kmTxt(km)}</span>` : ''}</div></div></div>
    <div class="acts" style="margin-top:22px">${canBook ? `<button class="btn pri" id="book">${IB.cal}احجز موعداً</button>` : ''}${d.whatsapp || d.phone ? `<a class="btn ${canBook ? 'ghost' : 'wa'}" id="wa" href="${waLink(d)}" target="_blank" rel="noopener">${IX.wa}واتساب</a>` : ''}
    ${d.phone ? `<a class="btn ghost" id="call" href="${telLink(d)}">${IX.call}اتصال <span dir="ltr">${esc(d.phone)}</span></a>` : ''}${hasLoc(d) ? `<a class="btn ghost" id="dir" href="https://www.google.com/maps/dir/?api=1&destination=${+d.lat},${+d.lng}" target="_blank" rel="noopener">${IX.pin}الاتجاهات</a>` : ''}<button class="btn ghost" id="share">${IB.share}مشاركة</button></div></div>
    <div class="dart">${tooth3D()}</div></div></section>
  <nav class="tabs curve scroll" role="tablist"><button data-t="cases" role="tab">${IX.bag}الحالات</button><button data-t="reviews" role="tab">${IB.star}التقييمات${d.review_count ? ` (${d.review_count})` : ''}</button><button data-t="about" role="tab">${IX.user}عن الطبيب</button><button data-t="hours" role="tab">${IX.pin}المواعيد والموقع</button></nav>
  <section class="band"><div class="wrap" id="tabc" role="tabpanel"></div></section>`);
  const bookBtn = () => openBooking(d);
  if (canBook) setDact(`<button class="btn pri" id="book2">${IB.cal}احجز موعداً</button>${d.phone ? `<a class="btn dk" data-k="call" href="${telLink(d)}">${IX.call}اتصال</a>` : `<a class="btn dk" data-k="wa" href="${waLink(d)}" target="_blank" rel="noopener">${IX.wa}واتساب</a>`}`);
  else if (d.whatsapp || d.phone) setDact(`<a class="btn wa" data-k="wa" href="${waLink(d)}" target="_blank" rel="noopener">${IX.wa}احجز عبر واتساب</a>${d.phone ? `<a class="btn dk" data-k="call" href="${telLink(d)}">${IX.call}اتصال</a>` : ''}`);
  $$('#dact [data-k]').forEach(a => a.onclick = () => S.api.logEvent(d.id, a.dataset.k));
  $('#book') && ($('#book').onclick = bookBtn); $('#book2') && ($('#book2').onclick = bookBtn);
  $('#wa') && ($('#wa').onclick = () => S.api.logEvent(d.id, 'wa')); $('#call') && ($('#call').onclick = () => S.api.logEvent(d.id, 'call')); $('#dir') && ($('#dir').onclick = () => S.api.logEvent(d.id, 'map'));
  $('#share').onclick = () => { S.api.logEvent(d.id, 'share'); share(`${d.title || 'د.'} ${d.name}`, pageUrl(d)); };
  let tab = 'cases', cat = '';
  const paint = () => {
    killMaps(); $$('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === tab); b.setAttribute('aria-selected', b.dataset.t === tab); }); const c = $('#tabc');
    if (tab === 'cases') {
      const cats = [...new Set(cases.map(x => x.cat))], list = cases.filter(x => !cat || x.cat === cat);
      c.innerHTML = !cases.length ? emptyBox('لم ينشر الطبيب حالات بعد.') : `${cats.length > 1 ? `<div class="tagsr" style="margin-bottom:14px"><button class="chip ${cat ? '' : 'on'}" data-k="">الكل (${cases.length})</button>${cats.map(k => `<button class="chip ${k === cat ? 'on' : ''}" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}<div class="feed">${list.map(x => tile(x, d)).join('')}</div>`;
      c.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { cat = b.dataset.k; paint(); }); bindTiles(c, cases, d);
    } else if (tab === 'reviews') {
      const dist = d.dist || {};
      c.innerHTML = `<div class="box" style="margin-bottom:14px">${d.review_count ? `<div class="rate-sum"><div style="text-align:center"><div class="rate-big">${(+d.avg_rating).toFixed(1)}</div>${stars(d.avg_rating)}<div class="hint">${d.review_count} تقييم موثّق</div></div>
        <div>${[5, 4, 3, 2, 1].map(n => { const v = dist['r' + n] || 0; return `<div class="brow" style="grid-template-columns:3em minmax(0,1fr) 2.5em"><span>${n} ★</span><span><i style="width:${d.review_count ? Math.max(2, v / d.review_count * 100) : 0}%"></i></span><span class="num">${v}</span></div>`; }).join('')}</div></div>` : '<p>لا توجد تقييمات بعد.</p>'}
        <p class="hint" style="margin-top:12px">التقييمات من مرضى أتمّوا موعداً عبر المنصة فقط، تقييم واحد لكل موعد، ولا يستطيع الطبيب تعديلها.</p></div>
        <div class="box">${reviews.length ? reviews.map(r => `<div class="rev"><div class="who"><span><b style="color:var(--ink)">${esc(r.author_name)}</b> ${stars(r.rating)}</span><span>${dayLabel(r.created_at)}</span></div>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}<div id="rr-${esc(r.id)}"><button class="linkb" data-rr="${esc(r.id)}">إبلاغ</button></div></div>`).join('') : emptyBox('كن أول من يقيّم بعد زيارتك.')}</div>`;
      c.querySelectorAll('[data-rr]').forEach(b => b.onclick = () => reportForm($('#rr-' + b.dataset.rr), { reviewId: b.dataset.rr }));
    } else if (tab === 'about') {
      c.innerHTML = `<div class="info"><div class="box"><h3>نبذة</h3><p>${esc(d.bio) || '—'}</p></div><div class="box"><h3>الخدمات</h3><div class="tagsr">${(d.services || []).map(s => `<span class="pill">${esc(s)}</span>`).join('') || '—'}</div></div><div class="box"><h3>المؤهلات والخبرة</h3><p>${esc(d.edu) || '—'}</p>${d.years ? `<p style="margin-top:6px;color:var(--muted)">${+d.years} سنة في الممارسة</p>` : ''}${d.verified ? '<p style="margin-top:10px;color:var(--gold-ink)">✓ وثّقت إدارة المنصة مستندات مزاولة المهنة</p>' : ''}</div></div>`;
    } else {
      c.innerHTML = `<div class="info"><div class="box"><h3>أيام الدوام</h3><div class="days">${DAYS.map((n, i) => `<span class="${(d.days || []).includes(i) ? 'on' : ''}">${n}</span>`).join('')}</div><p style="margin-top:12px">${d.open_from ? `من ${fmt(d.open_from)} إلى ${fmt(d.open_to)} (بتوقيت بغداد)` : 'لم تُحدَّد الساعات'}</p>${d.booking_note ? `<p class="hint" style="margin-top:8px">${esc(d.booking_note)}</p>` : ''}</div>
      <div class="box"><h3>العنوان</h3><p>${esc(d.address) || esc(d.area)}</p>${/^https:\/\//.test(d.map_url || '') ? `<a class="btn" style="margin-top:12px" href="${esc(d.map_url)}" target="_blank" rel="noopener">فتح على خرائط Google</a>` : ''}</div>
      <div class="box"><h3>التواصل</h3><p dir="ltr" style="text-align:right">${esc(d.phone) || '—'}</p>${d.whatsapp && d.whatsapp !== d.phone ? `<p dir="ltr" style="text-align:right">واتساب: ${esc(d.whatsapp)}</p>` : ''}</div></div>
      ${hasLoc(d) ? '<div class="minimap" style="margin-top:14px;height:320px"><div id="dmap" dir="ltr"></div></div>' : ''}`;
      if (hasLoc(d)) loadLeaflet().then(() => { if (!$('#dmap')) return; const m = baseMap($('#dmap'), [+d.lat, +d.lng], 15); L.marker([+d.lat, +d.lng], { icon: docIcon(d) }).addTo(m).bindPopup(popHtml(d, km)); }).catch(() => { $('#dmap') && ($('#dmap').innerHTML = emptyBox('تعذّر تحميل الخارطة.')); });
    }
  };
  $$('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; paint(); }); paint();
}
