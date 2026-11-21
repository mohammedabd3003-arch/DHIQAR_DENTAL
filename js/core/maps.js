// الخرائط: تحميل Leaflet عند الحاجة، علامات الأطباء، GPS
import { initial } from '../components/doctor.js';
const LEAF_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', LEAF_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
export const CENTER = [31.0439, 46.2575];
export function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { s.remove(); rej(new Error('تعذّر تحميل مكتبة من الإنترنت')); }; document.head.append(s); }); }
let leafP = null;
export function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (!leafP) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LEAF_CSS; document.head.append(l); leafP = loadScript(LEAF_JS).catch(e => { leafP = null; throw e; }); }
  return leafP;
}
const maps = [];
export function killMaps() { while (maps.length) { try { maps.pop().remove(); } catch { } } }
export function baseMap(el, center, zoom) {
  const m = L.map(el, { zoomControl: true, attributionControl: true }).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m);
  maps.push(m); setTimeout(() => m.invalidateSize(), 120); return m;
}
export const docIcon = d => L.divIcon({ className: '', html: `<div class="pin ${d.featured ? 'feat' : ''}"><span>${initial(d)}</span></div>`, iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -36] });
export const meIcon = () => L.divIcon({ className: '', html: '<div class="mepin"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
export function getGPS() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('جهازك لا يدعم تحديد الموقع'));
    navigator.geolocation.getCurrentPosition(p => res([p.coords.latitude, p.coords.longitude]),
      e => rej(new Error(e.code === 1 ? 'لم تسمح بالوصول لموقعك. فعّل إذن الموقع من المتصفح' : e.code === 3 ? 'انتهت مهلة تحديد الموقع، أعد المحاولة' : 'تعذّر تحديد موقعك')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
}
