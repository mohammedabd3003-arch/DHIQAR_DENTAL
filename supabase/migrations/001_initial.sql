-- =====================================================================
--  بسمة ذي قار — قاعدة البيانات (Supabase)
--  الصق هذا الملف كاملاً في: Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- 1) الحسابات والأدوار ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'doctor' check (role in ('doctor','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- 2) الأطباء ----------
create table if not exists public.doctors (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (length(name) between 2 and 80),
  spec text, area text, clinic text, address text, map_url text,
  phone text, whatsapp text,
  days int[] not null default '{}',
  open_from text, open_to text,
  years int, edu text, bio text,
  services text[] not null default '{}',
  photo_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  verified boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- الطبيب لا يستطيع تغيير حالة القبول أو التوثيق أو التمييز بنفسه
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

drop trigger if exists doctors_protect on public.doctors;
create trigger doctors_protect before insert or update on public.doctors
  for each row execute function public.protect_doctor();

-- ---------- 3) الحالات (قبل/بعد) ----------
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors on delete cascade,
  title text not null check (length(title) between 2 and 120),
  cat text, sessions text, note text,
  before_url text, after_url text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists cases_doctor_idx on public.cases (doctor_id);
create index if not exists cases_created_idx on public.cases (created_at desc);

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

drop trigger if exists cases_protect on public.cases;
create trigger cases_protect before insert or update on public.cases
  for each row execute function public.protect_case();

-- ---------- 4) البلاغات، النقرات، التوعية ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases on delete cascade,
  reason text not null check (length(reason) between 2 and 300),
  created_at timestamptz not null default now()
);

create table if not exists public.clicks (
  id bigint generated always as identity primary key,
  doctor_id uuid not null references public.doctors on delete cascade,
  kind text not null check (kind in ('view','wa','call')),
  created_at timestamptz not null default now()
);
create index if not exists clicks_doctor_idx on public.clicks (doctor_id, created_at desc);

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 2 and 120),
  body text not null check (length(body) between 2 and 1200),
  created_at timestamptz not null default now()
);

-- ---------- 5) الصلاحيات (RLS) ----------
alter table public.profiles enable row level security;
alter table public.doctors  enable row level security;
alter table public.cases    enable row level security;
alter table public.reports  enable row level security;
alter table public.clicks   enable row level security;
alter table public.tips     enable row level security;

drop policy if exists p_profiles_sel on public.profiles;
create policy p_profiles_sel on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists p_profiles_upd on public.profiles;
create policy p_profiles_upd on public.profiles for update using (public.is_admin());

drop policy if exists p_doc_sel on public.doctors;
create policy p_doc_sel on public.doctors for select
  using (status = 'approved' or id = auth.uid() or public.is_admin());
drop policy if exists p_doc_ins on public.doctors;
create policy p_doc_ins on public.doctors for insert with check (id = auth.uid());
drop policy if exists p_doc_upd on public.doctors;
create policy p_doc_upd on public.doctors for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists p_doc_del on public.doctors;
create policy p_doc_del on public.doctors for delete using (public.is_admin());

drop policy if exists p_case_sel on public.cases;
create policy p_case_sel on public.cases for select using (
  (not hidden and exists (select 1 from public.doctors d where d.id = doctor_id and d.status = 'approved'))
  or doctor_id = auth.uid() or public.is_admin());
drop policy if exists p_case_ins on public.cases;
create policy p_case_ins on public.cases for insert
  with check (doctor_id = auth.uid() and exists (select 1 from public.doctors where id = auth.uid()));
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
drop policy if exists p_clk_sel on public.clicks;
create policy p_clk_sel on public.clicks for select using (doctor_id = auth.uid() or public.is_admin());

drop policy if exists p_tip_sel on public.tips;
create policy p_tip_sel on public.tips for select using (true);
drop policy if exists p_tip_all on public.tips;
create policy p_tip_all on public.tips for all using (public.is_admin()) with check (public.is_admin());

-- ---------- 6) تخزين الصور ----------
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;

drop policy if exists "media_read" on storage.objects;
create policy "media_read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media_upload_own" on storage.objects;
create policy "media_upload_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media_delete_own" on storage.objects;
create policy "media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- =====================================================================
--  بعد ما تسوي حسابك من التطبيق (تسجيل جديد)، اجعل نفسك مديراً:
--  غيّر الإيميل وشغّل السطر التالي وحده:
--
--  update public.profiles set role = 'admin'
--  where id = (select id from auth.users where email = 'YOUR@EMAIL.com');
-- =====================================================================
