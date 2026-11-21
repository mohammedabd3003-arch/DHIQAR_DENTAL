// الصور: التحقق من النوع والحجم، الضغط، صورة مصغّرة
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export function checkImage(f, maxMB = 15) {
  if (!f) throw new Error('img');
  if (f.type && !OK_TYPES.includes(f.type)) throw new Error('نوع الملف غير مسموح، اختر صورة JPG أو PNG أو WEBP');
  if (f.size > maxMB * 1048576) throw new Error(`حجم الصورة أكبر من ${maxMB} ميغابايت`);
}
export function checkDoc(f) {
  if (!f) throw new Error('img');
  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) throw new Error('المستندات المسموحة: صور JPG/PNG/WEBP أو PDF');
  if (f.size > 8 * 1048576) throw new Error('حجم المستند أكبر من 8 ميغابايت');
}
function loadImg(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { res(i); }; i.onerror = () => rej(new Error('img')); i.src = u; }); }
export async function compress(file, max, q = .82) {
  checkImage(file);
  const i = await loadImg(file); const s = Math.min(1, max / Math.max(i.naturalWidth, i.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(i.naturalWidth * s)); c.height = Math.max(1, Math.round(i.naturalHeight * s));
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, c.width, c.height);
  URL.revokeObjectURL(i.src);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('img')), 'image/jpeg', q));
}
