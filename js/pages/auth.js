// الدخول والتسجيل واستعادة كلمة المرور
import { $, $$, toast, errMsg, setApp, setMeta, wrapMsg } from '../core/util.js';
import { S } from '../core/state.js';

export function pageLogin(params, refreshUser) {
  if (S.me) { location.hash = S.role === 'patient' ? '#/my' : '#/dash'; return; }
  setMeta('دخول');
  let mode = params.get('m') === 'up' ? 'up' : 'in';
  const draw = () => {
    setApp(`<section class="band"><div class="wrap auth"><h1 style="font-size:28px;margin-bottom:6px">${mode === 'in' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h1>
      <p style="color:var(--muted);margin:0 0 18px">${mode === 'in' ? 'للأطباء والمرضى والإدارة.' : 'حساب واحد للمريض والطبيب. بعد التسجيل يمكنك إنشاء صفحة طبيب تظهر بعد موافقة الإدارة.'}</p>
      <div class="seg" role="tablist"><button data-m="in" role="tab" class="${mode === 'in' ? 'on' : ''}">تسجيل الدخول</button><button data-m="up" role="tab" class="${mode === 'up' ? 'on' : ''}">حساب جديد</button></div>
      <form class="f box" id="lf" novalidate><label>البريد الإلكتروني<input name="e" type="email" required dir="ltr" autocomplete="email" inputmode="email"></label>
      <label>كلمة المرور<input name="p" type="password" ${S.api.mode === 'live' ? `required minlength="${mode === 'up' ? 8 : 6}"` : ''} dir="ltr" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}"></label>
      ${mode === 'up' ? '<span class="hint">8 أحرف على الأقل. استخدم كلمة مرور لا تستخدمها في موقع آخر.</span>' : ''}
      <p class="hint" id="lerr" role="alert" style="color:var(--danger);margin:0"></p>
      <button class="btn pri" id="lb">${mode === 'in' ? 'دخول' : 'إنشاء الحساب'}</button>${mode === 'in' ? '<button type="button" class="linkb" id="fg">نسيت كلمة المرور؟</button>' : ''}</form></div></section>`);
    $$('.seg button').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    $('#fg') && ($('#fg').onclick = async () => { const e = $('#lf').e.value.trim(); if (!e) return toast('اكتب بريدك أولاً'); try { await S.api.resetPassword(e); toast('إذا كان البريد مسجّلاً ستصلك رسالة إعادة التعيين'); } catch (er) { toast(errMsg(er)); } });
    $('#lf').onsubmit = async ev => {
      ev.preventDefault(); const f = ev.target, b = $('#lb'), err = $('#lerr'); err.textContent = '';
      const email = f.e.value.trim(), pw = f.p.value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err.textContent = 'اكتب بريداً إلكترونياً صحيحاً';
      if (S.api.mode === 'live' && pw.length < (mode === 'up' ? 8 : 6)) return err.textContent = mode === 'up' ? 'كلمة المرور 8 أحرف على الأقل' : 'اكتب كلمة المرور';
      b.disabled = true;
      try {
        if (mode === 'in') await S.api.signIn(email, pw);
        else { const r = await S.api.signUp(email, pw); if (r === 'confirm') { setApp(wrapMsg('أرسلنا رسالة تفعيل إلى بريدك. افتحها ثم ارجع وسجّل الدخول. تحقق من مجلد الرسائل غير المرغوبة.')); return; } }
        await refreshUser(); location.hash = S.role === 'patient' && mode === 'in' ? '#/my' : '#/dash';
      } catch (er) { err.textContent = errMsg(er); b.disabled = false; }
    };
  };
  draw();
}

export function pageNewPass() {
  setMeta('كلمة مرور جديدة');
  setApp(`<section class="band"><div class="wrap auth"><h1 style="font-size:28px;margin-bottom:14px">كلمة مرور جديدة</h1><form class="f box" id="np"><label>كلمة المرور الجديدة<input name="p" type="password" minlength="8" required dir="ltr" autocomplete="new-password"></label><label>تأكيدها<input name="p2" type="password" minlength="8" required dir="ltr" autocomplete="new-password"></label><button class="btn pri">حفظ</button></form></div></section>`);
  $('#np').onsubmit = async e => { e.preventDefault(); const f = e.target; if (f.p.value !== f.p2.value) return toast('كلمتا المرور غير متطابقتين'); if (f.p.value.length < 8) return toast('8 أحرف على الأقل'); try { await S.api.updatePassword(f.p.value); toast('تم تغيير كلمة المرور'); location.hash = '#/dash'; } catch (er) { toast(errMsg(er)); } };
}
