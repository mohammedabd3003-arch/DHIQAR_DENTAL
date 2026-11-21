-- =====================================================================
--  بسمة ذي قار — Migration 003: Platform
--  الأدوار، سجل العمليات، التوثيق الرسمي، الحجز، التقييمات، الإشعارات،
--  تحديد المعدّل، تقوية المخازن، القوائم، الاشتراكات (بنية فقط).
--
--  آمن على البيانات: لا DROP TABLE ولا TRUNCATE ولا حذف أعمدة.
--  يُشغَّل مرة واحدة: Supabase > SQL Editor > New query > Run
--  التراجع: 003_platform_down.sql
-- =====================================================================
begin;
set local check_function_bodies = off;

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- 0) جلسة المالك: محرر SQL بلا JWT (للهجرات والإصلاح اليدوي فقط)
-- ---------------------------------------------------------------------
create or replace function public.is_owner_session()
returns boolean language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '') is null
     and nullif(current_setting('request.jwt.claim.role', true), '') is null
     and nullif(current_setting('request.jwt.claim.sub', true), '') is null;
$$;

-- ---------------------------------------------------------------------
-- 1) الأدوار
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('patient','doctor','moderator','admin','super_admin'));
alter table public.profiles alter column role set default 'patient';
alter table public.profiles add column if not exists full_name text check (full_name is null or length(full_name) <= 80);
alter table public.profiles add column if not exists phone text check (phone is null or length(phone) <= 20);

-- المدير الحالي يصبح المدير الأعلى
update public.profiles set role = 'super_admin' where role = 'admin';

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','super_admin'));
$$;
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator','admin','super_admin'));
$$;
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$;

create or replace function public.guard_profile()
returns trigger language plpgsql as $$
begin
  if public.is_owner_session() or current_setting('basma.sys', true) = 'on' then return new; end if;
  if new.id <> old.id then raise exception 'لا يمكن تغيير المعرّف'; end if;
  if new.role <> old.role then
    if not public.is_super_admin() then raise exception 'تغيير الأدوار للمدير الأعلى فقط'; end if;
    if new.id = auth.uid() then raise exception 'لا يمكنك تغيير دورك بنفسك'; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

drop policy if exists p_profiles_upd on public.profiles;
create policy p_profiles_upd on public.profiles for update
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

-- ---------------------------------------------------------------------
-- 2) سجل العمليات (غير قابل للتعديل أو الحذف من الواجهة)
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
alter table public.audit_logs enable row level security;
drop policy if exists p_audit_sel on public.audit_logs;
create policy p_audit_sel on public.audit_logs for select using (public.is_admin());

