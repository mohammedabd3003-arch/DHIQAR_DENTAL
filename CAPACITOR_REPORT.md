# CAPACITOR_REPORT.md — دراسة توافق بسمة ذي قار v5.0.0 مع Capacitor (Android + iOS)

**النطاق:** فحص الكود الحالي فقط. لم يُعدَّل أي ملف، ولم تُمسّ قاعدة البيانات.
**المنهج:** قراءة `index.html` و17 ملف JavaScript و`css/app.css` و`sw.js`، مع البحث عن كل نقطة تتعامل مع المتصفح مباشرة (الروابط، التخزين، الملفات، الموقع، التنزيل، المشاركة).
**تنبيه:** أرقام إصدارات Capacitor ومتطلباته (JDK، Xcode، SDK) تتغير سنوياً؛ القيم أدناه هي ما أعرفه حتى منتصف 2026، ويجب التحقق منها من `capacitorjs.com/docs` يوم البدء.

---

## 1. الخلاصة
| الحكم | التفاصيل |
|---|---|
| **قابل للتحويل** | ✅ المشروع مناسب جداً لـ Capacitor: بلا أداة بناء، ES Modules، Hash Routing، وكل المنطق الحساس في Supabase |
| **عوائق حرجة يجب إصلاحها قبل النشر** | 4: روابط تشير إلى `localhost`، روابط البريد للتفعيل/الاستعادة، تحميل المكتبات من الإنترنت، غياب حذف الحساب داخل التطبيق (شرط المتجرين) |
| **مشاكل متوسطة** | 7: زر الرجوع في أندرويد، تنزيل بطاقة QR والطباعة، المشاركة، Service Worker، حواف الشاشة في Android 15، خرائط OSM، الخطوط |
| **حجم العمل التقديري** | طبقة توافق واحدة (`js/core/native.js`) + تعديلات صغيرة في 6 ملفات + إعداد المشروع الأصلي. **صفر تغيير** في Supabase |
| **الويب الحالي** | يبقى يعمل كما هو على GitHub Pages؛ كل إضافة أصلية تعمل فقط داخل التطبيق ولها بديل ويب |

---

## 2. تقرير التوافق بنداً بنداً

### 2.1 index.html وJavaScript وCSS — ✅ متوافق مع تعديلات
| النقطة | الوضع | الأثر في التطبيق |
|---|---|---|
| ES Modules بلا بناء | ✅ | يعمل مباشرة: Capacitor يخدم الملفات محلياً من `https://localhost` (أندرويد) و`capacitor://localhost` (iOS) |
| `config.js` منفصل | ✅ | يُنسخ مع التطبيق؛ يجب أن تحتوي نسخة التطبيق على إعدادات الإنتاج دائماً (وإلا يدخل الوضع التجريبي) |
| تحميل كسول `import()` لصفحتي الطبيب والإدارة | ✅ | يعمل |
| تصميم RTL، `env(safe-area-inset-*)`, `viewport-fit=cover` | ✅ جزئياً | يعمل على iOS. على **Android 15 (targetSdk 35)** يفرض النظام العرض حتى الحواف، وWebView قد لا يعطي قيم `safe-area` ← الشريط العلوي يدخل تحت شريط الحالة. **يحتاج إعداد Status Bar** (القسم 4) |
| `backdrop-filter`, `:has`, `light-dark` | ⚠️ | WebView أندرويد يتحدث عبر Play Store (Chrome)، لكن أجهزة قديمة قد لا تدعم `color-mix` و`light-dark`. الحد الأدنى المقترح Android 7 (API 24) مع WebView حديث |
| خطوط Google | ⚠️ | تُحمَّل من الإنترنت؛ بلا اتصال يسقط الخط إلى الافتراضي. **يجب تضمين الخطين محلياً** (رخصة OFL تسمح) |

### 2.2 Hash Routing — ✅ مثالي
- `#/d/…`, `#/b/…`, `#/dash/…` لا تحتاج خادماً، وهي أفضل خيار داخل WebView.
- `history.replaceState` و`hashchange` يعملان.
- **ناقص:** ربط زر الرجوع في أندرويد بالسجل (القسم 3، المشكلة 5).

