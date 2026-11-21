# بسمة ذي قار — منصة أطباء الأسنان · الإصدار 5.0.0

منصة عربية لأطباء الأسنان في محافظة ذي قار: دليل وبحث، خارطة، حالات قبل/بعد، **حجز داخلي**، **تقييمات موثقة**، **توثيق مهني**، **إشعارات**، ولوحات للطبيب والإدارة بأدوار متعددة.

| الوثيقة | المحتوى |
|---|---|
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | فحص النسخة السابقة والمشكلات المكتشفة |
| [ARCHITECTURE.md](ARCHITECTURE.md) | البنية، قاعدة البيانات، القرارات التقنية، خارطة الطريق |
| [SECURITY_REPORT.md](SECURITY_REPORT.md) | المراجعة الأمنية وما عولج |
| [TEST_REPORT.md](TEST_REPORT.md) | نتائج الاختبارات الفعلية وما لم يُختبر |
| [BACKUP.md](BACKUP.md) | النسخ الاحتياطي والاسترجاع وخطة التراجع |
| [CHANGELOG.md](CHANGELOG.md) | سجل الميزات المنفذة |
| [EXTERNAL_SERVICES.md](EXTERNAL_SERVICES.md) | ما يحتاج خدمات أو إعدادات خارجية |
| [KNOWN_ISSUES.md](KNOWN_ISSUES.md) | المشكلات والحدود المتبقية |

---

## الترقية من الإصدار 4 (موقعك الحالي) — بالترتيب

> ⚠️ **الترتيب مهم**: الواجهة الجديدة تحتاج قاعدة البيانات المحدّثة.

1. **نسخة احتياطية** من قاعدة البيانات (راجع [BACKUP.md](BACKUP.md)، الخطوة 1). لا تتجاوزها.
2. **Supabase → SQL Editor → New query**: الصق `supabase/migrations/003_platform.sql` كاملاً ← **Run**.
   - سيظهر تحذير «destructive operations» بسبب `drop policy if exists`: هذه تستبدل سياسات الصلاحيات فقط، ولا تحذف بيانات.
   - النتيجة المتوقعة: `Success. No rows returned`.
   - حسابك (المدير) يصبح تلقائياً **المدير الأعلى (super_admin)**.
3. **ملفات الموقع**: انسخ كل محتويات هذا المجلد إلى مجلد `DHIQAR_DENTAL` **ما عدا** أن تحتفظ بملفك `config.js` الحالي (لا يوجد config.js في الحزمة كي لا يُستبدل مفتاحك).
   - احذف من المستودع الملف القديم `migration.sql` إن وُجد (غير مستخدم).
4. **GitHub Desktop** ← Commit ← Push origin.
5. افتح الموقع بنافذة خاصة، وستظهر رسالة «نسخة جديدة جاهزة — تحديث» للمستخدمين الذين ثبّتوا التطبيق.

### تفعيل صفحات Google (اختياري، مرة واحدة)
1. في GitHub: **Settings → Secrets and variables → Actions → New repository secret**، وأضف:
   - `SUPABASE_URL` = رابط مشروعك
   - `SUPABASE_ANON_KEY` = المفتاح العام (Publishable)
   - `SITE_URL` = `https://mohammedabd3003-arch.github.io/DHIQAR_DENTAL`
2. **Actions → Build SEO pages → Run workflow**. بعدها يعمل يومياً تلقائياً.
3. قبل كل Commit من GitHub Desktop اضغط **Fetch origin / Pull** لأن الروبوت يرفع صفحات جديدة.
4. أضف الموقع إلى [Google Search Console](https://search.google.com/search-console) وأرسل `sitemap.xml`.

---

## التثبيت من الصفر (بيئة جديدة)
1. أنشئ مشروع Supabase.
2. شغّل في SQL Editor بالترتيب: `001_initial.sql` ← `002_location_license.sql` ← `003_platform.sql`.
3. **Authentication → URL Configuration**: ضع رابط الموقع في Site URL و Redirect URLs.
4. انسخ `config.example.js` إلى `config.js` وضع الرابط والمفتاح العام.
5. ارفع الملفات إلى GitHub Pages (Branch: main، المجلد: root).
6. سجّل حساباً من الموقع، ثم في SQL Editor:
   ```sql
   update public.profiles set role = 'super_admin'
   where id = (select id from auth.users where email = 'YOUR@EMAIL');
   ```

## البيئات
| البيئة | الإعداد |
|---|---|
| التطوير | بدون `config.js` (أو بقيم فارغة) ← الوضع التجريبي ببيانات وهمية محلية وشريط تحذير ظاهر. `npm run serve` ثم `http://localhost:8765` |
| التجريب (Staging) | مشروع Supabase ثانٍ + مستودع/فرع ثانٍ بملف `config.js` خاص به. لا تستخدم قاعدة الإنتاج للتجربة |
| الإنتاج | مشروعك الحالي. لا يعمل الوضع التجريبي فيه أبداً: إذا فشل الاتصال تظهر رسالة «أعد المحاولة» بدل بيانات وهمية |

## هيكل المشروع
```
index.html            الهيكل + سياسة أمان المحتوى (CSP)
config.js             رابط Supabase والمفتاح العام (لكل بيئة ملفها)
css/app.css           التصميم (داكن/فاتح، RTL، موبايل أولاً)
js/app.js             البداية، التوجيه، الإشعارات، السمة، تحديث التطبيق
js/core/              أدوات، رسوم، خرائط، صور، الحالة
js/services/live.js   الاتصال بـ Supabase
js/services/demo.js   الوضع التجريبي (للتطوير فقط)
js/pages/             الرئيسية، الخارطة، الطبيب، الحجز، الدخول، لوحة الطبيب، الإدارة
supabase/migrations/  هجرات SQL مع ملف تراجع
supabase/tests/       اختبارات الصلاحيات (93 اختباراً)
scripts/build-seo.mjs مولّد صفحات Google
tests/e2e/            اختبارات المتصفح (80 اختباراً)
```

## الأوامر
```bash
npm run serve      # تشغيل محلي
npm run check      # فحص صياغة كل ملفات JS
npm run test:db    # اختبارات قاعدة البيانات (يحتاج PostgreSQL 15+ محلي)
npm run test:e2e   # اختبارات المتصفح (يحتاج Python + Playwright + خادم محلي)
npm run seo:test   # تجربة مولّد SEO ببيانات وهمية
```

## الأدوار
| الدور | الصلاحيات |
|---|---|
| مريض `patient` | الحجز ومتابعته، التقييم بعد موعد مكتمل |
| طبيب `doctor` | صفحته، حالاته، مواعيده، طلب التوثيق، إحصائياته |
| مشرف `moderator` | إخفاء/حذف الحالات، إخفاء التقييمات، البلاغات |
| مدير `admin` | + قبول/رفض/إيقاف الأطباء، التوثيق، التمييز، النصائح، القوائم، الإعدادات، السجل |
| مدير أعلى `super_admin` | + تغيير الأدوار، حذف الأطباء، الخطط |

كل الصلاحيات مفروضة في قاعدة البيانات (RLS + Triggers + دوال)، وإخفاء الأزرار في الواجهة للتنظيم فقط.