create or replace function public.log_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, details)
  values (auth.uid(), coalesce(public.my_role(), case when public.is_owner_session() then 'owner_sql' else 'anon' end),
          p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
end $$;
revoke execute on function public.log_audit(text,text,text,jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) الإشعارات داخل المنصة
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  type text not null,
  title text not null check (length(title) <= 140),
  body text check (body is null or length(body) <= 600),
  link text check (link is null or link ~ '^#/'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists p_notif_sel on public.notifications;
create policy p_notif_sel on public.notifications for select using (user_id = auth.uid());
drop policy if exists p_notif_upd on public.notifications;
create policy p_notif_upd on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists p_notif_del on public.notifications;
create policy p_notif_del on public.notifications for delete using (user_id = auth.uid());

create or replace function public.guard_notification()
returns trigger language plpgsql as $$
begin
  if public.is_owner_session() then return new; end if;
  if (new.user_id, new.type, new.title, coalesce(new.body,''), coalesce(new.link,''), new.created_at)
     is distinct from (old.user_id, old.type, old.title, coalesce(old.body,''), coalesce(old.link,''), old.created_at) then
    raise exception 'يمكن تعديل حالة القراءة فقط';
  end if;
  return new;
end $$;
drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard before update on public.notifications for each row execute function public.guard_notification();

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text default null, p_link text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link);
end $$;
revoke execute on function public.notify(uuid,text,text,text,text) from public, anon, authenticated;

create or replace function public.notify_staff(p_type text, p_title text, p_body text default null, p_link text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select id, p_type, p_title, p_body, p_link from public.profiles where role in ('admin','super_admin');
end $$;
revoke execute on function public.notify_staff(text,text,text,text) from public, anon, authenticated;

create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

create or replace function public.admin_broadcast(p_title text, p_body text, p_target text default 'doctors')
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'للإدارة فقط'; end if;
  if length(coalesce(p_title,'')) < 2 then raise exception 'العنوان مطلوب'; end if;
  insert into public.notifications (user_id, type, title, body)
  select p.id, 'admin', p_title, p_body from public.profiles p
  where p_target = 'all' or (p_target = 'doctors' and exists (select 1 from public.doctors d where d.id = p.id));
  get diagnostics n = row_count;
  perform public.log_audit('broadcast', 'notifications', null, jsonb_build_object('title', p_title, 'target', p_target, 'count', n));
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 4) الأطباء: أعمدة جديدة + تحديث الحماية + إشعارات + سجل
-- ---------------------------------------------------------------------
alter table public.doctors add column if not exists slug text;
alter table public.doctors add column if not exists verified_at timestamptz;
alter table public.doctors add column if not exists verified_by uuid;
alter table public.doctors add column if not exists booking_enabled boolean not null default false;
alter table public.doctors add column if not exists slot_minutes integer not null default 20;
alter table public.doctors add column if not exists booking_note text;
alter table public.doctors add column if not exists title text;
do $$ begin
  alter table public.doctors add constraint doctors_slot_minutes_chk check (slot_minutes between 10 and 120);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.doctors add constraint doctors_slug_chk check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.doctors add constraint doctors_title_chk check (title is null or length(title) <= 60);
exception when duplicate_object then null; end $$;
create unique index if not exists doctors_slug_uidx on public.doctors (lower(slug)) where slug is not null;
create index if not exists doctors_status_idx on public.doctors (status);
create index if not exists doctors_area_spec_idx on public.doctors (area, spec);

-- روابط الصور محصورة بمخزن المشروع (للسجلات الجديدة؛ القديمة لا تتأثر)
do $$ begin
  alter table public.doctors add constraint doctors_photo_url_chk
    check (photo_url is null or photo_url = '' or photo_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/media/') not valid;
exception when duplicate_object then null; end $$;

create or replace function public.protect_doctor()
returns trigger language plpgsql as $$
begin
  if public.is_owner_session() then new.updated_at := now(); return new; end if;
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending'; new.verified := false; new.featured := false; new.created_at := now();
      new.verified_at := null; new.verified_by := null;
    else
      new.id := old.id; new.status := old.status; new.verified := old.verified; new.featured := old.featured;
      new.created_at := old.created_at; new.verified_at := old.verified_at; new.verified_by := old.verified_by;
    end if;
  else
    if tg_op = 'UPDATE' and new.verified and not old.verified then new.verified_at := now(); new.verified_by := auth.uid(); end if;
    if tg_op = 'UPDATE' and not new.verified and old.verified then new.verified_at := null; new.verified_by := null; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.doctor_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform set_config('basma.sys', 'on', true);
    update public.profiles set role = 'doctor' where id = new.id and role = 'patient';
    perform set_config('basma.sys', 'off', true);
    perform public.notify_staff('doctor_request', 'طلب انضمام جديد: ' || new.name, coalesce(new.spec,'') || ' · ' || coalesce(new.area,''), '#/admin');
    return new;
  end if;
  if tg_op = 'DELETE' then
    perform public.log_audit('doctor.delete', 'doctors', old.id::text, jsonb_build_object('name', old.name));
    return old;
  end if;
  if new.status is distinct from old.status then
    perform public.log_audit('doctor.status', 'doctors', new.id::text, jsonb_build_object('from', old.status, 'to', new.status, 'name', new.name));
    perform public.notify(new.id, 'doctor_status',
      case new.status when 'approved' then (case when old.status = 'suspended' then 'أُعيد تفعيل صفحتك' else 'تمت الموافقة على صفحتك 🎉' end)
                      when 'rejected' then 'لم تتم الموافقة على طلبك'
                      when 'suspended' then 'تم إيقاف صفحتك مؤقتاً'
                      else 'تغيّرت حالة صفحتك' end,
      case new.status when 'approved' then 'صفحتك ظاهرة الآن للمرضى في الدليل.' else 'راجع الإدارة لمزيد من التفاصيل.' end,
      '#/dash');
  end if;
  if new.verified is distinct from old.verified then
    perform public.log_audit(case when new.verified then 'doctor.verify' else 'doctor.unverify' end, 'doctors', new.id::text, jsonb_build_object('name', new.name));
  end if;
  if new.featured is distinct from old.featured then
    perform public.log_audit(case when new.featured then 'doctor.feature' else 'doctor.unfeature' end, 'doctors', new.id::text, jsonb_build_object('name', new.name));
  end if;
  return new;
end $$;
drop trigger if exists doctors_after on public.doctors;
create trigger doctors_after after insert or update or delete on public.doctors for each row execute function public.doctor_after_change();

-- ---------------------------------------------------------------------
-- 5) الحالات: موافقة المريض، الإشراف للمشرفين، روابط محصورة
-- ---------------------------------------------------------------------
alter table public.cases add column if not exists consent_confirmed boolean not null default false;
alter table public.cases add column if not exists consent_at timestamptz;
alter table public.cases add column if not exists consent_version text;
alter table public.cases add column if not exists hidden_reason text;
alter table public.cases add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table public.cases add constraint cases_after_url_chk
    check (after_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/media/') not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.cases add constraint cases_before_url_chk
    check (before_url is null or before_url = '' or before_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/media/') not valid;
exception when duplicate_object then null; end $$;

create or replace function public.protect_case()
returns trigger language plpgsql as $$
begin
  if public.is_owner_session() then return new; end if;
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      if not new.consent_confirmed then raise exception 'يجب تأكيد موافقة المريض على النشر'; end if;
      new.hidden := false; new.hidden_reason := null; new.created_at := now(); new.consent_at := now();
    else
      new.hidden := old.hidden; new.hidden_reason := old.hidden_reason; new.doctor_id := old.doctor_id;
      new.created_at := old.created_at; new.consent_confirmed := old.consent_confirmed; new.consent_at := old.consent_at;
      new.before_url := old.before_url; new.after_url := old.after_url;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.case_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.hidden is distinct from old.hidden then
    perform public.log_audit(case when new.hidden then 'case.hide' else 'case.unhide' end, 'cases', new.id::text,
      jsonb_build_object('title', new.title, 'reason', new.hidden_reason));
    if new.hidden then
      perform public.notify(new.doctor_id, 'case_hidden', 'أخفت الإدارة إحدى حالاتك', coalesce(new.title,'') || coalesce(' — ' || new.hidden_reason, ''), '#/dash');
    end if;
  elsif tg_op = 'DELETE' and old.doctor_id is distinct from auth.uid() then
    perform public.log_audit('case.delete', 'cases', old.id::text, jsonb_build_object('title', old.title, 'doctor', old.doctor_id));
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists cases_after on public.cases;
create trigger cases_after after update or delete on public.cases for each row execute function public.case_after_change();

drop policy if exists p_case_upd on public.cases;
create policy p_case_upd on public.cases for update using (doctor_id = auth.uid() or public.is_staff());
drop policy if exists p_case_del on public.cases;
create policy p_case_del on public.cases for delete using (doctor_id = auth.uid() or public.is_staff());
drop policy if exists p_case_sel on public.cases;
create policy p_case_sel on public.cases for select using (
  (not hidden and exists (select 1 from public.doctors d where d.id = doctor_id and d.status = 'approved'))
  or doctor_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------
-- 6) التوثيق المهني الرسمي
-- ---------------------------------------------------------------------
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors on delete cascade,
  documents text[] not null default '{}',
  doctor_note text check (doctor_note is null or length(doctor_note) <= 600),
  status text not null default 'pending' check (status in ('pending','approved','rejected','needs_info')),
  review_note text check (review_note is null or length(review_note) <= 600),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists verification_open_uidx on public.verification_requests (doctor_id) where status in ('pending','needs_info');
alter table public.verification_requests enable row level security;
drop policy if exists p_ver_sel on public.verification_requests;
create policy p_ver_sel on public.verification_requests for select using (doctor_id = auth.uid() or public.is_admin());
drop policy if exists p_ver_ins on public.verification_requests;
create policy p_ver_ins on public.verification_requests for insert with check (doctor_id = auth.uid());
drop policy if exists p_ver_upd on public.verification_requests;
create policy p_ver_upd on public.verification_requests for update
  using ((doctor_id = auth.uid() and status = 'needs_info') or public.is_admin())
  with check (doctor_id = auth.uid() or public.is_admin());

create or replace function public.guard_verification()
returns trigger language plpgsql as $$
declare p text;
begin
  if public.is_owner_session() then return new; end if;
  if not public.is_admin() then
    if array_length(new.documents, 1) is null then raise exception 'أرفق مستنداً واحداً على الأقل'; end if;
    foreach p in array new.documents loop
      if p not like auth.uid()::text || '/%' then raise exception 'مسار مستند غير مسموح'; end if;
    end loop;
    new.status := 'pending'; new.review_note := case when tg_op = 'UPDATE' then old.review_note end;
    new.reviewed_by := null; new.reviewed_at := null;
    if tg_op = 'UPDATE' then new.doctor_id := old.doctor_id; new.created_at := old.created_at; end if;
  else
    if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status <> 'pending' then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists verification_guard on public.verification_requests;
create trigger verification_guard before insert or update on public.verification_requests for each row execute function public.guard_verification();

create or replace function public.verification_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare dname text;
begin
  select name into dname from public.doctors where id = new.doctor_id;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.status = 'pending' and old.status = 'needs_info') then
    perform public.notify_staff('verification_request', 'طلب توثيق: ' || coalesce(dname,''), null, '#/admin');
    return new;
  end if;
  if new.status is distinct from old.status then
    perform public.log_audit('verification.' || new.status, 'verification_requests', new.id::text,
      jsonb_build_object('doctor', new.doctor_id, 'name', dname, 'note', new.review_note));
    if new.status = 'approved' then
      update public.doctors set verified = true where id = new.doctor_id;
      perform public.notify(new.doctor_id, 'verification', 'تم توثيق حسابك ✓', 'ظهرت شارة التوثيق في صفحتك.', '#/dash');
    elsif new.status = 'rejected' then
      perform public.notify(new.doctor_id, 'verification', 'رُفض طلب التوثيق', new.review_note, '#/dash');
    elsif new.status = 'needs_info' then
      perform public.notify(new.doctor_id, 'verification', 'الإدارة تطلب مستندات إضافية', new.review_note, '#/dash');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists verification_after on public.verification_requests;
create trigger verification_after after insert or update on public.verification_requests for each row execute function public.verification_after();

-- نقل الهويات المرفوعة سابقاً إلى طلبات توثيق مفتوحة
insert into public.verification_requests (doctor_id, documents, doctor_note)
select d.id, array[d.license_url], 'منقول تلقائياً من الإصدار السابق'
from public.doctors d
where d.license_url is not null and d.license_url <> '' and not d.verified
  and not exists (select 1 from public.verification_requests v where v.doctor_id = d.id);

-- ---------------------------------------------------------------------
-- 7) القوائم القابلة للإدارة
-- ---------------------------------------------------------------------
create table if not exists public.areas (
  id serial primary key, name text not null unique check (length(name) between 2 and 60),
  governorate text not null default 'ذي قار', sort integer not null default 100, active boolean not null default true);
create table if not exists public.specializations (
  id serial primary key, name text not null unique check (length(name) between 2 and 60),
  sort integer not null default 100, active boolean not null default true);
create table if not exists public.case_categories (
  id serial primary key, name text not null unique check (length(name) between 2 and 60),
  sort integer not null default 100, active boolean not null default true);
insert into public.areas (name, sort) select x, i from unnest(array['الناصرية','الشطرة','الرفاعي','سوق الشيوخ','الغراف','قلعة سكر','الجبايش','النصر','الدواية','البطحاء','الفجر','الإصلاح','سيد دخيل','الفهود','الطار','كرمة بني سعيد','العكيكة']) with ordinality t(x, i) on conflict (name) do nothing;
insert into public.specializations (name, sort) select x, i from unnest(array['طب أسنان عام','تقويم الأسنان','زراعة الأسنان','تجميل وتركيبات','علاج الجذور','أسنان الأطفال','جراحة الفم والفكين','أمراض اللثة']) with ordinality t(x, i) on conflict (name) do nothing;
insert into public.case_categories (name, sort) select x, i from unnest(array['تقويم','زراعة','تجميل','تبييض','فينير','علاج عصب','حشوات','تركيبات','جراحة','أطفال','لثة']) with ordinality t(x, i) on conflict (name) do nothing;
do $$ declare t text; begin
  foreach t in array array['areas','specializations','case_categories'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists p_%s_sel on public.%I', t, t);
    execute format('create policy p_%s_sel on public.%I for select using (active or public.is_admin())', t, t);
    execute format('drop policy if exists p_%s_all on public.%I', t, t);
    execute format('create policy p_%s_all on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- إعدادات المنصة
create table if not exists public.platform_settings (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid);
insert into public.platform_settings (key, value, is_public) values ('announcement', '{"active":false,"text":""}', true) on conflict do nothing;
alter table public.platform_settings enable row level security;
drop policy if exists p_set_sel on public.platform_settings;
create policy p_set_sel on public.platform_settings for select using (is_public or public.is_admin());
drop policy if exists p_set_all on public.platform_settings;
create policy p_set_all on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 8) الحجز الداخلي
-- ---------------------------------------------------------------------
create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors on delete cascade,
  starts_on date not null, ends_on date not null,
  note text check (note is null or length(note) <= 120),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 90));