### 2.3 Supabase Authentication والجلسات — ⚠️ يعمل مع إصلاح حرج
| النقطة | الوضع |
|---|---|
| تسجيل الدخول بالبريد وكلمة المرور | ✅ يعمل (طلبات HTTPS عادية، وSupabase يسمح بأي Origin) |
| حفظ الجلسة في `localStorage` | ✅ تبقى بين مرات الفتح. على iOS قد يمسح النظام بيانات WKWebView عند امتلاء التخزين ← **مقترح:** محوّل تخزين عبر `@capacitor/preferences` لجلسة Supabase فقط |
| **رابط تفعيل البريد واستعادة كلمة المرور** | 🔴 `live.js:13` يبني `emailRedirectTo` من `location.origin` ← داخل التطبيق يصبح `https://localhost` فيفتح المستخدم الرابط من بريده ولا يصل لأي مكان |
| `detectSessionInUrl` | يحتاج استقبال الرابط عبر Deep Link وتمريره لـ Supabase |
| CAPTCHA مستقبلاً (Turnstile) | يعمل داخل WebView |

**الإصلاح:** في التطبيق تُرسل روابط البريد إلى نطاق الويب العام (GitHub Pages) أو إلى مخطط خاص `iq.basmadhiqar.app://auth`، ويُضاف هذا العنوان إلى *Redirect URLs* في Supabase (إعداد لوحة فقط، لا تغيير في القاعدة).

### 2.4 رفع الصور والكاميرا — ✅ يعمل مع إضافات صلاحيات
| النقطة | Android | iOS |
|---|---|---|
| `<input type=file accept=image/*>` | ✅ Capacitor يعالج اختيار الملفات (منتقي الصور في Android 13+) | ✅ قائمة أصلية: الكاميرا / الصور / الملفات |
| الالتقاط من الكاميرا عبر نفس الحقل | يحتاج صلاحية `CAMERA` | يحتاج `NSCameraUsageDescription` وإلا **يتوقف التطبيق** |
| اختيار صور متعددة/PDF للتوثيق | ✅ | ✅ |
| ضغط الصور بـ Canvas (`media.js`) | ✅ | ✅ (iOS يحوّل HEIC إلى JPEG تلقائياً) |
| صور HEIC على أندرويد | ⚠️ نادرة؛ WebView لا يفك HEIC ← رسالة «تعذّر قراءة الصورة» الحالية تكفي | — |
| السحب والإفلات (`drop`) | غير متاح باللمس، لكن الضغط يعمل (لا تغيير) | نفس الشيء |
| **إضافة مقترحة** | `@capacitor/camera` اختيارية لتجربة أنظف (قص، جودة) — ليست ضرورية للإطلاق الأول |

### 2.5 Leaflet والخرائط والموقع — ⚠️
| النقطة | الوضع |
|---|---|
| Leaflet من cdnjs | 🔴 يحتاج إنترنت، ويُعد تحميل شيفرة تنفيذية عن بُعد (تفضّل Apple تضمينها). **يجب تضمينه محلياً** |
| `navigator.geolocation` في Android WebView | ⚠️ يعمل فقط إذا وُجدت صلاحيات `ACCESS_COARSE/FINE_LOCATION` في Manifest (Capacitor يطلب الإذن تلقائياً) |
| iOS | 🔴 بدون `NSLocationWhenInUseUsageDescription` يُرفض الطلب أو يُرفض التطبيق في المراجعة |
| **خوادم OSM العامة** | 🔴 سياسة OSM تتطلب `Referer` صالحاً وتمنع الاستخدام التجاري الكثيف؛ طلبات التطبيق تأتي من `localhost` وقد تُحجب. **للمتاجر: مزود خرائط بمفتاح** (MapTiler / Stadia / Thunderforest) — تغيير سطر واحد في `maps.js` + CSP |
| الاتجاهات (`google.com/maps/dir`) | ✅ تفتح تطبيق الخرائط إذا فُتحت خارج WebView (القسم 2.8) |
| **إضافة مقترحة** | `@capacitor/geolocation` بدقة أصلية ورسائل إذن أوضح، مع بقاء `navigator.geolocation` للويب |

