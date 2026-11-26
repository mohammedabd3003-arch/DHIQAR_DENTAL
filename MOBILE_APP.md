# تطبيق الموبايل (Android + iOS) — دليل خطوة بخطوة على Windows

التطبيق هو **نفس الموقع** (v5.1.0) داخل غلاف Capacitor. الموقع على GitHub Pages يبقى يعمل كما هو، وأي ميزة أصلية (المشاركة، حفظ بطاقة QR، زر الرجوع، فتح واتساب) تعمل داخل التطبيق فقط ولها بديل ويب.

> **قبل النشر بالمتاجر:** `appId` في `capacitor.config.json` (حالياً `iq.drur.app`) و`appName` يمكن تغييرهما الآن، لكن **appId لا يتغير بعد أول رفع للمتجر**. إذا غيّرت اسم التطبيق، غيّرهما قبل `npx cap add`.

---

## أولاً: التثبيت (مرة واحدة)
1. **Node.js LTS** من nodejs.org (التثبيت الافتراضي).
2. **Android Studio** من developer.android.com/studio (يتضمن Java وAndroid SDK). افتحه مرة واحدة ودعه يكمل التنزيلات.
3. افتح مجلد المستودع `DHIQAR_DENTAL` في **Command Prompt**:
   GitHub Desktop → Repository → **Open in Command Prompt**.

## ثانياً: إنشاء مشروع أندرويد (مرة واحدة)
```bat
npm install
npm run build:app
npx cap add android
npm run app:setup
npx @capacitor/assets generate --iconBackgroundColor "#06141E" --iconBackgroundColorDark "#06141E" --splashBackgroundColor "#06141E" --splashBackgroundColorDark "#06141E"
npx cap sync android
```
- `build:app` يحتاج إنترنت أول مرة (ينزّل المكتبات والخطوط إلى `.vendor-cache/`).
- إذا قال «config.js غير موجود» أو «فارغ»: تأكد أن `config.js` الحقيقي موجود في المجلد.
- صور الأيقونة وشاشة البداية جاهزة في `resources/` (مولّدة من أيقونة الموقع). عند تغيير الاسم أو الشعار استبدلها بنفس الأسماء والمقاسات (1024 و2732).
- ارفع مجلد `android/` للمستودع عبر GitHub Desktop (مجلد `www/` لا يُرفع، وهذا مقصود).

## ثالثاً: تجربة على هاتفك (APK)
```bat
npm run android
```
يفتح Android Studio ← وصّل الهاتف بكيبل USB (مع تفعيل **USB debugging** من خيارات المطوّر) ← زر ▶ Run.
أو: **Build → Build App Bundle(s) / APK(s) → Build APK(s)** ثم انقل ملف `app-debug.apk` للهاتف.

## رابعاً: نسخة المتجر (AAB موقّع)
1. Android Studio → **Build → Generate Signed App Bundle / APK** → Android App Bundle.
2. **Create new** keystore: احفظ الملف خارج المستودع (مثلاً `Documents\basma-release.jks`)، واكتب كلمتي المرور في مكان آمن.
   ⚠️ **ضياع هذا الملف يعني أنك لا تستطيع تحديث التطبيق.** احتفظ بنسختين. لا ترفعه لـ GitHub أبداً (محظور في `.gitignore`).
3. Release → Finish. الملف في `android\app\release\app-release.aab` ← ارفعه في Google Play Console.
4. قبل كل إصدار جديد: زد `versionCode` (رقم صحيح) و`versionName` في `android/app/build.gradle`.

## كل تحديث لاحق للموقع
```bat
npm run build:app
npx cap sync
```
ثم ابنِ من Android Studio كالعادة.

---

## iOS عبر Codemagic (بلا Mac)
المطلوب: حساب **Apple Developer** (اشتراك سنوي) + حساب **codemagic.io** مربوط بـ GitHub.
1. **developer.apple.com** → Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → Bundle ID: `iq.drur.app`.
2. **appstoreconnect.apple.com** → Apps → **+ New App** → نفس Bundle ID، اللغة العربية.
   انسخ **Apple ID** الرقمي للتطبيق (App Information).
3. App Store Connect → **Users and Access → Integrations → App Store Connect API** → Generate API Key (صلاحية App Manager). احفظ **Issuer ID** و**Key ID** وملف **.p8** (يُنزَّل مرة واحدة فقط).
4. Codemagic → Team settings → **Integrations → Developer Portal → Manage keys** → أضف المفتاح باسم **`BASMA_ASC_KEY`**.
5. Codemagic → التطبيق → **Environment variables** → مجموعة **`basma`** فيها `APP_STORE_APP_ID` = الرقم من الخطوة 2.
6. ملف `codemagic.yaml` موجود في المستودع ← **Start new build** → workflow: *iOS → TestFlight*.
7. بعد النجاح: ثبّت تطبيق **TestFlight** على آيفونك ← جرّب ← من App Store Connect قدّمه للمراجعة.

> مجلد `ios/` يُنشأ تلقائياً داخل Codemagic إن لم يكن موجوداً. أوامر Codemagic تتحدث أحياناً؛ إذا فشلت خطوة أرسل صورة الخطأ.

---

## ماذا تغيّر في الكود (v5.1.0)
| الملف | التغيير | على الويب |
|---|---|---|
| `js/core/native.js` (جديد) | كشف التطبيق، المشاركة، حفظ الصور، الروابط الخارجية، زر الرجوع، روابط فتح التطبيق، شريط الحالة | لا يفعل شيئاً |
| `js/core/util.js` | روابط QR/المشاركة/المتابعة تستخدم الرابط العام داخل التطبيق | نفس السابق |
| `js/services/live.js` | روابط البريد (تفعيل/استعادة) تذهب للموقع العام داخل التطبيق | نفس السابق |
| `js/core/maps.js`, `js/pages/dash.js` | مكتبات محلية داخل التطبيق؛ حفظ/طباعة بطاقة QR عبر قائمة المشاركة | نفس السابق |
| `js/app.js` | لا Service Worker داخل التطبيق؛ تهيئة الطبقة الأصلية | نفس السابق |
| `scripts/build-app.mjs`, `scripts/native-setup.mjs`, `capacitor.config.json`, `codemagic.yaml` | أدوات البناء | — |

**لم يتغير:** Supabase، قاعدة البيانات، أي وظيفة موجودة. اختبارات الويب: 80/80.

## باقٍ قبل التقديم للمتاجر
1. **حذف الحساب من داخل التطبيق** (شرط Apple وGoogle) — يحتاج Edge Function، مرحلة منفصلة.
2. **بريد SMTP خاص** في Supabase (رسائل التفعيل).
3. **مزود خرائط بمفتاح** بدل خوادم OSM العامة.
4. سياسة الخصوصية ونموذج Data safety وحساب تجريبي لمراجعي Apple.
5. (iOS) ملف `PrivacyInfo.xcprivacy`.
