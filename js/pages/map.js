// خارطة الأطباء: علامات، GPS بإذن المستخدم، الأقرب، تجميع العلامات عند الكثرة
import { $, $$, esc, openNow, hasLoc, haversine, kmTxt, toast, setApp, setMeta, docHref } from '../core/util.js';
import { S, loadPublic } from '../core/state.js';
import { IC, emptyBox } from '../core/art.js';
import { loadLeaflet, baseMap, docIcon, meIcon, getGPS, CENTER } from '../core/maps.js';
import { avatar, nm, openPill, popHtml, ratingPill } from '../components/doctor.js';

export async function pageMap() {
  setMeta('خارطة أطباء الأسنان', 'خارطة عيادات أطباء الأسنان في ذي قار مع الأقرب إليك والاتجاهات.');
  setApp(`<section class="band" style="padding-bottom:12px"><div class="wrap"><div class="sec-head"><div><h1 style="font-size:clamp(24px,4vw,34px)">خارطة الأطباء</h1><p id="mhint">عيادات ذي قار المسجّلة. موقعك لا يُطلب إلا عند الضغط على «الأقرب إليّ» ولا يُحفظ.</p></div>
    <div class="acts" style="margin:0"><label class="sr" for="mspec">التخصص</label><select class="sel" id="mspec"><option value="">كل التخصصات</option>${S.lists.specs.map(s => `<option>${esc(s)}</option>`).join('')}</select>
    <label class="sr" for="marea">المنطقة</label><select class="sel" id="marea"><option value="">كل المناطق</option>${S.lists.areas.map(s => `<option>${esc(s)}</option>`).join('')}</select>
    <button class="btn ${S.filt.open ? 'on' : ''}" id="mopen" aria-pressed="${S.filt.open}">مفتوح الآن</button><button class="btn pri" id="gps">${IC.gps}<span>الأقرب إليّ</span></button></div></div></div></section>
  <section class="band" style="padding-top:0"><div class="wrap mapgrid"><div class="mapbox"><div id="map" dir="ltr" role="application" aria-label="خارطة العيادات"></div></div><aside class="mlist" id="mlist" aria-label="قائمة العيادات">${'<div class="sk"></div>'.repeat(4)}</aside></div></section>`);
  await loadPublic();
  try { await loadLeaflet(); } catch { $('#map').innerHTML = emptyBox('تعذّر تحميل الخارطة. تأكد من اتصالك بالإنترنت.'); }
  let map = null, layer = null, meMk = null; const marks = {};
  if (window.L) {
    map = baseMap($('#map'), CENTER, 9); layer = L.layerGroup().addTo(map);
    map.on('popupopen', e => { const a = e.popup.getElement()?.querySelector('[data-wa]'); if (a) a.onclick = () => S.api.logEvent(a.dataset.wa, 'wa'); });
    map.on('moveend', () => { if (S.docs.length > 300) draw(true); });
  }
  let fitted = false;
  function draw(onlyMarkers) {
    const spec = $('#mspec').value, area = $('#marea').value, me = S.myLoc;
    const list = S.docs.filter(d => hasLoc(d) && (!spec || d.spec === spec) && (!area || d.area === area) && (!S.filt.open || openNow(d))).map(d => ({ d, km: me ? haversine(me, [+d.lat, +d.lng]) : null }));
    list.sort((a, b) => me ? a.km - b.km : (b.d.featured - a.d.featured) || String(a.d.name).localeCompare(b.d.name, 'ar'));
    if (layer) {
      layer.clearLayers();
      // تحسين الأداء: عند الكثرة نعرض فقط ما داخل حدود الخارطة الظاهرة
      const bounds = map.getBounds ? map.getBounds().pad(.3) : null;
      const vis = list.length > 300 && bounds ? list.filter(({ d }) => bounds.contains([+d.lat, +d.lng])) : list;
      vis.forEach(({ d, km }) => { marks[d.id] = L.marker([+d.lat, +d.lng], { icon: docIcon(d), title: d.name, keyboard: true }).bindPopup(popHtml(d, km), { maxWidth: 280 }).addTo(layer); });
      if (!fitted && list.length) { map.fitBounds(L.latLngBounds(list.map(x => [+x.d.lat, +x.d.lng])).pad(.2), { maxZoom: 13 }); fitted = true; }
    }
    if (onlyMarkers) return;
    const noLoc = S.docs.filter(d => !hasLoc(d)).length;
    $('#mlist').innerHTML = (list.length ? list.slice(0, 80).map(({ d, km }) => `<button class="mitem" data-id="${esc(d.id)}">${avatar(d, 'sm')}<div class="mid"><b>${nm(d)}</b><span>${esc(d.spec)} · ${esc(d.area)}</span><div class="meta" style="margin-top:2px">${openPill(d)}${ratingPill(d)}</div></div>${km != null ? `<span class="km">${kmTxt(km)}</span>` : ''}</button>`).join('') : emptyBox('لا توجد عيادات بموقع محدد تطابق الاختيار.'))
      + (noLoc ? `<p class="hint" style="margin:6px 4px">${noLoc} طبيب لم يحدد موقع عيادته بعد.</p>` : '');
    $$('#mlist .mitem').forEach(b => b.onclick = () => { const m = marks[b.dataset.id]; const d = S.docs.find(x => x.id === b.dataset.id); if (m && map) { map.setView(m.getLatLng(), 15); setTimeout(() => (marks[b.dataset.id] || m).openPopup(), 50); if (innerWidth < 960) $('#map').scrollIntoView({ behavior: 'smooth' }); } else location.hash = docHref(d); });
  }
  $('#mspec').onchange = () => draw(); $('#marea').onchange = () => draw();
  $('#mopen').onclick = e => { S.filt.open = !S.filt.open; e.currentTarget.classList.toggle('on', S.filt.open); e.currentTarget.setAttribute('aria-pressed', S.filt.open); draw(); };
  $('#gps').onclick = async e => {
    const b = e.currentTarget, t = b.querySelector('span'); b.disabled = true; t.textContent = 'جارٍ تحديد موقعك…';
    try { S.myLoc = await getGPS(); if (map) { meMk && meMk.remove(); meMk = L.marker(S.myLoc, { icon: meIcon(), zIndexOffset: 1000 }).bindPopup('<div class="pop"><b>موقعك الحالي</b></div>').addTo(map); map.setView(S.myLoc, 12); } $('#mhint').textContent = 'مرتبة من الأقرب إلى الأبعد حسب موقعك الحالي (لا نحفظ موقعك).'; draw(); }
    catch (er) { toast(er.message); } finally { b.disabled = false; t.textContent = 'الأقرب إليّ'; }
  };
  if (S.myLoc && map) meMk = L.marker(S.myLoc, { icon: meIcon(), zIndexOffset: 1000 }).addTo(map);
  draw();
}