### 2.6 QR Code — ⚠️ التوليد يعمل، الرابط والتنزيل لا
| النقطة | الوضع |
|---|---|
| مكتبة qrcodejs من cdnjs | 🔴 تضمين محلي |
| **محتوى الكود** | 🔴 `pageUrl()` في `util.js:49-50` يبني الرابط من `location.origin` ← داخل التطبيق يصبح `https://localhost/#/d/…` **وبطاقات الأطباء المطبوعة لن تعمل**. نفس المشكلة في «نسخ رابط المتابعة» (`booking.js:44`) و«مشاركة النتائج» (`home.js:56`) |
| تنزيل PNG بـ `<a download>` | 🔴 لا يعمل في WebView (لا مدير تنزيلات) |
| `window.print()` | 🔴 لا يعمل في Android WebView ولا WKWebView |
| **الإصلاح** | `PUBLIC_SITE_URL` في `config.js` يُستخدم لكل الروابط العامة + `@capacitor/filesystem` و`@capacitor/share` لحفظ/مشاركة البطاقة بدل التنزيل والطباعة |

### 2.7 Service Worker وPWA — ⚠️ يجب تعطيله داخل التطبيق
- `app.js:75` يسجّل SW إذا كان البروتوكول `https:` ← **سيسجَّل على أندرويد** (`https://localhost`) ويخزّن الملفات فوق الملفات المضمّنة؛ بعد تحديث التطبيق من المتجر قد يعرض SW النسخة القديمة، وتظهر رسالة «نسخة جديدة جاهزة» بلا معنى.
- على iOS (`capacitor://`) لا يعمل SW أصلاً.
- **الإصلاح:** لا تسجيل SW إذا كان `Capacitor.isNativePlatform()`؛ التحديثات تأتي من المتجر. `manifest.webmanifest` و`offline.html` تبقى للويب فقط.
- العمل دون اتصال داخل التطبيق: الواجهة مضمّنة فتفتح دائماً؛ البيانات تحتاج اتصالاً (شريط «غير متصل» الحالي يكفي، ويمكن تحسينه بـ `@capacitor/network`).

### 2.8 الروابط الخارجية وDeep Links — ⚠️
| الرابط | الوضع المتوقع | المطلوب |
|---|---|---|
| `tel:` | Capacitor يمررها للنظام | اختبار على الجهاز |
| `wa.me` (واتساب) | يجب أن تخرج من WebView ليفتح تطبيق واتساب | فتح عبر `@capacitor/app-launcher` أو `@capacitor/browser` بدل `target=_blank` داخل التطبيق |
| خرائط Google، روابط الصور الكاملة | نفس الشيء | نفس الشيء |
| `navigator.share` | ❌ غير مدعوم في Android WebView (الكود يرجع للنسخ — لا يتعطل) | `@capacitor/share` |
| `navigator.clipboard` | ✅ غالباً (سياق آمن) | لا شيء |
| **Deep Links: فتح رابط طبيب من واتساب داخل التطبيق** | غير موجود | `@capacitor/app` → حدث `appUrlOpen` ← تحويل الرابط إلى `location.hash` |
| Android App Links / iOS Universal Links (روابط https تفتح التطبيق) | 🔴 تتطلب ملفي `/.well-known/assetlinks.json` و`apple-app-site-association` **في جذر النطاق**. على `mohammedabd3003-arch.github.io/DHIQAR_DENTAL` الجذر ليس لك | **نطاق خاص** (مثل `basma-dhiqar.com`) — وإلى حينه: مخطط خاص `iq.basmadhiqar.app://` |

### 2.9 سياسة CSP — ✅ تعمل مع تبسيط
- `'self'` يطابق `https://localhost` و`capacitor://localhost`، و`connect-src https://*.supabase.co` صحيح.
- جسر Capacitor يُحقن أصلياً ولا تمنعه CSP.
- بعد تضمين المكتبات والخطوط محلياً تصبح `script-src 'self'` فقط (أقوى أماناً).
- عند تغيير مزود الخرائط: يُضاف نطاقه إلى `img-src`.

