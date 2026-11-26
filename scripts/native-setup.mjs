#!/usr/bin/env node
// يضيف صلاحيات ورسائل الأذونات ورابط التطبيق إلى مشروعي android/ و ios/ بعد `npx cap add`.
// آمن للتكرار: لا يضيف شيئاً موجوداً، ولا يمس أي شيء آخر.
import { readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cap = JSON.parse(await readFile(join(ROOT, 'capacitor.config.json'), 'utf8'));
const SCHEME = cap.appId; // مثل iq.drur.app → iq.drur.app://d/slug
const exists = p => access(p).then(() => true, () => false);
let did = 0;

/* ---------- Android ---------- */
const AM = join(ROOT, 'android/app/src/main/AndroidManifest.xml');
if (await exists(AM)) {
  let x = await readFile(AM, 'utf8'); const o = x;
  for (const p of ['android.permission.INTERNET', 'android.permission.ACCESS_COARSE_LOCATION', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.CAMERA'])
    if (!x.includes(`"${p}"`)) x = x.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
  if (!x.includes('android.hardware.camera"')) x = x.replace('</manifest>', '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
  if (!x.includes('android.hardware.location.gps"')) x = x.replace('</manifest>', '    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\n</manifest>');
  if (!x.includes(`android:scheme="${SCHEME}"`)) {
    const filt = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="${SCHEME}" />\n            </intent-filter>\n`;
    const i = x.indexOf('</activity>'); if (i > 0) x = x.slice(0, i) + filt.trimStart().replace(/^/, '    ') + '        ' + x.slice(i);
  }
  if (x !== o) { await writeFile(AM, x); did++; console.log('✔ AndroidManifest.xml: الصلاحيات ورابط التطبيق'); } else console.log('• AndroidManifest.xml محدّث مسبقاً');
} else console.log('• لا يوجد android/ بعد (نفّذ: npx cap add android)');

/* ---------- iOS ---------- */
const PL = join(ROOT, 'ios/App/App/Info.plist');
if (await exists(PL)) {
  let x = await readFile(PL, 'utf8'); const o = x;
  const add = (k, v) => { if (!x.includes(`<key>${k}</key>`)) x = x.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${k}</key>\n\t${v}\n</dict>\n</plist>\n`); };
  const str = s => `<string>${s}</string>`;
  add('NSCameraUsageDescription', str('لالتقاط صور الحالات وصورتك الشخصية ورفعها إلى صفحتك'));
  add('NSPhotoLibraryUsageDescription', str('لاختيار صور الحالات ومستندات التوثيق من الصور'));
  add('NSPhotoLibraryAddUsageDescription', str('لحفظ بطاقة QR الخاصة بعيادتك في الصور'));
  add('NSLocationWhenInUseUsageDescription', str('لإظهار أقرب عيادات الأسنان إليك وتحديد موقع عيادتك على الخارطة. لا نحفظ موقعك'));
  add('ITSAppUsesNonExemptEncryption', '<false/>');
  add('CFBundleURLTypes', `<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>${SCHEME}</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${SCHEME}</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>`);
  add('CFBundleLocalizations', '<array>\n\t\t<string>ar</string>\n\t</array>');
  x = x.replace(/(<key>CFBundleDevelopmentRegion<\/key>\s*<string>)[^<]*(<\/string>)/, '$1ar$2');
  if (x !== o) { await writeFile(PL, x); did++; console.log('✔ Info.plist: رسائل الأذونات والرابط والعربية'); } else console.log('• Info.plist محدّث مسبقاً');
} else console.log('• لا يوجد ios/ بعد (نفّذ: npx cap add ios)');

console.log(did ? '\nتم. نفّذ الآن: npx cap sync' : '\nلا تغييرات.');
