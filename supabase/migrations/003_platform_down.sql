-- =====================================================================
--  التراجع عن 003_platform — يعيد قاعدة البيانات إلى حالة الإصدار 002
--  تحذير: يحذف بيانات الجداول الجديدة فقط (الحجوزات، التقييمات، الإشعارات،
--  طلبات التوثيق، السجل، القوائم، الاشتراكات). بيانات الأطباء والحالات
--  والنصائح والبلاغات والنقرات القديمة تبقى كما هي.
--  خذ نسخة احتياطية قبل التشغيل (راجع BACKUP.md).
-- =====================================================================
begin;
set local check_function_bodies = off;

drop trigger if exists doctors_after on public.doctors;
drop trigger if exists cases_after on public.cases;
drop trigger if exists tips_audit on public.tips;
drop trigger if exists reports_audit on public.reports;
drop trigger if exists profiles_guard on public.profiles;

drop view if exists public.doctor_ratings;
drop table if exists public.payments, public.subscriptions, public.plans,
  public.reviews, public.bookings, public.time_off, public.verification_requests,
  public.notifications, public.audit_logs, public.platform_settings,
  public.areas, public.specializations, public.case_categories cascade;

drop function if exists public.available_slots(uuid, date), public.create_booking(uuid, timestamptz, text, text, text),
  public.get_booking(uuid), public.cancel_booking(uuid), public.accept_proposal(uuid),
  public.doctor_booking_action(uuid, text, text, timestamptz), public.doctor_window(uuid, date), public.norm_phone(text),
  public.add_review(uuid, integer, text), public.guard_review(), public.submit_report(uuid, uuid, text, text),
  public.log_event(uuid, text, text), public.doctor_stats(integer, uuid), public.admin_overview(),
  public.admin_list_users(text), public.set_user_role(uuid, text), public.admin_broadcast(text, text, text),
  public.mark_all_notifications_read(), public.notify(uuid, text, text, text, text), public.notify_staff(text, text, text, text),
  public.guard_notification(), public.log_audit(text, text, text, jsonb), public.doctor_after_change(), public.case_after_change(),
  public.guard_verification(), public.verification_after(), public.tips_audit(), public.reports_audit(), public.guard_profile(),
  public.is_staff(), public.is_super_admin(), public.my_role() cascade;

-- الأدوار: أعد المدير الأعلى/المدير/المشرف إلى admin، والمرضى إلى doctor
update public.profiles set role = 'admin' where role in ('super_admin','admin');
update public.profiles set role = 'doctor' where role in ('patient','moderator');
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('doctor','admin'));
alter table public.profiles alter column role set default 'doctor';

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.protect_doctor()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending'; new.verified := false; new.featured := false; new.created_at := now();
    else
      new.id := old.id; new.status := old.status; new.verified := old.verified;
      new.featured := old.featured; new.created_at := old.created_at;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.protect_case()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then new.hidden := false; new.created_at := now();
    else new.hidden := old.hidden; new.doctor_id := old.doctor_id; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;

-- إعادة السياسات السابقة
drop policy if exists p_profiles_upd on public.profiles;
create policy p_profiles_upd on public.profiles for update using (public.is_admin());
drop policy if exists p_case_sel on public.cases;
create policy p_case_sel on public.cases for select using (
  (not hidden and exists (select 1 from public.doctors d where d.id = doctor_id and d.status = 'approved'))
  or doctor_id = auth.uid() or public.is_admin());
drop policy if exists p_case_upd on public.cases;
create policy p_case_upd on public.cases for update using (doctor_id = auth.uid() or public.is_admin());
drop policy if exists p_case_del on public.cases;
create policy p_case_del on public.cases for delete using (doctor_id = auth.uid() or public.is_admin());
drop policy if exists p_rep_ins on public.reports;
create policy p_rep_ins on public.reports for insert to anon, authenticated with check (true);
drop policy if exists p_rep_sel on public.reports;
create policy p_rep_sel on public.reports for select using (public.is_admin());
drop policy if exists p_rep_del on public.reports;
create policy p_rep_del on public.reports for delete using (public.is_admin());
drop policy if exists p_clk_ins on public.clicks;
create policy p_clk_ins on public.clicks for insert to anon, authenticated with check (true);
drop policy if exists "media_read" on storage.objects;
create policy "media_read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media_delete_own" on storage.objects;
create policy "media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- القيود الجديدة (الأعمدة المضافة تبقى ولا تضر)
alter table public.doctors drop constraint if exists doctors_photo_url_chk;
alter table public.cases drop constraint if exists cases_after_url_chk;
alter table public.cases drop constraint if exists cases_before_url_chk;
alter table public.reports drop constraint if exists reports_target_chk;
alter table public.clicks drop constraint if exists clicks_kind_check;
alter table public.clicks add constraint clicks_kind_check check (kind in ('view','wa','call','book','share','map'));
drop function if exists public.is_owner_session();
commit;
