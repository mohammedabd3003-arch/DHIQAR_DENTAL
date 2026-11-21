// الحالة المشتركة للتطبيق
import { store } from './util.js';
export const FALLBACK = {
  areas: ['الناصرية', 'الشطرة', 'الرفاعي', 'سوق الشيوخ', 'الغراف', 'قلعة سكر', 'الجبايش', 'النصر', 'الدواية', 'البطحاء', 'الفجر', 'الإصلاح', 'سيد دخيل', 'الفهود', 'الطار', 'كرمة بني سعيد', 'العكيكة'],
  specs: ['طب أسنان عام', 'تقويم الأسنان', 'زراعة الأسنان', 'تجميل وتركيبات', 'علاج الجذور', 'أسنان الأطفال', 'جراحة الفم والفكين', 'أمراض اللثة'],
  cats: ['تقويم', 'زراعة', 'تجميل', 'تبييض', 'فينير', 'علاج عصب', 'حشوات', 'تركيبات', 'جراحة', 'أطفال', 'لثة']
};
export const STATUS = { pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض', suspended: 'موقوف' };
export const BSTATUS = { pending: 'بانتظار التأكيد', confirmed: 'مؤكد', rejected: 'مرفوض', cancelled: 'ملغى', completed: 'مكتمل', no_show: 'لم يحضر' };
export const ROLES = { patient: 'مريض', doctor: 'طبيب', moderator: 'مشرف محتوى', admin: 'مدير', super_admin: 'مدير أعلى' };
export const S = {
  api: null, me: null, role: null, docs: [], latest: [], tips: [], at: 0, myLoc: null, unread: 0,
  lists: { ...FALLBACK }, settings: {},
  filt: { q: '', area: '', spec: '', sort: 'top', open: false, verified: false, booking: false },
  tab: {}
};
export const isStaff = () => ['moderator', 'admin', 'super_admin'].includes(S.role);
export const isAdmin = () => ['admin', 'super_admin'].includes(S.role);
export const isSuper = () => S.role === 'super_admin';
// حجوزات هذا الجهاز (للحجز بدون حساب)
export const myTokens = () => store.get('basma_bookings', []);
export function saveToken(t, info) { const l = myTokens().filter(x => x.token !== t); l.unshift({ token: t, ...info }); store.set('basma_bookings', l.slice(0, 30)); }
export async function loadPublic(force) {
  if (!force && Date.now() - S.at < 30000) return;
  [S.docs, S.latest, S.tips] = await Promise.all([S.api.listDoctors(), S.api.latestCases(12), S.api.tips()]);
  S.at = Date.now();
}
