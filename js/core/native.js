// طبقة التوافق مع تطبيق الموبايل (Capacitor). على الويب: كل دالة هنا تُرجع السلوك القديم حرفياً.
// لا تستورد شيئاً من ملفات المشروع (تجنباً للاستيراد الدائري). الإضافات تُستدعى عبر جسر Capacitor بلا أداة بناء.
const Cap = window.Capacitor;
export const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
export const platform = isNative ? Cap.getPlatform() : 'web';

const cache = {};
function plugin(name) {
  if (!isNative) return null;
  if (cache[name]) return cache[name];
  try {
    const p = (Cap.Plugins && Cap.Plugins[name]) || (Cap.registerPlugin ? Cap.registerPlugin(name) : null);
    if (p && Cap.isPluginAvailable && !Cap.isPluginAvailable(name)) return null;
    return (cache[name] = p || null);
  } catch { return null; }
}

/* ---------- الرابط العام (لـ QR والمشاركة ومتابعة الحجز وروابط البريد) ----------
   داخل التطبيق عنوان الصفحة هو localhost، فنستخدم رابط الموقع العام من config.js */
export function publicBase() {
  if (!isNative) return location.origin + location.pathname.replace(/index\.html$/, '');
  const u = String((window.BASMA_CONFIG || {}).PUBLIC_SITE_URL || '').trim();
  return u ? u.replace(/\/?$/, '/') : location.origin + '/';
}

/* ---------- المكتبات: محلية داخل التطبيق، CDN على الويب ---------- */
export const LIB = {
  supabase: isNative ? ['js/vendor/supabase.js'] : ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'],
  leafletJs: isNative ? 'js/vendor/leaflet.js' : 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  leafletCss: isNative ? 'js/vendor/leaflet.css' : 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  qrcode: isNative ? 'js/vendor/qrcode.min.js' : 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
};

/* ---------- المشاركة ---------- */
// تُرجع true إذا تمّت داخل التطبيق، false ليكمل الويب بسلوكه المعتاد
export async function nativeShare(title, url) {
  const S = plugin('Share'); if (!S) return false;
  try { await S.share({ title, text: title, url, dialogTitle: 'مشاركة' }); } catch { /* المستخدم ألغى */ }
  return true;
}

/* ---------- حفظ صورة (بطاقة QR) ثم فتح قائمة المشاركة: حفظ في الصور، واتساب، طباعة… ---------- */
export async function saveImage(dataUrl, fileName, title) {
  const F = plugin('Filesystem'), S = plugin('Share');
  if (!F || !S) throw new Error('غير متاح');
  const data = String(dataUrl).split(',')[1];
  const r = await F.writeFile({ path: fileName, data, directory: 'CACHE' });
  try { await S.share({ title, files: [r.uri], dialogTitle: title }); }
  catch (e) { if (!/cancel/i.test(String(e?.message || e))) await S.share({ title, url: r.uri, dialogTitle: title }).catch(() => { }); }
}

/* ---------- الروابط الخارجية ---------- */
const APP_HOSTS = /(^|\.)(wa\.me|whatsapp\.com|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl|instagram\.com|facebook\.com|fb\.com|tiktok\.com|t\.me|telegram\.me)$/i;
export async function openExternal(href) {
  let u; try { u = new URL(href, location.href); } catch { return; }
  const launcher = plugin('AppLauncher'), browser = plugin('Browser');
  const isGoogleMaps = /(^|\.)google\.[a-z.]+$/i.test(u.hostname) && u.pathname.startsWith('/maps');
  try {
    if (!/^https?:$/.test(u.protocol) || APP_HOSTS.test(u.hostname) || isGoogleMaps) {
      if (launcher) { await launcher.openUrl({ url: u.href }); return; }
    } else if (browser) { await browser.open({ url: u.href }); return; }
  } catch { }
  location.href = u.href;
}

/* ---------- شريط الحالة حسب السمة ---------- */
export function statusBar(theme) {
  const B = plugin('StatusBar'); if (!B) return;
  B.setStyle({ style: theme === 'light' ? 'LIGHT' : 'DARK' }).catch(() => { });
  if (platform === 'android') B.setBackgroundColor({ color: theme === 'light' ? '#F7F3EA' : '#06141E' }).catch(() => { });
}

/* ---------- التهيئة داخل التطبيق فقط ---------- */
export function initNative({ isModalOpen, closeModal }) {
  if (!isNative) return;
  document.documentElement.classList.add('native', 'native-' + platform);

  // الروابط التي تفتح خارج التطبيق: واتساب، اتصال، خرائط، صور كاملة، PDF
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a || e.defaultPrevented) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#') || a.hasAttribute('download')) return;
    const ext = a.target === '_blank' || /^(tel|mailto|sms|whatsapp|geo):/i.test(href);
    if (!ext) return;
    e.preventDefault(); openExternal(a.href);
  }, true);

  const App = plugin('App'); if (!App) return;
  // زر الرجوع في أندرويد: أغلق النافذة ← ارجع صفحة ← اخرج من الرئيسية
  App.addListener('backButton', ({ canGoBack }) => {
    if (isModalOpen()) return closeModal();
    const h = location.hash.replace(/^#\/?/, '');
    if (canGoBack && h) return history.back();
    if (h) { location.hash = '#/'; return; }
    App.exitApp();
  });
  // روابط تفتح التطبيق (مثل iq.drur.app://d/slug أو رابط الموقع لاحقاً) ← نفس الصفحة داخل التطبيق
  App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url); let r = u.hash ? u.hash.replace(/^#\/?/, '') : (u.host + u.pathname).replace(/^\/+/, '');
      if (/^https?:$/.test(u.protocol)) r = u.hash.replace(/^#\/?/, '');
      location.hash = '#/' + r.replace(/^\/+/, '');
    } catch { }
  });
}
