// الصفحة الرئيسية + دليل الأطباء (بحث، فلاتر، مشاركة، آخر عمليات البحث، صفحات التخصص والمنطقة)
import { $, $$, esc, norm, openNow, store, setApp, copy, setMeta, baseUrl, hasLoc, haversine } from '../core/util.js';
import { S, loadPublic } from '../core/state.js';
import { SCENE, tooth3D, IC, emptyBox } from '../core/art.js';
import { docCard, tile, bindTiles, avatar, nm } from '../components/doctor.js';

const PAGE = 24;
let shown = PAGE;

export function readQuery(q) {
  const p = new URLSearchParams(q || '');
  Object.assign(S.filt, { q: p.get('q') || '', area: p.get('area') || '', spec: p.get('spec') || '', open: p.get('open') === '1', verified: p.get('v') === '1', booking: p.get('b') === '1', sort: p.get('sort') || S.filt.sort || 'top' });
}
const queryString = () => { const f = S.filt, p = new URLSearchParams(); if (f.q) p.set('q', f.q); if (f.area) p.set('area', f.area); if (f.spec) p.set('spec', f.spec); if (f.open) p.set('open', '1'); if (f.verified) p.set('v', '1'); if (f.booking) p.set('b', '1'); if (f.sort !== 'top') p.set('sort', f.sort); return p.toString(); };
const rememberSearch = () => { const q = S.filt.q.trim(); if (q.length < 2) return; const l = store.get('basma_recent', []).filter(x => x !== q); l.unshift(q); store.set('basma_recent', l.slice(0, 6)); };