create index if not exists time_off_doc_idx on public.time_off (doctor_id, starts_on);
alter table public.time_off enable row level security;
drop policy if exists p_off_sel on public.time_off;
create policy p_off_sel on public.time_off for select using (doctor_id = auth.uid() or public.is_admin());
drop policy if exists p_off_ins on public.time_off;
create policy p_off_ins on public.time_off for insert with check (doctor_id = auth.uid());
drop policy if exists p_off_del on public.time_off;
create policy p_off_del on public.time_off for delete using (doctor_id = auth.uid() or public.is_admin());

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  doctor_id uuid not null references public.doctors on delete cascade,
  patient_id uuid references auth.users on delete set null,
  patient_name text not null check (length(patient_name) between 2 and 60),
  patient_phone text not null check (patient_phone ~ '^07[0-9]{9}$'),
  note text check (note is null or length(note) <= 300),
  start_at timestamptz not null,
  end_at timestamptz not null,
  period tstzrange generated always as (tstzrange(start_at, end_at, '[)')) stored,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled','completed','no_show')),
  proposed_start_at timestamptz,
  doctor_note text check (doctor_note is null or length(doctor_note) <= 300),
  cancelled_by text check (cancelled_by is null or cancelled_by in ('patient','doctor','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  constraint bookings_no_overlap exclude using gist (doctor_id with =, period with &&) where (status in ('pending','confirmed'))
);
create index if not exists bookings_doc_idx on public.bookings (doctor_id, start_at);
create index if not exists bookings_patient_idx on public.bookings (patient_id, start_at desc);
create index if not exists bookings_phone_idx on public.bookings (patient_phone, created_at desc);
alter table public.bookings enable row level security;
drop policy if exists p_book_sel on public.bookings;
create policy p_book_sel on public.bookings for select using (doctor_id = auth.uid() or patient_id = auth.uid() or public.is_admin());
-- لا توجد سياسات إدراج/تعديل/حذف: كل العمليات عبر دوال مضبوطة أدناه

create or replace function public.norm_phone(p text)
returns text language sql immutable as $$
  select case
    when d ~ '^9647[0-9]{9}$' then '0' || substr(d, 4)
    when d ~ '^7[0-9]{9}$' then '0' || d
    else d end
  from (select regexp_replace(translate(coalesce(p,''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g') as d) s;
$$;

create or replace function public.doctor_window(p_doctor uuid, p_day date)
returns table (win_start timestamptz, win_end timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare d public.doctors; s timestamptz; e timestamptz;
begin
  select * into d from public.doctors where id = p_doctor;
  if not found or d.open_from is null or d.open_to is null or d.open_from !~ '^\d{1,2}:\d{2}' or d.open_to !~ '^\d{1,2}:\d{2}' then return; end if;
  if not (extract(dow from p_day)::int = any(d.days)) then return; end if;
  if exists (select 1 from public.time_off t where t.doctor_id = p_doctor and p_day between t.starts_on and t.ends_on) then return; end if;
  s := (p_day + d.open_from::time) at time zone 'Asia/Baghdad';
  e := (p_day + d.open_to::time) at time zone 'Asia/Baghdad';
  if e <= s then e := e + interval '1 day'; end if;
  win_start := s; win_end := e; return next;
end $$;

create or replace function public.available_slots(p_doctor uuid, p_day date)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare d public.doctors; w record; step interval;
begin
  select * into d from public.doctors where id = p_doctor and status = 'approved' and booking_enabled;
  if not found then return; end if;
  if p_day < (now() at time zone 'Asia/Baghdad')::date or p_day > (now() at time zone 'Asia/Baghdad')::date + 60 then return; end if;
  step := make_interval(mins => d.slot_minutes);
  for w in select * from public.doctor_window(p_doctor, p_day) loop
    return query
      select g, g + step from generate_series(w.win_start, w.win_end - step, step) g
      where g >= now() + interval '30 minutes'
        and not exists (select 1 from public.bookings b where b.doctor_id = p_doctor and b.status in ('pending','confirmed')
                          and b.period && tstzrange(g, g + step, '[)'))
      order by g;
  end loop;
end $$;

create or replace function public.create_booking(p_doctor uuid, p_start timestamptz, p_name text, p_phone text, p_note text default null)
returns table (token uuid, booking_id uuid, start_at timestamptz, status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare d public.doctors; ph text := public.norm_phone(p_phone); nm text := btrim(coalesce(p_name,'')); b public.bookings;
begin
  select * into d from public.doctors where id = p_doctor and status = 'approved' and booking_enabled;
  if not found then raise exception 'الحجز غير متاح لهذا الطبيب'; end if;
  if length(nm) < 2 or length(nm) > 60 then raise exception 'اكتب اسمك (حرفان على الأقل)'; end if;
  if ph !~ '^07[0-9]{9}$' then raise exception 'رقم الهاتف غير صحيح، اكتبه بصيغة 07xxxxxxxxx'; end if;
  if not exists (select 1 from public.available_slots(p_doctor, (p_start at time zone 'Asia/Baghdad')::date) s where s.slot_start = p_start) then
    raise exception 'هذا الموعد لم يعد متاحاً، اختر موعداً آخر';
  end if;
  if (select count(*) from public.bookings x where x.patient_phone = ph and x.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'تجاوزت عدد طلبات الحجز المسموح اليوم';
  end if;
  if (select count(*) from public.bookings x where x.patient_phone = ph and x.doctor_id = p_doctor and x.status in ('pending','confirmed') and x.start_at > now()) >= 2 then
    raise exception 'لديك حجزان قائمان مع هذا الطبيب';
  end if;
  begin
    insert into public.bookings (doctor_id, patient_id, patient_name, patient_phone, note, start_at, end_at)
    values (p_doctor, auth.uid(), nm, ph, nullif(btrim(coalesce(p_note,'')),''), p_start, p_start + make_interval(mins => d.slot_minutes))
    returning * into b;
  exception when exclusion_violation then
    raise exception 'سبقك أحد إلى هذا الموعد، اختر موعداً آخر';
  end;
  insert into public.clicks (doctor_id, kind) values (p_doctor, 'book');
  perform public.notify(p_doctor, 'booking_new', 'طلب حجز جديد من ' || nm,
    to_char(p_start at time zone 'Asia/Baghdad', 'YYYY-MM-DD HH24:MI'), '#/dash');
  return query select b.token, b.id, b.start_at, b.status;
end $$;

create or replace function public.get_booking(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'status', b.status, 'start_at', b.start_at, 'end_at', b.end_at, 'proposed_start_at', b.proposed_start_at,
    'doctor_note', b.doctor_note, 'patient_name', b.patient_name, 'note', b.note, 'created_at', b.created_at,
    'doctor', jsonb_build_object('id', d.id, 'slug', d.slug, 'name', d.name, 'spec', d.spec, 'clinic', d.clinic, 'area', d.area,
                                 'address', d.address, 'phone', d.phone, 'whatsapp', d.whatsapp, 'lat', d.lat, 'lng', d.lng, 'photo_url', d.photo_url),
    'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment) from public.reviews r where r.booking_id = b.id))
  from public.bookings b join public.doctors d on d.id = b.doctor_id where b.token = p_token;
$$;

create or replace function public.cancel_booking(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where token = p_token for update;
  if not found then raise exception 'الحجز غير موجود'; end if;
  if b.status not in ('pending','confirmed') or b.start_at <= now() then raise exception 'لا يمكن إلغاء هذا الحجز'; end if;
  update public.bookings set status = 'cancelled', cancelled_by = 'patient', updated_at = now() where id = b.id;
  perform public.notify(b.doctor_id, 'booking_cancelled', 'ألغى ' || b.patient_name || ' حجزه',
    to_char(b.start_at at time zone 'Asia/Baghdad', 'YYYY-MM-DD HH24:MI'), '#/dash');
  return 'cancelled';
end $$;

create or replace function public.accept_proposal(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare b public.bookings; d public.doctors;
begin
  select * into b from public.bookings where token = p_token for update;
  if not found or b.proposed_start_at is null or b.status <> 'pending' then raise exception 'لا يوجد موعد بديل مقترح'; end if;
  if b.proposed_start_at <= now() then raise exception 'انتهى وقت الموعد المقترح'; end if;
  select * into d from public.doctors where id = b.doctor_id;
  begin
    update public.bookings set start_at = b.proposed_start_at, end_at = b.proposed_start_at + make_interval(mins => d.slot_minutes),
      proposed_start_at = null, status = 'confirmed', updated_at = now() where id = b.id;
  exception when exclusion_violation then raise exception 'الموعد المقترح لم يعد متاحاً'; end;
  perform public.notify(b.doctor_id, 'booking_accepted', b.patient_name || ' وافق على الموعد البديل', null, '#/dash');
  return 'confirmed';
end $$;

create or replace function public.doctor_booking_action(p_id uuid, p_action text, p_note text default null, p_new_start timestamptz default null)
returns text language plpgsql security definer set search_path = public as $$
declare b public.bookings; d public.doctors; new_status text; msg text;
begin
  select * into b from public.bookings where id = p_id for update;
  if not found then raise exception 'الحجز غير موجود'; end if;
  if b.doctor_id <> auth.uid() and not public.is_admin() then raise exception 'غير مسموح'; end if;
  select * into d from public.doctors where id = b.doctor_id;
  if p_note is not null and length(p_note) > 300 then raise exception 'الملاحظة طويلة'; end if;
  case p_action
    when 'confirm' then
      if b.status <> 'pending' then raise exception 'لا يمكن التأكيد'; end if;
      new_status := 'confirmed'; msg := 'تم تأكيد موعدك';
      update public.bookings set status = 'confirmed', proposed_start_at = null, doctor_note = coalesce(p_note, doctor_note), updated_at = now() where id = b.id;
    when 'reject' then
      if b.status <> 'pending' then raise exception 'لا يمكن الرفض'; end if;
      new_status := 'rejected'; msg := 'تعذّر قبول طلب الحجز';
      update public.bookings set status = 'rejected', doctor_note = coalesce(p_note, doctor_note), updated_at = now() where id = b.id;
    when 'propose' then
      if b.status not in ('pending','confirmed') or p_new_start is null or p_new_start <= now() then raise exception 'اختر موعداً مستقبلياً'; end if;
      new_status := 'pending'; msg := 'اقترح الطبيب موعداً بديلاً';
      update public.bookings set status = 'pending', proposed_start_at = p_new_start, doctor_note = coalesce(p_note, doctor_note), updated_at = now() where id = b.id;
    when 'reschedule' then
      if b.status not in ('pending','confirmed') or p_new_start is null or p_new_start <= now() then raise exception 'اختر موعداً مستقبلياً'; end if;
      new_status := 'confirmed'; msg := 'تم تغيير موعدك';
      begin
        update public.bookings set start_at = p_new_start, end_at = p_new_start + make_interval(mins => d.slot_minutes), status = 'confirmed',
          proposed_start_at = null, doctor_note = coalesce(p_note, doctor_note), updated_at = now() where id = b.id;
      exception when exclusion_violation then raise exception 'يتداخل مع حجز آخر'; end;
    when 'complete' then
      if b.status <> 'confirmed' or b.start_at > now() then raise exception 'يمكن إكمال الموعد المؤكد بعد وقته فقط'; end if;
      new_status := 'completed'; msg := 'شكراً لزيارتك، يمكنك تقييم الطبيب الآن';
      update public.bookings set status = 'completed', updated_at = now() where id = b.id;
    when 'no_show' then
      if b.status <> 'confirmed' or b.start_at > now() then raise exception 'غير ممكن قبل وقت الموعد'; end if;
      new_status := 'no_show'; msg := 'سُجّل عدم الحضور';
      update public.bookings set status = 'no_show', updated_at = now() where id = b.id;
    when 'cancel' then
      if b.status not in ('pending','confirmed') then raise exception 'لا يمكن الإلغاء'; end if;
      new_status := 'cancelled'; msg := 'ألغى الطبيب الموعد';
      update public.bookings set status = 'cancelled', cancelled_by = case when b.doctor_id = auth.uid() then 'doctor' else 'admin' end,
        doctor_note = coalesce(p_note, doctor_note), updated_at = now() where id = b.id;
    else raise exception 'إجراء غير معروف';
  end case;
  perform public.notify(b.patient_id, 'booking_' || p_action, msg || ' — ' || d.name, p_note, '#/b/' || b.token::text);
  return new_status;
end $$;

-- ---------------------------------------------------------------------
-- 9) التقييمات (بعد حجز مكتمل فقط، تقييم واحد لكل حجز)
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings on delete cascade,
  doctor_id uuid not null references public.doctors on delete cascade,
  patient_id uuid references auth.users on delete set null,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 600),
  status text not null default 'published' check (status in ('published','hidden')),
  hidden_reason text,
  created_at timestamptz not null default now()
);
create index if not exists reviews_doc_idx on public.reviews (doctor_id, created_at desc);
alter table public.reviews enable row level security;
drop policy if exists p_rev_sel on public.reviews;
create policy p_rev_sel on public.reviews for select using (status = 'published' or doctor_id = auth.uid() or public.is_staff());
drop policy if exists p_rev_upd on public.reviews;
create policy p_rev_upd on public.reviews for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists p_rev_del on public.reviews;
create policy p_rev_del on public.reviews for delete using (public.is_admin());

create or replace function public.guard_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_owner_session() then return new; end if;
  if (new.booking_id, new.doctor_id, new.rating, coalesce(new.comment,''), new.author_name, new.created_at)
     is distinct from (old.booking_id, old.doctor_id, old.rating, coalesce(old.comment,''), old.author_name, old.created_at) then
    raise exception 'لا يمكن تعديل محتوى التقييم';
  end if;
  if new.status is distinct from old.status then
    perform public.log_audit('review.' || new.status, 'reviews', new.id::text, jsonb_build_object('reason', new.hidden_reason));
  end if;
  return new;
end $$;
drop trigger if exists reviews_guard on public.reviews;
create trigger reviews_guard before update on public.reviews for each row execute function public.guard_review();

create or replace function public.add_review(p_token uuid, p_rating integer, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare b public.bookings; rid uuid;
begin
  select * into b from public.bookings where token = p_token;
  if not found then raise exception 'الحجز غير موجود'; end if;
  if b.status <> 'completed' then raise exception 'يمكن التقييم بعد إتمام الموعد فقط'; end if;
  if b.start_at < now() - interval '90 days' then raise exception 'انتهت مدة التقييم'; end if;
  if p_rating not between 1 and 5 then raise exception 'التقييم من 1 إلى 5'; end if;
  if exists (select 1 from public.reviews where booking_id = b.id) then raise exception 'قيّمت هذا الموعد مسبقاً'; end if;
  insert into public.reviews (booking_id, doctor_id, patient_id, author_name, rating, comment)
  values (b.id, b.doctor_id, b.patient_id, split_part(b.patient_name, ' ', 1), p_rating, nullif(btrim(coalesce(p_comment,'')), ''))
  returning id into rid;
  perform public.notify(b.doctor_id, 'review_new', 'تقييم جديد: ' || repeat('★', p_rating), left(p_comment, 140), '#/dash');
  return rid;
end $$;

create or replace view public.doctor_ratings as
  select doctor_id, round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as review_count,
         count(*) filter (where rating = 5)::int as r5, count(*) filter (where rating = 4)::int as r4,
         count(*) filter (where rating = 3)::int as r3, count(*) filter (where rating = 2)::int as r2,
         count(*) filter (where rating = 1)::int as r1
  from public.reviews where status = 'published' group by doctor_id;
grant select on public.doctor_ratings to anon, authenticated;

-- ---------------------------------------------------------------------
-- 10) البلاغات والنقرات: عبر دوال محدودة المعدّل بدل الإدراج المفتوح
-- ---------------------------------------------------------------------
alter table public.reports add column if not exists review_id uuid references public.reviews on delete cascade;
alter table public.reports add column if not exists session_key text;
do $$ begin
  alter table public.reports add constraint reports_target_chk check ((case_id is not null) <> (review_id is not null)) not valid;
exception when duplicate_object then null; end $$;
drop policy if exists p_rep_ins on public.reports;
drop policy if exists p_rep_sel on public.reports;
create policy p_rep_sel on public.reports for select using (public.is_staff());
drop policy if exists p_rep_del on public.reports;
create policy p_rep_del on public.reports for delete using (public.is_staff());

create or replace function public.submit_report(p_case uuid, p_review uuid, p_reason text, p_session text)
returns void language plpgsql security definer set search_path = public as $$
declare k text := left(coalesce(nullif(p_session,''), 'anon'), 64);
begin
  if (p_case is null) = (p_review is null) then raise exception 'حدد المحتوى المُبلغ عنه'; end if;
  if length(btrim(coalesce(p_reason,''))) < 2 or length(p_reason) > 300 then raise exception 'اكتب سبب البلاغ'; end if;
  if exists (select 1 from public.reports where session_key = k and (case_id = p_case or review_id = p_review)) then
    raise exception 'أبلغت عن هذا المحتوى مسبقاً'; end if;
  if (select count(*) from public.reports where session_key = k and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'تجاوزت عدد البلاغات المسموح اليوم'; end if;
  insert into public.reports (case_id, review_id, reason, session_key) values (p_case, p_review, btrim(p_reason), k);
  perform public.notify_staff('report', 'بلاغ جديد', btrim(p_reason), '#/admin');
end $$;

alter table public.clicks drop constraint if exists clicks_kind_check;
alter table public.clicks add constraint clicks_kind_check check (kind in ('view','wa','call','book','share','map'));
alter table public.clicks add column if not exists session_key text;
drop policy if exists p_clk_ins on public.clicks;

create or replace function public.log_event(p_doctor uuid, p_kind text, p_session text)
returns void language plpgsql security definer set search_path = public as $$
declare k text := left(coalesce(nullif(p_session,''), 'anon'), 64);
begin
  if p_kind not in ('view','wa','call','share','map') then return; end if;
  if p_doctor = auth.uid() then return; end if;
  if not exists (select 1 from public.doctors where id = p_doctor and status = 'approved') then return; end if;
  if exists (select 1 from public.clicks where doctor_id = p_doctor and kind = p_kind and session_key = k and created_at > now() - interval '30 minutes') then return; end if;
  if (select count(*) from public.clicks where session_key = k and created_at > now() - interval '1 hour') >= 120 then return; end if;
  insert into public.clicks (doctor_id, kind, session_key) values (p_doctor, p_kind, k);
end $$;

create or replace function public.doctor_stats(p_days integer default 30, p_doctor uuid default null)
returns table (day date, views int, wa int, calls int, books int, shares int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare did uuid := coalesce(p_doctor, auth.uid());
begin
  if did <> auth.uid() and not public.is_admin() then raise exception 'غير مسموح'; end if;
  return query
    select g::date,
      count(*) filter (where c.kind = 'view')::int, count(*) filter (where c.kind = 'wa')::int,
      count(*) filter (where c.kind = 'call')::int, count(*) filter (where c.kind = 'book')::int,
      count(*) filter (where c.kind = 'share')::int
    from generate_series(((now() at time zone 'Asia/Baghdad')::date - (least(greatest(p_days,1),365) - 1)), (now() at time zone 'Asia/Baghdad')::date, interval '1 day') g
    left join public.clicks c on c.doctor_id = did and (c.created_at at time zone 'Asia/Baghdad')::date = g::date
    group by g order by g;
end $$;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'غير مسموح'; end if;
  return jsonb_build_object(
    'doctors_total', (select count(*) from public.doctors),
    'doctors_approved', (select count(*) from public.doctors where status = 'approved'),
    'doctors_verified', (select count(*) from public.doctors where verified),
    'doctors_pending', (select count(*) from public.doctors where status = 'pending'),
    'verification_open', (select count(*) from public.verification_requests where status = 'pending'),
    'cases', (select count(*) from public.cases),
    'users', (select count(*) from public.profiles),
    'patients', (select count(*) from public.profiles where role = 'patient'),
    'bookings_30d', (select count(*) from public.bookings where created_at > now() - interval '30 days'),
    'bookings_pending', (select count(*) from public.bookings where status = 'pending' and start_at > now()),
    'reports_open', (select count(*) from public.reports),
    'reviews', (select count(*) from public.reviews),
    'views_30d', (select count(*) from public.clicks where kind = 'view' and created_at > now() - interval '30 days'),
    'contacts_30d', (select count(*) from public.clicks where kind in ('wa','call','book') and created_at > now() - interval '30 days'),
    'top_doctors', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select d.name, count(*)::int as n from public.clicks c join public.doctors d on d.id = c.doctor_id
        where c.kind in ('wa','call','book') and c.created_at > now() - interval '30 days' group by d.name order by n desc limit 7) t),
    'by_area', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select area, count(*)::int as n from public.doctors where status = 'approved' group by area order by n desc) t)
  );
end $$;

-- إدارة المستخدمين والأدوار
create or replace function public.admin_list_users(p_search text default null)
returns table (id uuid, email text, role text, full_name text, created_at timestamptz, doctor_name text, doctor_status text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'غير مسموح'; end if;
  return query
    select p.id, u.email::text, p.role, p.full_name, p.created_at, d.name, d.status
    from public.profiles p join auth.users u on u.id = p.id left join public.doctors d on d.id = p.id
    where p_search is null or u.email ilike '%' || p_search || '%' or d.name ilike '%' || p_search || '%'
    order by p.created_at desc limit 200;
end $$;

create or replace function public.set_user_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare old_role text;
begin
  if not public.is_super_admin() then raise exception 'للمدير الأعلى فقط'; end if;
  if p_user = auth.uid() then raise exception 'لا يمكنك تغيير دورك بنفسك'; end if;
  if p_role not in ('patient','doctor','moderator','admin','super_admin') then raise exception 'دور غير معروف'; end if;
  select role into old_role from public.profiles where id = p_user;
  update public.profiles set role = p_role where id = p_user;
  perform public.log_audit('user.role', 'profiles', p_user::text, jsonb_build_object('from', old_role, 'to', p_role));
end $$;

create or replace function public.tips_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_audit('tip.' || lower(tg_op), 'tips', coalesce(new.id, old.id)::text, jsonb_build_object('title', coalesce(new.title, old.title)));
  return coalesce(new, old);
end $$;
drop trigger if exists tips_audit on public.tips;
create trigger tips_audit after insert or update or delete on public.tips for each row execute function public.tips_audit();
alter table public.tips add column if not exists updated_at timestamptz;

create or replace function public.reports_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_audit('report.close', 'reports', old.id::text, jsonb_build_object('reason', old.reason));
  return old;
end $$;
drop trigger if exists reports_audit on public.reports;
create trigger reports_audit after delete on public.reports for each row execute function public.reports_audit();

-- ---------------------------------------------------------------------
-- 11) الاشتراكات (بنية فقط — لا يوجد دفع حتى يُعتمد مزود فعلي)
-- ---------------------------------------------------------------------
create table if not exists public.plans (
  id text primary key check (id ~ '^[a-z_]{2,30}$'),
  name text not null, price_iqd integer not null default 0 check (price_iqd >= 0),
  billing_interval text not null default 'month' check (billing_interval in ('month','year')),
  features jsonb not null default '[]'::jsonb, active boolean not null default false, sort integer not null default 100);
insert into public.plans (id, name, price_iqd, features, active, sort) values
  ('free', 'مجاني', 0, '["صفحة طبيب","حالات قبل وبعد","حجز داخلي","بطاقة QR"]', true, 1),
  ('professional', 'احترافي', 0, '["إحصائيات متقدمة","تقارير شهرية"]', false, 2),
  ('premium', 'مميز', 0, '["ظهور ترويجي معلن","كل مزايا الاحترافي"]', false, 3),
  ('clinic', 'عيادة', 0, '["عدة أطباء في عيادة واحدة","إدارة موحدة"]', false, 4)
on conflict (id) do nothing;
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors on delete cascade,
  plan_id text not null references public.plans,
  status text not null default 'active' check (status in ('trialing','active','past_due','cancelled','expired')),
  starts_at timestamptz not null default now(), ends_at timestamptz, cancel_at timestamptz,
  created_at timestamptz not null default now());
create unique index if not exists subscriptions_active_uidx on public.subscriptions (doctor_id) where status in ('trialing','active','past_due');
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions on delete restrict,
  amount_iqd integer not null check (amount_iqd >= 0),
  provider text, provider_ref text, invoice_no text unique,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  paid_at timestamptz, created_at timestamptz not null default now());
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
drop policy if exists p_plans_sel on public.plans;
create policy p_plans_sel on public.plans for select using (true);
drop policy if exists p_plans_all on public.plans;
create policy p_plans_all on public.plans for all using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists p_subs_sel on public.subscriptions;
create policy p_subs_sel on public.subscriptions for select using (doctor_id = auth.uid() or public.is_admin());
drop policy if exists p_subs_all on public.subscriptions;
create policy p_subs_all on public.subscriptions for all using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists p_pay_sel on public.payments;
create policy p_pay_sel on public.payments for select using (public.is_admin() or exists (select 1 from public.subscriptions s where s.id = subscription_id and s.doctor_id = auth.uid()));
drop policy if exists p_pay_all on public.payments;
create policy p_pay_all on public.payments for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------
-- 12) تقوية المخازن
-- ---------------------------------------------------------------------
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'media';
update storage.buckets set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'] where id = 'licenses';
-- المخزن العام يُقرأ بالرابط المباشر دون سياسة؛ نمنع سرد الملفات لغير أصحابها
drop policy if exists "media_read" on storage.objects;
create policy "media_read" on storage.objects for select to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists "media_delete_own" on storage.objects;
create policy "media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ---------------------------------------------------------------------
-- 13) صلاحيات تنفيذ الدوال العامة
-- ---------------------------------------------------------------------
grant execute on function public.available_slots(uuid, date), public.create_booking(uuid, timestamptz, text, text, text),
  public.get_booking(uuid), public.cancel_booking(uuid), public.accept_proposal(uuid), public.add_review(uuid, integer, text),
  public.submit_report(uuid, uuid, text, text), public.log_event(uuid, text, text) to anon, authenticated;
grant execute on function public.doctor_booking_action(uuid, text, text, timestamptz), public.doctor_stats(integer, uuid),
  public.admin_overview(), public.admin_list_users(text), public.set_user_role(uuid, text),
  public.admin_broadcast(text, text, text), public.mark_all_notifications_read() to authenticated;
revoke execute on function public.doctor_booking_action(uuid, text, text, timestamptz), public.doctor_stats(integer, uuid),
  public.admin_overview(), public.admin_list_users(text), public.set_user_role(uuid, text),
  public.admin_broadcast(text, text, text), public.mark_all_notifications_read() from anon;

insert into public.audit_logs (actor_role, action, entity, details) values ('owner_sql', 'migration.apply', 'schema', '{"version":"003_platform"}');
commit;