### 2.10 التخزين المؤقت — ✅ مع ملاحظات
| المفتاح | داخل التطبيق |
|---|---|
| `basma_theme`, `basma_recent`, `basma_patient`, `basma_bookings`, `basma_sk` | ✅ تبقى. **انتبه:** `basma_bookings` (روابط المتابعة) هو الطريق الوحيد لمريض بلا حساب لإيجاد حجزه؛ مسح بيانات التطبيق يفقده إياها — يكفي تنبيه في صفحة «حجوزاتي» |
| جلسة Supabase | ✅ مع توصية `Preferences` على iOS |
| `?v=5.0.0` في الروابط | بلا أثر داخل التطبيق (لا كاش متصفح بين الإصدارات) |
| الصور من Supabase Storage | كاش WebView العادي — مناسب |

---

## 3. المشاكل المتوقعة داخل التطبيق (مرتبة)
| # | المشكلة | الخطورة | الحل |
|---|---|---|---|
| 1 | روابط عامة (QR، المشاركة، متابعة الحجز) تشير إلى `localhost` | 🔴 | `PUBLIC_SITE_URL` |
| 2 | روابط البريد (التفعيل، الاستعادة) لا تعود للتطبيق | 🔴 | Redirect إلى الويب أو مخطط خاص + `appUrlOpen` |
| 3 | المكتبات والخطوط من الإنترنت (بطء، فشل دون اتصال، ملاحظة Apple 2.5.2) | 🔴 | مجلد `vendor/` محلي |
| 4 | **لا يوجد حذف حساب داخل التطبيق** — شرط Apple (5.1.1(v)) وGoogle Play لأي تطبيق ينشئ حسابات | 🔴 مانع للنشر | زر «حذف حسابي» + **Supabase Edge Function** تحذف المستخدم (لا تغيير في الجداول، فالحذف متتالٍ أصلاً) — هذه الوحيدة التي تحتاج شيئاً في Supabase، وهي دالة منفصلة لا تمس القاعدة |
| 5 | زر الرجوع في أندرويد يغلق التطبيق بدل الرجوع للصفحة السابقة أو إغلاق النافذة | 🟠 | `@capacitor/app` backButton: أغلق النافذة ← ارجع في السجل ← اخرج |
| 6 | تنزيل بطاقة QR والطباعة لا يعملان | 🟠 | Filesystem + Share |
| 7 | Service Worker يعرض نسخة قديمة بعد تحديث المتجر (أندرويد) | 🟠 | تعطيله في التطبيق |
| 8 | الشريط العلوي تحت شريط الحالة (Android 15 edge-to-edge) | 🟠 | `@capacitor/status-bar` / إعدادات الحواف |
| 9 | خرائط OSM قد تُحجب أو تخالف سياستهم | 🟠 | مزود بمفتاح |
| 10 | روابط واتساب والخرائط تفتح داخل WebView بلا زر رجوع | 🟠 | فتح خارجي |
| 11 | لوحة المفاتيح تغطي حقول النوافذ السفلية (الحجز) | 🟡 | `@capacitor/keyboard` resize: `body` |
| 12 | **رفض Apple لتطبيق «موقع مغلّف» (4.2)** | 🟡 | الميزات الأصلية: الموقع، الكاميرا، المشاركة، Deep Links، وإشعارات Push لاحقاً تكفي عادة |
| 13 | الوضع التجريبي إذا نُسي `config.js` في البناء | 🟡 | فحص في سكربت البناء يرفض البناء بلا إعدادات |

---