export async function pageHome({ toCases = false, preset = null } = {}) {
  if (preset) Object.assign(S.filt, { q: '', area: '', spec: '', open: false, verified: false, booking: false }, preset);
  shown = PAGE;
  const title = preset?.spec ? `أطباء ${preset.spec} في ذي قار` : preset?.area ? `أطباء الأسنان في ${preset.area}` : 'طبيب أسنانك في ذي قار، بحالاته الحقيقية';
  setMeta(preset ? title : '', preset ? `${title}: الأسماء والعيادات وأوقات الدوام والحالات قبل وبعد والحجز المباشر.` : null);
  const L = S.lists;
  setApp(`<section class="hero band">${SCENE}<div class="zig"></div><div class="wrap"><div><h1>${esc(title)}</h1>
    <p>من أرض أور إلى ابتسامتك: ابحث عن طبيب الأسنان المناسب في الناصرية والأقضية، شاهد نتائجه قبل وبعد، واحجز موعدك مباشرة.</p>
    <form class="search" role="search" id="sform"><label class="sr" for="q">ابحث</label><input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="اسم الطبيب، العيادة، الخدمة أو التخصص" value="${esc(S.filt.q)}">
    <label class="sr" for="area">المنطقة</label><select id="area"><option value="">كل المناطق</option>${L.areas.map(a => `<option ${a === S.filt.area ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></form>
    <div class="recent" id="recent"></div>
    <div class="quick">
      <button class="qbtn ${S.filt.open ? 'on' : ''}" data-f="open" aria-pressed="${S.filt.open}"><span class="dot"></span>مفتوح الآن</button>
      <button class="qbtn ${S.filt.verified ? 'on' : ''}" data-f="verified" aria-pressed="${S.filt.verified}">✓ موثّق</button>
      <button class="qbtn ${S.filt.booking ? 'on' : ''}" data-f="booking" aria-pressed="${S.filt.booking}">حجز مباشر</button>
      <a class="qbtn" href="#/map">${IC.pin}الأقرب إليّ</a></div>
    <div class="stats" id="stats"></div></div><div class="hero-art">${tooth3D()}</div></div></section>
  <nav class="chips scroll" aria-label="التخصص"><button class="chip" data-s="">كل التخصصات</button>${L.specs.map(s => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</nav>
  <section class="band" id="featSec" hidden><div class="wrap"><div class="sec-head"><div><h2>أطباء مميزون</h2><p>ظهور مميّز معلن من إدارة المنصة.</p></div></div><div class="grid" id="feat"></div></div></section>
  <section class="band" id="dir"><div class="wrap"><div class="sec-head"><div><h2>دليل الأطباء</h2><p id="cnt" aria-live="polite"></p></div>
    <div class="acts" style="margin:0"><label class="sr" for="sort">الترتيب</label><select class="sel" id="sort"><option value="top">الأنسب</option><option value="rating">الأعلى تقييماً</option><option value="cases">الأكثر حالات</option><option value="near">الأقرب إليّ</option><option value="new">الأحدث</option></select>
    <button class="btn sm" id="shareRes">مشاركة النتائج</button></div></div>
    <div id="grid" class="grid">${'<div class="sk"></div>'.repeat(6)}</div><div style="text-align:center;margin-top:16px"><button class="btn" id="more" hidden>عرض المزيد</button></div></div></section>
  <div class="steps"></div>
  <section class="band" id="specSec"><div class="wrap"><div class="sec-head"><div><h2>تصفّح حسب التخصص</h2></div></div><div class="spec-grid" id="specs"></div></div></section>
  <section class="band soft" id="cases"><div class="wrap"><div class="sec-head"><div><h2>أحدث الحالات قبل وبعد</h2><p>اسحب على الصورة لمقارنة قبل وبعد. تُنشر بموافقة المرضى ودون إظهار هويتهم.</p></div></div><div id="feed" class="feed"></div></div></section>
  <section class="band" id="tipsSec"><div class="wrap"><div class="sec-head"><div><h2>نصائح للعناية بأسنانك</h2><p>تنشرها إدارة المنصة بالتعاون مع أطباء ذي قار.</p></div></div><div id="tips" class="tips"></div></div></section>
  <section class="band"><div class="wrap"><div class="join"><div><h2>أنت طبيب أسنان في ذي قار؟</h2><p style="opacity:.85;margin:8px 0 0">أنشئ صفحتك المهنية مجاناً واستقبل المرضى من الدليل والخارطة.</p>
    <ul><li>صفحة باسمك ورابط خاص وبطاقة QR</li><li>حجز مواعيد داخلي بلا تداخل</li><li>معرض حالات قبل وبعد</li><li>شارة توثيق بعد مراجعة النقابة</li></ul></div>
    <div style="display:grid;gap:10px;justify-items:start"><a class="btn pri" href="#/login?m=up">انضم كطبيب مجاناً</a><a class="btn ghost" href="#/login">لدي حساب</a></div></div></div></section>`);

  $('#sort').value = S.filt.sort;
  let deb; $('#q').oninput = e => { S.filt.q = e.target.value; clearTimeout(deb); deb = setTimeout(() => { shown = PAGE; grid(); }, 160); };
  $('#q').onchange = rememberSearch; $('#sform').onsubmit = e => { e.preventDefault(); rememberSearch(); $('#dir').scrollIntoView({ behavior: 'smooth' }); };
  $('#area').onchange = e => { S.filt.area = e.target.value; shown = PAGE; grid(); };
  $('#sort').onchange = async e => { S.filt.sort = e.target.value; if (S.filt.sort === 'near' && !S.myLoc) { try { const { getGPS } = await import('../core/maps.js'); S.myLoc = await getGPS(); } catch (er) { const { toast } = await import('../core/util.js'); toast(er.message); S.filt.sort = 'top'; e.target.value = 'top'; } } grid(); };
  $$('.qbtn[data-f]').forEach(b => b.onclick = () => { const k = b.dataset.f; S.filt[k] = !S.filt[k]; b.classList.toggle('on', S.filt[k]); b.setAttribute('aria-pressed', S.filt[k]); shown = PAGE; grid(); });
  $$('.chip').forEach(b => { b.classList.toggle('on', b.dataset.s === S.filt.spec); b.onclick = () => { S.filt.spec = b.dataset.s; $$('.chip').forEach(c => c.classList.toggle('on', c === b)); shown = PAGE; grid(); }; });
  $('#more').onclick = () => { shown += PAGE; grid(); };
  $('#shareRes').onclick = () => { const q = queryString(); copy(baseUrl() + '#/' + (q ? '?' + q : '')); };
  const rec = store.get('basma_recent', []);
  $('#recent').innerHTML = rec.length ? rec.map(r => `<button type="button">${esc(r)}</button>`).join('') : '';
  $$('#recent button').forEach(b => b.onclick = () => { $('#q').value = S.filt.q = b.textContent; grid(); $('#dir').scrollIntoView({ behavior: 'smooth' }); });

  await loadPublic();
  const D = S.docs, open = D.filter(d => openNow(d)).length, cc = D.reduce((a, d) => a + (d.case_count || 0), 0), ver = D.filter(d => d.verified).length;
  $('#stats').innerHTML = `<div class="stat"><b>${D.length}</b>طبيب</div><div class="stat"><b>${ver}</b>موثّق</div><div class="stat"><b>${cc}</b>حالة منشورة</div><div class="stat"><b>${open}</b>مفتوح الآن</div>`;
  const feat = D.filter(d => d.featured).slice(0, 4);
  if (feat.length && !preset) { $('#featSec').hidden = false; $('#feat').innerHTML = feat.map(d => docCard(d)).join(''); }
  const sc = {}; D.forEach(d => sc[d.spec] = (sc[d.spec] || 0) + 1);
  $('#specs').innerHTML = L.specs.map(s => `<a class="spec" href="#/spec/${encodeURIComponent(s)}"><b>${esc(s)}</b><span>${sc[s] || 0} طبيب</span></a>`).join('');
  grid();
  $('#feed').innerHTML = S.latest.length ? S.latest.map(c => tile(c, D.find(d => d.id === c.doctor_id))).join('') : emptyBox('لم تُنشر حالات بعد.');
  bindTiles($('#feed'), S.latest);
  $('#tips').innerHTML = S.tips.map(t => `<article class="tip"><h3>${esc(t.title)}</h3><p>${esc(t.body)}</p></article>`).join('');
  if (!S.tips.length) $('#tipsSec').hidden = true;
  if (toCases) $('#cases').scrollIntoView({ behavior: 'smooth' });
  else if (S.filt.q || S.filt.area || S.filt.spec || preset) setTimeout(() => $('#dir').scrollIntoView({ behavior: 'smooth' }), 100);
}

function grid() {
  const g = $('#grid'); if (!g) return; const f = S.filt, q = norm(f.q);
  let list = S.docs.filter(d => (!f.area || d.area === f.area) && (!f.spec || d.spec === f.spec) && (!f.open || openNow(d)) && (!f.verified || d.verified) && (!f.booking || d.booking_enabled)
    && (!q || (d._n ||= norm([d.name, d.title, d.clinic, d.spec, d.area, (d.services || []).join(' '), d.bio].join(' '))).includes(q)));
  const km = d => S.myLoc && hasLoc(d) ? haversine(S.myLoc, [+d.lat, +d.lng]) : null;
  const score = d => (d.featured ? 4 : 0) + (d.verified ? 2 : 0) + Math.min(2, (d.case_count || 0) / 5) + (d.avg_rating || 0) / 2.5;
  list.sort((a, b) => f.sort === 'cases' ? (b.case_count || 0) - (a.case_count || 0) : f.sort === 'rating' ? ((b.avg_rating || 0) - (a.avg_rating || 0)) || (b.review_count - a.review_count)
    : f.sort === 'new' ? String(b.created_at).localeCompare(a.created_at) : f.sort === 'near' ? ((km(a) ?? 1e9) - (km(b) ?? 1e9)) : score(b) - score(a));
  const tags = [f.spec, f.area, f.open && 'مفتوح الآن', f.verified && 'موثّق', f.booking && 'حجز مباشر'].filter(Boolean);
  $('#cnt').textContent = `${list.length} من ${S.docs.length} طبيب${tags.length ? ' · ' + tags.join(' · ') : ''}`;
  g.innerHTML = list.length ? list.slice(0, shown).map(d => docCard(d, f.sort === 'near' ? km(d) : null)).join('') : emptyBox('لا يوجد طبيب يطابق البحث.', '<button class="btn sm" id="clr">مسح الفلاتر</button>');
  $('#more').hidden = list.length <= shown;
  const clr = $('#clr'); clr && (clr.onclick = () => { Object.assign(S.filt, { q: '', area: '', spec: '', open: false, verified: false, booking: false }); location.hash = '#/'; });
  const h = location.hash; if (h === '' || h === '#/' || h.startsWith('#/?')) history.replaceState(null, '', '#/' + (queryString() ? '?' + queryString() : ''));
}
