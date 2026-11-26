// خدمة Supabase الحقيقية — كل الصلاحيات تُفرض في قاعدة البيانات (RLS + دوال)، والواجهة تعرض فقط
import { loadScript } from '../core/maps.js';
import { sessionKey, isUUID } from '../core/util.js';
import { isNative, publicBase, LIB } from '../core/native.js';

const SB_URLS = LIB.supabase;
const PUB = 'id,slug,title,name,spec,area,clinic,address,map_url,phone,whatsapp,days,open_from,open_to,years,edu,bio,services,photo_url,status,verified,featured,booking_enabled,slot_minutes,booking_note,created_at,updated_at,lat,lng,cases(count)';
const chk = r => { if (r.error) throw r.error; return r.data; };
const withCount = rows => (rows || []).map(d => ({ ...d, case_count: Array.isArray(d.cases) ? (d.cases[0]?.count || 0) : (d.case_count || 0) }));
const since = days => new Date(Date.now() - days * 864e5).toISOString();

export function Live(cfg) {
  let sb, cur = null;
  // روابط البريد (التفعيل والاستعادة): داخل التطبيق تذهب لموقع الويب العام لأن localhost لا يُفتح من البريد
  const here = () => isNative ? publicBase() : location.origin + location.pathname;
  const mediaPath = u => String(u || '').split('/storage/v1/object/public/media/')[1];
  async function withRatings(rows) {
    if (!rows.length) return rows;
    const q = await sb.from('doctor_ratings').select('*').in('doctor_id', rows.map(d => d.id)); const r = q.error ? [] : q.data;
    const m = Object.fromEntries(r.map(x => [x.doctor_id, x]));
    return rows.map(d => ({ ...d, ...(m[d.id] ? { avg_rating: +m[d.id].avg_rating, review_count: m[d.id].review_count, dist: m[d.id] } : { review_count: 0 }) }));
  }
  const api = {
    mode: 'live',
    async init() {
      let ok = false;
      for (const u of SB_URLS) { try { await loadScript(u); if (window.supabase) { ok = true; break; } } catch { } }
      if (!ok) throw new Error('تعذّر تحميل مكتبة الاتصال');
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      cur = (await sb.auth.getSession()).data.session?.user || null;
    },
    user: async () => cur ? { id: cur.id, email: cur.email } : null,
    async role() { if (!cur) return null; const d = chk(await sb.from('profiles').select('role').eq('id', cur.id).maybeSingle()); return d?.role || 'patient'; },
    onAuth(f) { sb.auth.onAuthStateChange((ev, s) => { cur = s?.user || null; f(ev); }); },
    async signIn(e, p) { chk(await sb.auth.signInWithPassword({ email: e, password: p })); },
    async signUp(e, p) { const d = chk(await sb.auth.signUp({ email: e, password: p, options: { emailRedirectTo: here() } })); return d.session ? 'in' : 'confirm'; },
    async signOut() { await sb.auth.signOut(); cur = null; },
    async resetPassword(e) { chk(await sb.auth.resetPasswordForEmail(e, { redirectTo: here() + '#/newpass' })); },
    async updatePassword(p) { chk(await sb.auth.updateUser({ password: p })); },

    /* ---------- القوائم والإعدادات ---------- */
    async lists() {
      const [a, s, c] = await Promise.all(['areas', 'specializations', 'case_categories'].map(t => sb.from(t).select('name,active,sort,id').order('sort')));
      if (a.error || s.error || c.error) return null;
      return { areas: a.data.filter(x => x.active).map(x => x.name), specs: s.data.filter(x => x.active).map(x => x.name), cats: c.data.filter(x => x.active).map(x => x.name), raw: { areas: a.data, specializations: s.data, case_categories: c.data } };
    },
    async settings() { const r = await sb.from('platform_settings').select('key,value'); return r.error ? {} : Object.fromEntries(r.data.map(x => [x.key, x.value])); },

    /* ---------- الجمهور ---------- */
    async listDoctors() { return withRatings(withCount(chk(await sb.from('doctors').select(PUB).eq('status', 'approved')))); },
    async getDoctor(key, full) {
      const col = isUUID(key) ? 'id' : 'slug';
      const r = withCount(chk(await sb.from('doctors').select(full ? '*,cases(count)' : PUB).eq(col, col === 'slug' ? String(key).toLowerCase() : key)));
      return r[0] ? (await withRatings(r))[0] : null;
    },
    async casesOf(id, pub) { let q = sb.from('cases').select('*').eq('doctor_id', id).order('created_at', { ascending: false }); if (pub) q = q.eq('hidden', false); return chk(await q); },
    async latestCases(n) { return chk(await sb.from('cases').select('*').eq('hidden', false).order('created_at', { ascending: false }).limit(n)); },
    async tips() { return chk(await sb.from('tips').select('*').order('created_at', { ascending: false }).limit(12)); },
    async reviewsOf(id) { return chk(await sb.from('reviews').select('id,rating,comment,author_name,created_at,status').eq('doctor_id', id).eq('status', 'published').order('created_at', { ascending: false }).limit(30)); },
    async logEvent(doctorId, kind) { try { await sb.rpc('log_event', { p_doctor: doctorId, p_kind: kind, p_session: sessionKey() }); } catch { } },
    async report(caseId, reviewId, reason) { chk(await sb.rpc('submit_report', { p_case: caseId, p_review: reviewId, p_reason: reason, p_session: sessionKey() })); },

    /* ---------- الحجز ---------- */
    async slots(doctorId, day) { return chk(await sb.rpc('available_slots', { p_doctor: doctorId, p_day: day })); },
    async createBooking(doctorId, start, name, phone, note) { const r = chk(await sb.rpc('create_booking', { p_doctor: doctorId, p_start: start, p_name: name, p_phone: phone, p_note: note || null })); return r[0]; },
    async getBooking(token) { return chk(await sb.rpc('get_booking', { p_token: token })); },
    async cancelBooking(token) { return chk(await sb.rpc('cancel_booking', { p_token: token })); },
    async acceptProposal(token) { return chk(await sb.rpc('accept_proposal', { p_token: token })); },
    async addReview(token, rating, comment) { return chk(await sb.rpc('add_review', { p_token: token, p_rating: rating, p_comment: comment || null })); },
    async myPatientBookings() { if (!cur) return []; return chk(await sb.from('bookings').select('token,start_at,status,doctor_id,doctors(name,slug,id)').eq('patient_id', cur.id).order('start_at', { ascending: false }).limit(50)); },

    /* ---------- الطبيب ---------- */
    async myProfile() { return chk(await sb.from('profiles').select('*').eq('id', cur.id).maybeSingle()); },
    async saveProfile(p) { chk(await sb.from('profiles').update(p).eq('id', cur.id)); },
    async saveDoctor(d) { chk(await sb.from('doctors').upsert({ ...d, id: cur.id })); },
    async updateMyDoctor(p) { chk(await sb.from('doctors').update(p).eq('id', cur.id)); },
    async upload(blob, name) { const path = `${cur.id}/${Date.now()}-${name}.jpg`; chk(await sb.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: false })); return sb.storage.from('media').getPublicUrl(path).data.publicUrl; },
    async uploadDoc(file, blob) { const ext = file.type === 'application/pdf' ? 'pdf' : 'jpg'; const path = `${cur.id}/doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`; chk(await sb.storage.from('licenses').upload(path, blob || file, { contentType: blob ? 'image/jpeg' : file.type, upsert: false })); return path; },
    async docUrl(path) { return chk(await sb.storage.from('licenses').createSignedUrl(path, 600)).signedUrl; },
    async addCase(c) { chk(await sb.from('cases').insert({ ...c, doctor_id: cur.id, consent_confirmed: true, consent_version: 'v1-2026' })); },
    async updateCase(id, p) { chk(await sb.from('cases').update(p).eq('id', id)); },
    async deleteCase(c) { chk(await sb.from('cases').delete().eq('id', c.id)); const ps = [c.before_url, c.after_url].map(mediaPath).filter(Boolean); if (ps.length) await sb.storage.from('media').remove(ps); },
    async stats(days) { return chk(await sb.rpc('doctor_stats', { p_days: days })); },
    async doctorBookings(fromISO) { return chk(await sb.from('bookings').select('*').eq('doctor_id', cur.id).gte('start_at', fromISO).order('start_at').limit(500)); },
    async bookingAction(id, action, note, newStart) { return chk(await sb.rpc('doctor_booking_action', { p_id: id, p_action: action, p_note: note || null, p_new_start: newStart || null })); },
    async timeOff() { return chk(await sb.from('time_off').select('*').eq('doctor_id', cur.id).gte('ends_on', new Date().toISOString().slice(0, 10)).order('starts_on')); },
    async addTimeOff(a, b, note) { chk(await sb.from('time_off').insert({ doctor_id: cur.id, starts_on: a, ends_on: b, note: note || null })); },
    async delTimeOff(id) { chk(await sb.from('time_off').delete().eq('id', id)); },
    async myVerifications() { return chk(await sb.from('verification_requests').select('*').eq('doctor_id', cur.id).order('created_at', { ascending: false })); },
    async submitVerification(paths, note, existing) {
      if (existing) chk(await sb.from('verification_requests').update({ documents: [...existing.documents, ...paths], doctor_note: note || existing.doctor_note }).eq('id', existing.id));
      else chk(await sb.from('verification_requests').insert({ doctor_id: cur.id, documents: paths, doctor_note: note || null }));
    },
    async myReviews() { return chk(await sb.from('reviews').select('*').eq('doctor_id', cur.id).order('created_at', { ascending: false }).limit(50)); },

    /* ---------- الإشعارات ---------- */
    async notifications() { return chk(await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(40)); },
    async unreadCount() { if (!cur) return 0; const r = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null); return r.count || 0; },
    async markRead(id) { await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); },
    async markAllRead() { chk(await sb.rpc('mark_all_notifications_read')); },

    /* ---------- الإدارة ---------- */
    async overview() { return chk(await sb.rpc('admin_overview')); },
    async allDoctors() { return withCount(chk(await sb.from('doctors').select('*,cases(count)').order('created_at', { ascending: false }))); },
    async setDoctor(id, patch) { chk(await sb.from('doctors').update(patch).eq('id', id)); },
    async deleteDoctor(id) { chk(await sb.from('doctors').delete().eq('id', id)); },
    async verificationQueue() { return chk(await sb.from('verification_requests').select('*,doctors(name,spec,area,phone)').order('created_at', { ascending: false }).limit(100)); },
    async decideVerification(id, status, note) { chk(await sb.from('verification_requests').update({ status, review_note: note || null }).eq('id', id)); },
    async allCases() { return chk(await sb.from('cases').select('*').order('created_at', { ascending: false }).limit(300)); },
    async setCase(id, patch) { chk(await sb.from('cases').update(patch).eq('id', id)); },
    async allReviews() { return chk(await sb.from('reviews').select('*,doctors(name)').order('created_at', { ascending: false }).limit(200)); },
    async setReview(id, status, reason) { chk(await sb.from('reviews').update({ status, hidden_reason: reason || null }).eq('id', id)); },
    async reports() { return chk(await sb.from('reports').select('*').order('created_at', { ascending: false })); },
    async delReport(id) { chk(await sb.from('reports').delete().eq('id', id)); },
    async addTip(t) { chk(await sb.from('tips').insert(t)); },
    async updateTip(id, t) { chk(await sb.from('tips').update({ ...t, updated_at: new Date().toISOString() }).eq('id', id)); },
    async delTip(id) { chk(await sb.from('tips').delete().eq('id', id)); },
    async listAdd(table, name) { chk(await sb.from(table).insert({ name })); },
    async listSet(table, id, patch) { chk(await sb.from(table).update(patch).eq('id', id)); },
    async users(q) { return chk(await sb.rpc('admin_list_users', { p_search: q || null })); },
    async setRole(id, role) { chk(await sb.rpc('set_user_role', { p_user: id, p_role: role })); },
    async audit() { return chk(await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(150)); },
    async saveSetting(key, value) { chk(await sb.from('platform_settings').upsert({ key, value, is_public: key === 'announcement', updated_at: new Date().toISOString(), updated_by: cur.id })); },
    async broadcast(title, body, target) { return chk(await sb.rpc('admin_broadcast', { p_title: title, p_body: body, p_target: target })); },
    async adminBookings() { return chk(await sb.from('bookings').select('id,start_at,status,doctor_id,created_at,doctors(name)').order('created_at', { ascending: false }).limit(100)); }
  };
  return api;
}
