// انسخ هذا الملف باسم config.js وضع فيه بيانات مشروعك (لكل بيئة ملفها الخاص)
// المفتاح العام (Publishable / anon) ليس سراً، والحماية الحقيقية في سياسات RLS.
// ⚠️ لا تضع أبداً مفتاح service_role أو Secret key هنا.
window.BASMA_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_xxxxxxxxxxxxxxxx",
  // رابط الموقع العام. يستخدمه تطبيق الموبايل في QR والمشاركة وروابط البريد (لا يؤثر على الويب)
  PUBLIC_SITE_URL: "https://mohammedabd3003-arch.github.io/DHIQAR_DENTAL/"
};
// اترك القيمتين فارغتين ("") لتشغيل الوضع التجريبي محلياً.
