# EXTERNAL_SERVICES.md — ما يحتاج خدمات أو إعدادات خارجية

لا شيء من هذه القائمة مفعّل أو مزعوم في الكود. كل بند يحدد المطلوب بدقة.

| الميزة | الحالة الآن | المطلوب منك | ملاحظات |
|---|---|---|---|
| إشعارات داخل المنصة | ✅ تعمل | — | |
| رسائل البريد للتفعيل واستعادة كلمة المرور | ✅ عبر Supabase | ضبط Site URL و Redirect URLs | مزود Supabase المجاني محدود العدد؛ للإنتاج: Authentication → SMTP Settings بمزود مثل Resend/Brevo (نطاق + مفتاح) |
| إشعارات البريد للحجوزات | ❌ غير مفعّلة | مزود SMTP + Supabase Edge Function + Database Webhook على جدول `notifications` | البنية جاهزة: كل إشعار يُسجَّل في `notifications` |
| Push Notifications | ❌ | مفاتيح VAPID + Edge Function للإرسال + اشتراكات المتصفح | iOS يدعمها فقط للتطبيق المثبّت |
| WhatsApp Business API | ❌ | حساب Meta Business موثّق + رقم + قوالب رسائل معتمدة + مزود (Meta Cloud API أو 360dialog) | زر واتساب الحالي رابط `wa.me` مجاني ولا يحتاج شيئاً |
| الدفع والاشتراكات | ❌ بنية فقط | اختيار مزود متاح في العراق بعقد تجاري: **ZainCash** أو **FIB (First Iraqi Bank)** أو **Qi Card / Super Qi** أو بوابة بطاقات عبر بنك محلي. يلزم: حساب تاجر، مفاتيح API، رابط Webhook | يجب أن يتم التحقق من الدفع في Edge Function بمفتاح سري، لا في المتصفح. التوثيق المهني لا يرتبط بالدفع أبداً |
| الخرائط للاستخدام التجاري | ⚠️ خوادم OSM العامة | عند النمو: مفتاح من MapTiler أو Stadia Maps أو Thunderforest وتغيير سطر `tileLayer` في `js/core/maps.js` وإضافة النطاق إلى CSP في `index.html` | سياسة OSM تمنع الاستخدام الكثيف على خوادمهم العامة |
| صفحات Google (SEO) | ✅ جاهز | 3 أسرار في GitHub (README) + Google Search Console | |
| CAPTCHA | ❌ | Cloudflare Turnstile: مفتاح الموقع والسري → Supabase Auth → Bot protection | |
| نطاق خاص (basma-dhiqar.com) | ❌ | شراء النطاق + سجلات DNS (A/CNAME لـ GitHub Pages) + ملف `CNAME` في المستودع + تحديث Site URL في Supabase و`SITE_URL` | بعدها غيّر مسار الرجوع في `404.html` |
| مراقبة الأخطاء | ❌ | حساب Sentry (مجاني) + DSN + إضافة النطاق إلى CSP | اختياري |
| النسخ الاحتياطي التلقائي | ❌ في الخطة المجانية | Supabase Pro | راجع BACKUP.md |