## 4. الإضافات المطلوبة
| الإضافة | الغرض | ضرورية للإطلاق؟ |
|---|---|---|
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios` | الأساس | ✅ |
| `@capacitor/app` | زر الرجوع، Deep Links، حالة التطبيق | ✅ |
| `@capacitor/status-bar` | لون شريط الحالة، الحواف | ✅ |
| `@capacitor/splash-screen` | شاشة البداية | ✅ |
| `@capacitor/share` | مشاركة صفحة الطبيب وبطاقة QR | ✅ |
| `@capacitor/filesystem` | حفظ بطاقة QR | ✅ |
| `@capacitor/browser` أو `@capacitor/app-launcher` | واتساب، الخرائط، الروابط الخارجية | ✅ |
| `@capacitor/preferences` | تخزين جلسة Supabase بثبات | ✅ (iOS) |
| `@capacitor/keyboard` | سلوك لوحة المفاتيح | مستحسن |
| `@capacitor/geolocation` | موقع بدقة أصلية | مستحسن |
| `@capacitor/network` | حالة الاتصال | مستحسن |
| `@capacitor/camera` | كاميرا أصلية | لاحقاً |
| `@capacitor/push-notifications` + Firebase (FCM) + APNs | إشعارات فورية | لاحقاً (يقوي قبول Apple) |
| `@capacitor/assets` (أداة) | توليد الأيقونات وشاشات البداية من صورة 1024 | ✅ |

---

## 5. بنية Capacitor المقترحة (داخل نفس المستودع، بلا مشروع جديد)
```
DHIQAR_DENTAL/
├─ index.html, css/, js/, icons…        ← الويب كما هو (GitHub Pages يبقى يعمل)
├─ js/core/native.js                     ← جديد: طبقة توافق واحدة
│     isNative · openExternal · shareUrl · saveImage · getPosition
│     backButton · deepLinks · statusBar · publicUrl()
├─ js/vendor/                            ← جديد: supabase-js، leaflet، qrcodejs، الخطوط
├─ capacitor.config.json                 ← جديد
├─ scripts/build-app.mjs                 ← جديد: ينسخ ملفات الويب إلى www/ ويرفض البناء بلا config
├─ www/                                  ← ناتج البناء (في .gitignore)
├─ resources/icon.png (1024) · splash.png (2732)
├─ android/                              ← يُنشأ بـ npx cap add android (يُرفع للمستودع)
├─ ios/                                  ← يُنشأ بـ npx cap add ios (يُرفع للمستودع)
└─ codemagic.yaml                        ← جديد: بناء iOS في السحابة
```
**قاعدة طبقة التوافق:** كل دالة فيها `if (isNative) { إضافة أصلية } else { سلوك الويب الحالي }`، فلا تتغير تجربة الويب ولا تُفقد أي وظيفة.

`capacitor.config.json` المقترح:
```json
{
  "appId": "iq.basmadhiqar.app",
  "appName": "بسمة ذي قار",
  "webDir": "www",
  "server": { "androidScheme": "https" },
  "plugins": {
    "SplashScreen": { "launchShowDuration": 1200, "backgroundColor": "#06141E", "showSpinner": false },
    "StatusBar": { "style": "DARK", "backgroundColor": "#06141E", "overlaysWebView": false },
    "Keyboard": { "resize": "body" }
  }
}
```
> `appId` لا يتغير بعد النشر أبداً. إن امتلكت نطاقاً لاحقاً فاستخدم عكسه (مثل `com.basmadhiqar.app`) من الآن.

---

## 6. إعدادات Android
| البند | القيمة |
|---|---|
| `minSdkVersion` / `targetSdkVersion` | حسب إصدار Capacitor المعتمد (Capacitor 7: 23 / 35). Google Play يشترط آخر target سنوياً |
| الصلاحيات (`AndroidManifest.xml`) | `INTERNET` (افتراضية)، `ACCESS_COARSE_LOCATION`، `ACCESS_FINE_LOCATION`، `CAMERA`. **لا** `READ_EXTERNAL_STORAGE` (منتقي الصور الحديث لا يحتاجها) |
| Deep Link (مخطط خاص) | `intent-filter` بـ `<data android:scheme="iq.basmadhiqar.app" />` |
| App Links (لاحقاً مع النطاق) | `android:autoVerify="true"` + `assetlinks.json` على النطاق |
| الاسم والاتجاه | `android:supportsRtl="true"` (افتراضي)، اسم التطبيق بالعربية في `strings.xml` |
| الأيقونات | Adaptive icon من `icon-maskable` الحالية عبر `@capacitor/assets` |
| التوقيع | `keytool -genkey -v -keystore basma-release.jks -alias basma -keyalg RSA -keysize 2048 -validity 10000` — **احفظ الملف وكلمتيه في مكانين آمنين؛ ضياعه يمنع تحديث التطبيق** (مع Play App Signing يمكن استعادة مفتاح الرفع فقط) |
| Google Play Console | حساب مطوّر (رسوم لمرة واحدة)، سياسة الخصوصية (`privacy.html` موجودة)، نموذج **Data safety** (الموقع: لا يُجمع؛ الاسم/الهاتف: لإدارة الحجز؛ الصور: يرفعها الطبيب)، تصنيف المحتوى، رابط حذف الحساب |

## 7. إعدادات iOS
| البند | القيمة |
|---|---|
| Bundle ID | `iq.basmadhiqar.app` (نفس appId) |
| الحد الأدنى | حسب Capacitor المعتمد (Capacitor 7: iOS 14) |
| `Info.plist` — إلزامية | `NSCameraUsageDescription` «لالتقاط صور الحالات وصورتك الشخصية» · `NSPhotoLibraryUsageDescription` «لاختيار صور الحالات والمستندات» · `NSPhotoLibraryAddUsageDescription` «لحفظ بطاقة QR الخاصة بعيادتك» · `NSLocationWhenInUseUsageDescription` «لإظهار أقرب العيادات إليك، ولا يُحفظ موقعك» |
| اللغة | `CFBundleDevelopmentRegion = ar`، `CFBundleLocalizations = [ar]` |
| Deep Link | `CFBundleURLTypes` بالمخطط `iq.basmadhiqar.app` |
| Universal Links (لاحقاً) | Associated Domains: `applinks:basma-dhiqar.com` + ملف AASA |
| التشفير | `ITSAppUsesNonExemptEncryption = false` (HTTPS فقط) |
| Privacy Manifest | `PrivacyInfo.xcprivacy` يصرّح باستخدام `UserDefaults` (عبر Preferences) وأنواع البيانات |
| App Store Connect | حساب Apple Developer (اشتراك سنوي)، **حساب تجريبي لمراجعي Apple** (طبيب مقبول + مدير)، رابط الدعم والخصوصية، بطاقات الخصوصية، حذف الحساب داخل التطبيق |

---

## 8. بناء Android APK / AAB (على Windows)
**المتطلبات:** Node.js LTS، Android Studio (يتضمن JDK وSDK)، Git.
```bash
# مرة واحدة
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios \
  @capacitor/app @capacitor/status-bar @capacitor/splash-screen @capacitor/share \
  @capacitor/filesystem @capacitor/browser @capacitor/preferences @capacitor/keyboard
