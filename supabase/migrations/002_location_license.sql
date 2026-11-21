-- =====================================================================
--  تحديث بسمة ذي قار: الموقع على الخارطة + هوية النقابة السرّية
--  شغّله مرة واحدة في Supabase > SQL Editor > New query > Run
-- =====================================================================

-- 1) أعمدة جديدة في جدول الأطباء
alter table public.doctors
  add column if not exists lat double precision check (lat between -90 and 90),
  add column if not exists lng double precision check (lng between -180 and 180),
  add column if not exists license_url text;

-- 2) مخزن خاص (غير عام) لصور هويات النقابة
insert into storage.buckets (id, name, public) values ('licenses', 'licenses', false)
  on conflict (id) do update set public = false;

-- الطبيب يرفع داخل مجلده فقط
drop policy if exists "lic_upload_own" on storage.objects;
create policy "lic_upload_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'licenses' and (storage.foldername(name))[1] = auth.uid()::text);

-- يقرأها صاحبها والإدارة فقط (الجمهور لا يصل إليها إطلاقاً)
drop policy if exists "lic_read_own_admin" on storage.objects;
create policy "lic_read_own_admin" on storage.objects for select to authenticated
  using (bucket_id = 'licenses' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "lic_delete_own_admin" on storage.objects;
create policy "lic_delete_own_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'licenses' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
