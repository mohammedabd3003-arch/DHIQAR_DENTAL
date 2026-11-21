// الوضع التجريبي: يعمل فقط عند غياب إعدادات Supabase (بيئة التطوير)، وبياناته محلية على الجهاز
// لا يُستخدم أبداً كبديل للخدمة الحقيقية عند فشل الاتصال.
import { uidGen, todayBG, isoDay, normPhone } from '../core/util.js';

export function Demo() {
  const K = 'basma_demo_v5'; let st = null, cur = null; const cbs = [];
  try { st = JSON.parse(localStorage.getItem(K)); cur = JSON.parse(localStorage.getItem(K + '_u')); } catch { }
  const now = () => new Date().toISOString(), dAgo = d => new Date(Date.now() - d * 864e5).toISOString();
  if (!st) st = seed();
  function seed() {
    const base = { days: [0, 1, 2, 3, 4, 6], open_from: '16:00', open_to: '22:00', featured: false, verified: false, photo_url: '', map_url: '', status: 'approved', license_url: '', booking_enabled: true, slot_minutes: 30, title: 'د.' };
    const s = {
      users: {}, roles: {}, notifications: [], audit: [], verifications: [], bookings: [], reviews: [], time_off: [], settings: { announcement: { active: false, text: '' } },
      doctors: [
        { ...base, id: 'demo-1', slug: 'ali-hassan', name: 'علي حسن', spec: 'تقويم الأسنان', area: 'الناصرية', clinic: 'عيادة الابتسامة', address: 'الناصرية، شارع الحبوبي', phone: '07800000001', whatsapp: '07800000001', years: 9, edu: 'بكالوريوس طب وجراحة الفم والأسنان، دبلوم تقويم', bio: 'أعالج ازدحام الأسنان وسوء الإطباق للبالغين والمراهقين.', services: ['تقويم ثابت', 'تقويم شفاف', 'مثبتات'], verified: true, featured: true, lat: 31.0431, lng: 46.2602, created_at: dAgo(40), updated_at: dAgo(2) },
        { ...base, id: 'demo-2', slug: null, name: 'زينب كاظم', spec: 'تجميل وتركيبات', area: 'الشطرة', clinic: 'مركز بسمة لطب الأسنان', address: 'الشطرة، قرب السوق الكبير', phone: '07700000002', whatsapp: '07700000002', days: [0, 1, 2, 3, 4], open_from: '10:00', open_to: '20:00', years: 6, edu: 'بكالوريوس طب وجراحة الفم والأسنان', bio: 'تبييض وفينير وتركيبات تجميلية.', services: ['تبييض', 'فينير', 'تيجان زركون'], verified: true, lat: 31.4106, lng: 46.1712, created_at: dAgo(30), updated_at: dAgo(3) },
        { ...base, id: 'demo-3', slug: null, name: 'حسين جبار', spec: 'زراعة الأسنان', area: 'سوق الشيوخ', clinic: 'عيادة الفرات', address: 'سوق الشيوخ، الشارع العام', phone: '07500000003', whatsapp: '07500000003', days: [1, 2, 3, 4, 6], open_from: '15:00', open_to: '21:00', years: 12, edu: 'ماجستير جراحة الفم', bio: 'زراعة فورية ومؤجلة.', services: ['زراعة', 'رفع جيب أنفي'], booking_enabled: false, lat: 30.8869, lng: 46.4626, created_at: dAgo(20), updated_at: dAgo(4) },
        { ...base, id: 'demo-4', slug: null, name: 'مريم عبد الله', spec: 'أسنان الأطفال', area: 'الرفاعي', clinic: 'عيادة براعم', phone: '07800000004', whatsapp: '07800000004', years: 3, bio: 'طب أسنان الأطفال والوقاية.', services: ['حشوات أطفال', 'فلورايد'], status: 'pending', lat: 31.7186, lng: 46.1155, created_at: dAgo(1), updated_at: dAgo(1) }],
      cases: [
        { id: 'c1', doctor_id: 'demo-1', title: 'تقويم ثابت لازدحام الأسنان الأمامية', cat: 'تقويم', sessions: '14 شهراً', note: 'ازدحام وتدوير في الأسنان الأمامية.', before_url: 'demo:ortho-b', after_url: 'demo:ortho-a', hidden: false, created_at: dAgo(2) },
        { id: 'c2', doctor_id: 'demo-2', title: 'تبييض في العيادة', cat: 'تبييض', sessions: 'جلستان', note: 'تبييض مكتبي على جلستين.', before_url: 'demo:white-b', after_url: 'demo:white-a', hidden: false, created_at: dAgo(3) },
        { id: 'c3', doctor_id: 'demo-3', title: 'تعويض ضاحك مفقود بزرعة', cat: 'زراعة', sessions: '4 أشهر', note: 'زرعة مع تاج زركون.', before_url: 'demo:implant-b', after_url: 'demo:implant-a', hidden: false, created_at: dAgo(4) }],
      reports: [], clicks: [],
      tips: [{ id: 't1', title: 'مرتين يومياً، دقيقتين كل مرة', body: 'نظّف أسنانك صباحاً وقبل النوم بمعجون يحتوي فلورايد.', created_at: dAgo(1) }],
      lists: { areas: [], specializations: [], case_categories: [] }
    };
    const kinds = ['view', 'view', 'view', 'wa', 'call'];
    for (let i = 0; i < 120; i++) s.clicks.push({ doctor_id: ['demo-1', 'demo-1', 'demo-2', 'demo-3'][i % 4], kind: kinds[i % 5], created_at: dAgo(Math.random() * 20) });
    const past = new Date(Date.now() - 3 * 864e5); past.setUTCMinutes(0, 0, 0);
    s.bookings.push({ id: 'bk1', token: 'demo-token-1', doctor_id: 'demo-1', patient_name: 'سارة', patient_phone: '07801112222', start_at: past.toISOString(), end_at: new Date(+past + 18e5).toISOString(), status: 'completed', created_at: dAgo(5) });
    s.reviews.push({ id: 'rv1', booking_id: 'bk1', doctor_id: 'demo-1', author_name: 'سارة', rating: 5, comment: 'دكتور متمكّن وتعامل راقٍ.', status: 'published', created_at: dAgo(2) });
    return s;
  }
  const save = () => { try { localStorage.setItem(K, JSON.stringify(st)); } catch { throw new Error('امتلأت ذاكرة الوضع التجريبي على هذا الجهاز'); } };
  try { if (!localStorage.getItem(K)) save(); } catch { }
  const setCur = u => { cur = u; try { localStorage.setItem(K + '_u', JSON.stringify(u)); } catch { } cbs.forEach(f => f(u ? 'SIGNED_IN' : 'SIGNED_OUT')); };
  const roleOf = id => st.roles[id] || (st.doctors.some(d => d.id === id) ? 'doctor' : 'patient');
  const myRole = () => cur ? roleOf(cur.id) : null;
  const isAdmin = () => ['admin', 'super_admin'].includes(myRole()), isStaff = () => ['moderator', 'admin', 'super_admin'].includes(myRole());
  const deny = () => { throw new Error('غير مسموح'); };
  const pub = d => { const { license_url, ...r } = d; return r; };
  const rating = id => { const r = st.reviews.filter(x => x.doctor_id === id && x.status === 'published'); if (!r.length) return { review_count: 0 }; const dist = { r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 }; r.forEach(x => dist['r' + x.rating]++); return { avg_rating: r.reduce((a, x) => a + x.rating, 0) / r.length, review_count: r.length, dist }; };
  const cnt = d => ({ ...d, case_count: st.cases.filter(c => c.doctor_id === d.id && !c.hidden).length, ...rating(d.id) });
  const ok = id => st.doctors.find(d => d.id === id)?.status === 'approved';
  const byDate = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
  const notify = (user, type, title, body, link) => user && st.notifications.unshift({ id: uidGen(), user_id: user, type, title, body, link, read_at: null, created_at: now() });
  const notifyStaff = (t, title, body, link) => Object.entries(st.roles).filter(([, r]) => ['admin', 'super_admin'].includes(r)).forEach(([id]) => notify(id, t, title, body, link));
  const audit = (action, entity, entity_id, details = {}) => st.audit.unshift({ id: uidGen(), actor_id: cur?.id, actor_role: myRole(), action, entity, entity_id, details, created_at: now() });
  const login = e => {
    e = String(e).trim().toLowerCase(); if (!e.includes('@')) throw new Error('أدخل بريداً صحيحاً');
    st.users[e] = st.users[e] || uidGen();
    if (e === 'admin@demo.iq') st.roles[st.users[e]] = 'super_admin'; if (e === 'mod@demo.iq') st.roles[st.users[e]] = 'moderator';
    save(); setCur({ id: st.users[e], email: e });
  };
  const blob2url = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  function slotsFor(id, day) {
    const d = st.doctors.find(x => x.id === id); if (!d || d.status !== 'approved' || !d.booking_enabled) return [];
    const dt = new Date(day + 'T00:00:00Z'); if (!d.days.includes(dt.getUTCDay())) return [];
    if (st.time_off.some(t => t.doctor_id === id && day >= t.starts_on && day <= t.ends_on)) return [];
    const [fh, fm] = d.open_from.split(':').map(Number), [th, tm] = d.open_to.split(':').map(Number);
    const s0 = new Date(day + `T${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}:00+03:00`); let e0 = new Date(day + `T${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')}:00+03:00`); if (e0 <= s0) e0 = new Date(+e0 + 864e5);
    const step = d.slot_minutes * 6e4, out = [];
    for (let t = +s0; t + step <= +e0; t += step) {
      if (t < Date.now() + 18e5) continue;
      if (st.bookings.some(b => b.doctor_id === id && ['pending', 'confirmed'].includes(b.status) && +new Date(b.start_at) < t + step && +new Date(b.end_at) > t)) continue;
      out.push({ slot_start: new Date(t).toISOString(), slot_end: new Date(t + step).toISOString() });
    }
    return out;
  }
  const bk = t => st.bookings.find(b => b.token === t);
  return {
    mode: 'demo', async init() { }, user: async () => cur, role: async () => myRole(), onAuth: f => cbs.push(f),
    async signIn(e) { login(e); }, async signUp(e) { login(e); return 'in'; }, async signOut() { setCur(null); }, async resetPassword() { }, async updatePassword() { },
    async lists() { return null; }, async settings() { return st.settings; },
    listDoctors: async () => st.doctors.filter(d => d.status === 'approved').map(d => cnt(pub(d))),
    async getDoctor(key, full) { const d = st.doctors.find(x => x.id === key || x.slug === String(key).toLowerCase()); if (!d || (d.status !== 'approved' && d.id !== cur?.id && !isAdmin())) return null; return cnt(full ? d : pub(d)); },
    casesOf: async (id, p) => st.cases.filter(c => c.doctor_id === id && (!p || !c.hidden)).sort(byDate),
    latestCases: async n => st.cases.filter(c => !c.hidden && ok(c.doctor_id)).sort(byDate).slice(0, n),
    tips: async () => [...st.tips].sort(byDate),
    reviewsOf: async id => st.reviews.filter(r => r.doctor_id === id && r.status === 'published').sort(byDate),
    async logEvent(doctor_id, kind) { if (doctor_id !== cur?.id && ok(doctor_id)) { st.clicks.push({ doctor_id, kind, created_at: now() }); try { save(); } catch { } } },
    async report(case_id, review_id, reason) { st.reports.push({ id: uidGen(), case_id, review_id, reason, created_at: now() }); save(); notifyStaff('report', 'بلاغ جديد', reason, '#/admin'); },
    slots: async (id, day) => slotsFor(id, day),
    async createBooking(doctor_id, start, name, phone, note) {
      const ph = normPhone(phone); if (!/^07\d{9}$/.test(ph)) throw new Error('رقم الهاتف غير صحيح، اكتبه بصيغة 07xxxxxxxxx');
      if (String(name).trim().length < 2) throw new Error('اكتب اسمك (حرفان على الأقل)');
      const d = st.doctors.find(x => x.id === doctor_id), day = isoDay(new Date(+new Date(start) + 3 * 36e5));
      if (!slotsFor(doctor_id, day).some(s => s.slot_start === new Date(start).toISOString())) throw new Error('هذا الموعد لم يعد متاحاً، اختر موعداً آخر');
      const b = { id: uidGen(), token: uidGen(), doctor_id, patient_id: cur?.id || null, patient_name: name.trim(), patient_phone: ph, note, start_at: new Date(start).toISOString(), end_at: new Date(+new Date(start) + d.slot_minutes * 6e4).toISOString(), status: 'pending', created_at: now() };
      st.bookings.push(b); st.clicks.push({ doctor_id, kind: 'book', created_at: now() }); notify(doctor_id, 'booking_new', 'طلب حجز جديد من ' + b.patient_name, '', '#/dash'); save();
      return { token: b.token, booking_id: b.id, start_at: b.start_at, status: b.status };
    },
    async getBooking(t) { const b = bk(t); if (!b) return null; const d = st.doctors.find(x => x.id === b.doctor_id); const r = st.reviews.find(x => x.booking_id === b.id); return { ...b, doctor: pub(d), review: r ? { rating: r.rating, comment: r.comment } : null }; },
    async cancelBooking(t) { const b = bk(t); if (!b || !['pending', 'confirmed'].includes(b.status) || new Date(b.start_at) <= new Date()) throw new Error('لا يمكن إلغاء هذا الحجز'); b.status = 'cancelled'; b.cancelled_by = 'patient'; notify(b.doctor_id, 'booking_cancelled', 'ألغى ' + b.patient_name + ' حجزه', '', '#/dash'); save(); },
    async acceptProposal(t) { const b = bk(t); if (!b?.proposed_start_at) throw new Error('لا يوجد موعد بديل مقترح'); const d = st.doctors.find(x => x.id === b.doctor_id); b.start_at = b.proposed_start_at; b.end_at = new Date(+new Date(b.start_at) + d.slot_minutes * 6e4).toISOString(); b.proposed_start_at = null; b.status = 'confirmed'; save(); },
    async addReview(t, rating, comment) { const b = bk(t); if (!b || b.status !== 'completed') throw new Error('يمكن التقييم بعد إتمام الموعد فقط'); if (st.reviews.some(r => r.booking_id === b.id)) throw new Error('قيّمت هذا الموعد مسبقاً'); st.reviews.push({ id: uidGen(), booking_id: b.id, doctor_id: b.doctor_id, author_name: b.patient_name.split(' ')[0], rating, comment, status: 'published', created_at: now() }); notify(b.doctor_id, 'review_new', 'تقييم جديد: ' + '★'.repeat(rating), comment, '#/dash'); save(); },
    myPatientBookings: async () => cur ? st.bookings.filter(b => b.patient_id === cur.id).map(b => ({ ...b, doctors: st.doctors.find(d => d.id === b.doctor_id) })) : [],
    async myProfile() { return { id: cur.id, role: myRole(), full_name: st.users_meta?.[cur.id]?.full_name || '' }; },
    async saveProfile(p) { st.users_meta = st.users_meta || {}; st.users_meta[cur.id] = p; save(); },
    async saveDoctor(d) {
      if (d.slug && st.doctors.some(x => x.slug === d.slug && x.id !== cur.id)) throw new Error('duplicate key doctors_slug_uidx');
      const i = st.doctors.findIndex(x => x.id === cur.id), o = st.doctors[i] || {}; const row = { ...o, ...d, id: cur.id, status: o.status || 'pending', verified: !!o.verified, featured: !!o.featured, created_at: o.created_at || now(), updated_at: now() };
      if (i < 0) { st.doctors.push(row); notifyStaff('doctor_request', 'طلب انضمام جديد: ' + row.name, '', '#/admin'); } else st.doctors[i] = row; save();
    },
    async updateMyDoctor(p) { Object.assign(st.doctors.find(x => x.id === cur.id), p); save(); },
    upload: blob => blob2url(blob), uploadDoc: (f, blob) => blob2url(blob || f), docUrl: async p => p,
    async addCase(c) { st.cases.push({ ...c, id: uidGen(), doctor_id: cur.id, hidden: false, consent_confirmed: true, created_at: now() }); save(); },
    async updateCase(id, p) { const c = st.cases.find(x => x.id === id); if (!c || (c.doctor_id !== cur.id && !isStaff())) deny(); const { hidden, hidden_reason, ...rest } = p; Object.assign(c, isStaff() ? p : rest); save(); },
    async deleteCase(c) { st.cases = st.cases.filter(x => x.id !== c.id); save(); },
    async stats(days) {
      const out = [], t0 = todayBG(); for (let i = days - 1; i >= 0; i--) { const d = isoDay(new Date(+t0 - i * 864e5)); const cl = st.clicks.filter(c => c.doctor_id === cur.id && isoDay(new Date(+new Date(c.created_at) + 3 * 36e5)) === d); out.push({ day: d, views: cl.filter(c => c.kind === 'view').length, wa: cl.filter(c => c.kind === 'wa').length, calls: cl.filter(c => c.kind === 'call').length, books: cl.filter(c => c.kind === 'book').length, shares: cl.filter(c => c.kind === 'share').length }); }
      return out;
    },
    doctorBookings: async from => st.bookings.filter(b => b.doctor_id === cur.id && b.start_at >= from).sort((a, b) => a.start_at.localeCompare(b.start_at)),
    async bookingAction(id, action, note, newStart) {
      const b = st.bookings.find(x => x.id === id); if (!b || (b.doctor_id !== cur.id && !isAdmin())) deny(); const past = new Date(b.start_at) <= new Date(); const d = st.doctors.find(x => x.id === b.doctor_id);
      const T = { confirm: [['pending'], 'confirmed'], reject: [['pending'], 'rejected'], propose: [['pending', 'confirmed'], 'pending'], reschedule: [['pending', 'confirmed'], 'confirmed'], complete: [['confirmed'], 'completed'], no_show: [['confirmed'], 'no_show'], cancel: [['pending', 'confirmed'], 'cancelled'] }[action];
      if (!T || !T[0].includes(b.status)) throw new Error('لا يمكن تنفيذ هذا الإجراء على الحجز');
      if (['complete', 'no_show'].includes(action) && !past) throw new Error('يمكن إكمال الموعد المؤكد بعد وقته فقط');
      if (['propose', 'reschedule'].includes(action) && (!newStart || new Date(newStart) <= new Date())) throw new Error('اختر موعداً مستقبلياً');
      if (action === 'propose') b.proposed_start_at = newStart;
      if (action === 'reschedule') { b.start_at = newStart; b.end_at = new Date(+new Date(newStart) + d.slot_minutes * 6e4).toISOString(); b.proposed_start_at = null; }
      b.status = T[1]; if (note) b.doctor_note = note; save(); return b.status;
    },
    timeOff: async () => st.time_off.filter(t => t.doctor_id === cur.id), async addTimeOff(a, b, note) { st.time_off.push({ id: uidGen(), doctor_id: cur.id, starts_on: a, ends_on: b, note }); save(); }, async delTimeOff(id) { st.time_off = st.time_off.filter(t => t.id !== id); save(); },
    myVerifications: async () => st.verifications.filter(v => v.doctor_id === cur.id).sort(byDate),
    async submitVerification(paths, note, ex) { if (ex) { ex.documents = [...ex.documents, ...paths]; ex.status = 'pending'; ex.doctor_note = note || ex.doctor_note; const v = st.verifications.find(x => x.id === ex.id); Object.assign(v, ex); } else st.verifications.push({ id: uidGen(), doctor_id: cur.id, documents: paths, doctor_note: note, status: 'pending', created_at: now() }); notifyStaff('verification_request', 'طلب توثيق جديد', '', '#/admin'); save(); },
    myReviews: async () => st.reviews.filter(r => r.doctor_id === cur.id).sort(byDate),
    notifications: async () => st.notifications.filter(n => n.user_id === cur?.id).slice(0, 40),
    unreadCount: async () => st.notifications.filter(n => n.user_id === cur?.id && !n.read_at).length,
    async markRead(id) { const n = st.notifications.find(x => x.id === id); if (n) n.read_at = now(); save(); },
    async markAllRead() { st.notifications.filter(n => n.user_id === cur?.id).forEach(n => n.read_at = n.read_at || now()); save(); },
    async overview() {
      if (!isStaff()) deny(); const c30 = st.clicks.filter(c => new Date(c.created_at) > Date.now() - 30 * 864e5); const per = {}; c30.filter(c => c.kind !== 'view').forEach(c => { const n = st.doctors.find(d => d.id === c.doctor_id)?.name; per[n] = (per[n] || 0) + 1; }); const area = {}; st.doctors.filter(d => d.status === 'approved').forEach(d => area[d.area] = (area[d.area] || 0) + 1);
      return { doctors_total: st.doctors.length, doctors_approved: st.doctors.filter(d => d.status === 'approved').length, doctors_verified: st.doctors.filter(d => d.verified).length, doctors_pending: st.doctors.filter(d => d.status === 'pending').length, verification_open: st.verifications.filter(v => v.status === 'pending').length, cases: st.cases.length, users: Object.keys(st.users).length, patients: 0, bookings_30d: st.bookings.length, bookings_pending: st.bookings.filter(b => b.status === 'pending').length, reports_open: st.reports.length, reviews: st.reviews.length, views_30d: c30.filter(c => c.kind === 'view').length, contacts_30d: c30.filter(c => c.kind !== 'view').length, top_doctors: Object.entries(per).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 7), by_area: Object.entries(area).map(([area, n]) => ({ area, n })) };
    },
    allDoctors: async () => { if (!isAdmin()) deny(); return [...st.doctors].sort(byDate).map(cnt); },
    async setDoctor(id, p) { if (!isAdmin()) deny(); const d = st.doctors.find(x => x.id === id); const o = { ...d }; Object.assign(d, p); if (p.status && p.status !== o.status) { audit('doctor.status', 'doctors', id, { from: o.status, to: p.status, name: d.name }); notify(id, 'doctor_status', p.status === 'approved' ? 'تمت الموافقة على صفحتك 🎉' : 'تغيّرت حالة صفحتك', '', '#/dash'); } if ('verified' in p) audit(p.verified ? 'doctor.verify' : 'doctor.unverify', 'doctors', id, { name: d.name }); if ('featured' in p) audit('doctor.feature', 'doctors', id, { name: d.name }); save(); },
    async deleteDoctor(id) { if (!isAdmin()) deny(); st.doctors = st.doctors.filter(d => d.id !== id); st.cases = st.cases.filter(c => c.doctor_id !== id); audit('doctor.delete', 'doctors', id); save(); },
    verificationQueue: async () => { if (!isAdmin()) deny(); return st.verifications.map(v => ({ ...v, doctors: st.doctors.find(d => d.id === v.doctor_id) })).sort(byDate); },
    async decideVerification(id, status, note) { if (!isAdmin()) deny(); const v = st.verifications.find(x => x.id === id); v.status = status; v.review_note = note; v.reviewed_by = cur.id; v.reviewed_at = now(); if (status === 'approved') { const d = st.doctors.find(x => x.id === v.doctor_id); d.verified = true; d.verified_at = now(); } audit('verification.' + status, 'verification_requests', id, { note }); notify(v.doctor_id, 'verification', status === 'approved' ? 'تم توثيق حسابك ✓' : status === 'rejected' ? 'رُفض طلب التوثيق' : 'الإدارة تطلب مستندات إضافية', note, '#/dash'); save(); },
    allCases: async () => { if (!isStaff()) deny(); return [...st.cases].sort(byDate); },
    async setCase(id, p) { if (!isStaff()) deny(); Object.assign(st.cases.find(c => c.id === id), p); audit(p.hidden ? 'case.hide' : 'case.unhide', 'cases', id); save(); },
    allReviews: async () => { if (!isStaff()) deny(); return st.reviews.map(r => ({ ...r, doctors: st.doctors.find(d => d.id === r.doctor_id) })).sort(byDate); },
    async setReview(id, status, reason) { if (!isStaff()) deny(); Object.assign(st.reviews.find(r => r.id === id), { status, hidden_reason: reason }); audit('review.' + status, 'reviews', id); save(); },
    reports: async () => { if (!isStaff()) deny(); return [...st.reports].sort(byDate); },
    async delReport(id) { st.reports = st.reports.filter(r => r.id !== id); audit('report.close', 'reports', id); save(); },
    async addTip(t) { if (!isAdmin()) deny(); st.tips.push({ ...t, id: uidGen(), created_at: now() }); save(); },
    async updateTip(id, t) { Object.assign(st.tips.find(x => x.id === id), t); save(); },
    async delTip(id) { st.tips = st.tips.filter(t => t.id !== id); save(); },
    async listAdd() { throw new Error('إدارة القوائم تعمل مع قاعدة البيانات الحقيقية'); }, async listSet() { },
    users: async () => { if (!isAdmin()) deny(); return Object.entries(st.users).map(([email, id]) => ({ id, email, role: roleOf(id), created_at: now(), doctor_name: st.doctors.find(d => d.id === id)?.name })); },
    async setRole(id, role) { if (myRole() !== 'super_admin') throw new Error('للمدير الأعلى فقط'); if (id === cur.id) throw new Error('لا يمكنك تغيير دورك بنفسك'); st.roles[id] = role; audit('user.role', 'profiles', id, { to: role }); save(); },
    audit: async () => { if (!isAdmin()) deny(); return st.audit.slice(0, 150); },
    async saveSetting(k, v) { st.settings[k] = v; save(); }, async broadcast(t, b) { st.doctors.forEach(d => notify(d.id, 'admin', t, b)); save(); return st.doctors.length; },
    adminBookings: async () => st.bookings.map(b => ({ ...b, doctors: st.doctors.find(d => d.id === b.doctor_id) }))
  };
}