npm install -D @capacitor/assets
npm run build:app            # ينسخ الويب إلى www/ ويتحقق من config.js
npx cap add android
npx @capacitor/assets generate --iconBackgroundColor "#06141E" --splashBackgroundColor "#06141E"

# كل إصدار
npm run build:app && npx cap sync android
npx cap open android         # Android Studio → Build → Generate Signed Bundle / APK
# أو من سطر الأوامر:
cd android && gradlew.bat bundleRelease      # AAB للمتجر:  android/app/build/outputs/bundle/release/
cd android && gradlew.bat assembleRelease    # APK للتجربة: android/app/build/outputs/apk/release/
```
- **AAB** لمتجر Google Play (إلزامي). **APK** للتجربة المباشرة على الهواتف.
- رفع `versionCode` (رقم صحيح يزيد كل إصدار) و`versionName` (5.0.0) في `android/app/build.gradle`.
- المسار المقترح: Internal testing ← Closed testing (حسابات المطوّرين الجديدة يُطلب منها اختبار مغلق بعدد من المختبرين لفترة قبل الإنتاج — تحقق من الشرط الحالي في Play Console) ← Production.

## 9. بناء iOS عبر Codemagic من Windows (بلا Mac)
**المتطلبات:** حساب Apple Developer، حساب Codemagic (فيه دقائق مجانية لأجهزة macOS)، المستودع على GitHub.

**الخطوات:**
1. **developer.apple.com** → Identifiers → أنشئ App ID بـ `iq.basmadhiqar.app`.
2. **App Store Connect** → Apps → New App بنفس Bundle ID.
3. App Store Connect → Users and Access → Integrations → **App Store Connect API** → أنشئ مفتاحاً (Admin أو App Manager) واحفظ: Issuer ID، Key ID، ملف `.p8` (يُنزَّل مرة واحدة).
4. على Windows: `npx cap add ios` ثم ارفع مجلد `ios/` للمستودع (لا يحتاج Mac لإنشائه).
5. **Codemagic** → Add application → اختر المستودع → Teams → Integrations → App Store Connect → الصق المفتاح.
6. أضف `codemagic.yaml` في جذر المستودع:
```yaml
workflows:
  ios-release:
    name: iOS → TestFlight
    max_build_duration: 60
    instance_type: mac_mini_m2
    integrations:
      app_store_connect: BASMA_ASC_KEY          # اسم المفتاح في Codemagic
    environment:
      ios_signing:
        distribution_type: app_store
        bundle_identifier: iq.basmadhiqar.app   # توقيع تلقائي
      node: lts
      xcode: latest
    scripts:
      - name: Install
        script: npm ci
      - name: Build web
        script: npm run build:app
      - name: Sync iOS
        script: npx cap sync ios
      - name: Signing profiles
        script: xcode-project use-profiles
      - name: Build number
        script: |
          cd ios/App
          agvtool new-version -all $(($(app-store-connect get-latest-testflight-build-number "$APP_ID") + 1))
      - name: Build IPA
        script: xcode-project build-ipa --workspace ios/App/App.xcworkspace --scheme App
    artifacts:
      - build/ios/ipa/*.ipa
    publishing:
      app_store_connect:
        auth: integration
        submit_to_testflight: true
```
> `APP_ID` = المعرّف الرقمي للتطبيق في App Store Connect (متغير بيئة في Codemagic). تفاصيل الأوامر تتغير أحياناً؛ راجع وثائق Codemagic الخاصة بـ Capacitor عند الإعداد.

7. Start new build → بعد النجاح يصل البناء إلى **TestFlight** ← ثبّته على آيفونك من تطبيق TestFlight واختبره ← قدّمه للمراجعة من App Store Connect.

---

## 10. خطة التنفيذ المقترحة (بعد موافقتك)
| المرحلة | العمل | يمس Supabase؟ |
|---|---|---|
| 1 | `PUBLIC_SITE_URL`، تضمين المكتبات والخطوط محلياً، تعطيل SW في التطبيق، `native.js` بسلوك ويب مطابق — **يُختبر على الويب أولاً بالاختبارات الـ80** | لا |
| 2 | إعداد Capacitor، `build-app.mjs`، Android، الأيقونات، زر الرجوع، الروابط الخارجية، المشاركة وحفظ QR، Deep Link | لا (إضافة Redirect URL في إعدادات Auth فقط) |
| 3 | زر «حذف حسابي» + Edge Function للحذف | دالة Edge فقط، بلا تغيير جداول |
| 4 | iOS: Info.plist، Privacy Manifest، Codemagic، TestFlight | لا |
| 5 | مزود خرائط بمفتاح، ثم نطاق خاص للروابط العامة وApp/Universal Links | لا |
| لاحقاً | إشعارات Push | جدول اشتراكات أجهزة (هجرة منفصلة بموافقتك) |

**ما أحتاجه منك قبل البدء:**
1. اعتماد `appId` نهائياً (`iq.basmadhiqar.app` أو غيره) — لا يتغير بعد النشر.
2. هل تملك أو ستشتري نطاقاً خاصاً؟ (يحدد طريقة الروابط العامة وDeep Links)
3. هل عندك حساب Google Play Console وApple Developer، أم نبدأ بـ APK للتجربة فقط؟
