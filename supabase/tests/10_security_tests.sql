-- اختبارات الصلاحيات والوظائف على قاعدة محلية تحاكي Supabase
-- التشغيل: psql -f 00_supabase_stub.sql ثم الهجرات 001..003 ثم هذا الملف
\set ON_ERROR_STOP 1
set client_min_messages = warning;
create table if not exists public._t (n serial, label text, ok boolean, info text);
grant all on public._t to anon, authenticated; grant all on sequence public._t_n_seq to anon, authenticated;
truncate public._t;

-- أدوات الاختبار
create or replace function public._as(p_uid uuid) returns void language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claim.sub', '', false);
    perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  else
    perform set_config('request.jwt.claim.sub', p_uid::text, false);
    perform set_config('request.jwt.claims', json_build_object('role','authenticated','sub',p_uid)::text, false);
  end if;
end $$;
create or replace function public._ok(label text, cond boolean, info text default null) returns void language sql as $$
  insert into public._t(label, ok, info) values (label, coalesce(cond,false), info) $$;
create or replace function public._err(label text, q text) returns void language plpgsql as $$
begin execute q; insert into public._t(label, ok, info) values (label, false, 'لم يحدث خطأ');
exception when others then insert into public._t(label, ok, info) values (label, true, sqlerrm); end $$;
create or replace function public._run(label text, q text) returns void language plpgsql as $$
begin execute q; insert into public._t(label, ok) values (label, true);
exception when others then insert into public._t(label, ok, info) values (label, false, sqlerrm); end $$;
grant execute on all functions in schema public to anon, authenticated;

-- المستخدمون
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1','super@x.iq'), ('00000000-0000-0000-0000-0000000000a2','admin@x.iq'),
 ('00000000-0000-0000-0000-0000000000d1','docA@x.iq'),  ('00000000-0000-0000-0000-0000000000d2','docB@x.iq'),
 ('00000000-0000-0000-0000-0000000000b1','patient@x.iq'),('00000000-0000-0000-0000-0000000000c1','mod@x.iq');
insert into public.profiles (id) select id from auth.users on conflict do nothing;
update public.profiles set role='super_admin' where id='00000000-0000-0000-0000-0000000000a1';
update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000a2';
update public.profiles set role='moderator' where id='00000000-0000-0000-0000-0000000000c1';
insert into storage.buckets(id,name,public) values ('media','media',true),('licenses','licenses',false) on conflict do nothing;
update storage.buckets set file_size_limit = 5242880 where id='media';

\set A1 '''00000000-0000-0000-0000-0000000000a1'''
\set A2 '''00000000-0000-0000-0000-0000000000a2'''
\set D1 '''00000000-0000-0000-0000-0000000000d1'''
\set D2 '''00000000-0000-0000-0000-0000000000d2'''
\set P1 '''00000000-0000-0000-0000-0000000000b1'''
\set M1 '''00000000-0000-0000-0000-0000000000c1'''

-- ===== الأطباء =====
set role authenticated;
select public._as(:D1);
select public._run('طبيب ينشئ صفحته', $q$insert into public.doctors(id,name,spec,area,status,verified,featured,days,open_from,open_to,phone)
  values ('00000000-0000-0000-0000-0000000000d1','د. أ','طب أسنان عام','الناصرية','approved',true,true,'{0,1,2,3,4,5,6}','00:00','23:59','07801234567')$q$);
select public._ok('الطبيب لا يستطيع قبول نفسه عند الإنشاء', (select status='pending' and not verified and not featured from public.doctors where id=:D1));
select public._ok('دور الطبيب تحوّل من مريض إلى طبيب', (select role='doctor' from public.profiles where id=:D1));
update public.doctors set status='approved', verified=true where id=:D1;
select public._ok('الطبيب لا يستطيع قبول/توثيق نفسه بالتعديل', (select status='pending' and not verified from public.doctors where id=:D1));
select public._err('الطبيب لا يغيّر دوره إلى مدير', $q$update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000d1'$q$);
select public._run('طبيب يعدّل اسمه في ملفه الشخصي', $q$update public.profiles set full_name='أحمد' where id='00000000-0000-0000-0000-0000000000d1'$q$);
select public._as(:D2);
select public._run('طبيب ثانٍ ينشئ صفحته', $q$insert into public.doctors(id,name,spec,area) values ('00000000-0000-0000-0000-0000000000d2','د. ب','تقويم الأسنان','الشطرة')$q$);
with u as (update public.doctors set name='مخترق' where id=:D1 returning 1) select public._ok('طبيب لا يعدّل صفحة طبيب آخر', (select count(*) from u)=0);
with u as (delete from public.doctors where id=:D1 returning 1) select public._ok('طبيب لا يحذف طبيباً آخر', (select count(*) from u)=0);
select public._ok('لا يرى سجل العمليات', (select count(*) from public.audit_logs)=0);
select public._err('لا يستطيع قراءة قائمة المستخدمين', $q$select * from public.admin_list_users()$q$);
select public._err('لا يستطيع فتح نظرة الإدارة', $q$select public.admin_overview()$q$);

-- ===== المشرف =====
select public._as(:M1);
with u as (update public.doctors set status='approved' where id=:D1 returning 1) select public._ok('المشرف لا يقبل الأطباء', (select count(*) from u)=0);
select public._err('المشرف لا يغيّر الأدوار', $q$select public.set_user_role('00000000-0000-0000-0000-0000000000b1','admin')$q$);

-- ===== المدير =====
select public._as(:A2);
select public._run('المدير يقبل الطبيب', $q$update public.doctors set status='approved', booking_enabled=true, slot_minutes=30 where id='00000000-0000-0000-0000-0000000000d1'$q$);
select public._err('المدير (غير الأعلى) لا يغيّر الأدوار', $q$select public.set_user_role('00000000-0000-0000-0000-0000000000b1','moderator')$q$);
select public._ok('المدير يرى سجل العمليات', (select count(*) from public.audit_logs where action='doctor.status')>=1);
select public._ok('المدير يرى قائمة المستخدمين', (select count(*) from public.admin_list_users())=6);
select public._ok('نظرة الإدارة تعمل', (select (public.admin_overview()->>'doctors_approved')::int)=1);
select public._as(:D1);
select public._ok('الطبيب استلم إشعار القبول', (select count(*) from public.notifications where type='doctor_status')=1);
select public._as(:A1);
select public._run('المدير الأعلى يغيّر دور مستخدم', $q$select public.set_user_role('00000000-0000-0000-0000-0000000000c1','moderator')$q$);
select public._err('المدير الأعلى لا يغيّر دوره بنفسه', $q$select public.set_user_role('00000000-0000-0000-0000-0000000000a1','patient')$q$);
select public._ok('المدير الأعلى يقرأ إشعاري الطلبين الجديدين', (select count(*) from public.notifications where type='doctor_request')=2);

-- ===== الزائر المجهول =====
select public._as(null);
set role anon;
select public._ok('الزائر يرى الطبيب المقبول فقط', (select count(*) from public.doctors)=1);
select public._ok('الزائر لا يرى سجل العمليات', (select count(*) from public.audit_logs)=0);
select public._ok('الزائر لا يرى إشعارات أحد', (select count(*) from public.notifications)=0);
select public._ok('الزائر لا يرى الحجوزات', (select count(*) from public.bookings)=0);
select public._err('الزائر لا يدرج نقرات مباشرة', $q$insert into public.clicks(doctor_id,kind) values ('00000000-0000-0000-0000-0000000000d1','view')$q$);
select public._run('تسجيل زيارة عبر الدالة', $q$select public.log_event('00000000-0000-0000-0000-0000000000d1','view','s1')$q$);
select public.log_event(:D1,'view','s1'); select public.log_event(:D1,'view','s1');
select public._err('الزائر لا يدرج بلاغاً مباشرة', $q$insert into public.reports(reason) values ('x')$q$);
select public._err('الزائر لا يقرأ ملفات الهويات', $q$select 1/(select count(*) from storage.objects where bucket_id='licenses')::int$q$);

-- ===== الحجز =====
select public._ok('المواعيد المتاحة غداً تظهر', (select count(*) from public.available_slots(:D1, ((now() at time zone 'Asia/Baghdad')::date + 1)))>=40);
select public._ok('طبيب غير مفعّل للحجز: لا مواعيد', (select count(*) from public.available_slots(:D2, ((now() at time zone 'Asia/Baghdad')::date + 1)))=0);
create temp table _slot as select slot_start from public.available_slots(:D1, ((now() at time zone 'Asia/Baghdad')::date + 1)) order by 1 limit 3;
grant select on _slot to anon, authenticated;
select public._err('رقم هاتف غير صالح مرفوض', format($q$select * from public.create_booking('00000000-0000-0000-0000-0000000000d1', %L, 'علي', '12345')$q$, (select slot_start from _slot order by 1 limit 1)));
select public._err('موعد خارج الشبكة مرفوض', format($q$select * from public.create_booking('00000000-0000-0000-0000-0000000000d1', %L, 'علي', '07801111111')$q$, (select slot_start + interval '7 minutes' from _slot order by 1 limit 1)));
select public._run('مريض يحجز موعداً', format($q$create temp table _b1 as select * from public.create_booking('00000000-0000-0000-0000-0000000000d1', %L, 'علي حسن', '+964 780 111 1111', 'ألم')$q$, (select slot_start from _slot order by 1 limit 1)));
grant select on _b1 to anon, authenticated;
select public._ok('الرقم الدولي يُوحَّد إلى 07', (select (public.get_booking(token)->>'status')='pending' from _b1));
select public._err('منع الحجز المزدوج لنفس الموعد', format($q$select * from public.create_booking('00000000-0000-0000-0000-0000000000d1', %L, 'زيد', '07802222222')$q$, (select slot_start from _slot order by 1 limit 1)));
select public._ok('الموعد المحجوز اختفى من المتاح', not exists (select 1 from public.available_slots(:D1, ((now() at time zone 'Asia/Baghdad')::date + 1)) s join _slot x on x.slot_start = s.slot_start and x.slot_start = (select min(slot_start) from _slot)));
reset role;
select public._err('قيد قاعدة البيانات يمنع التداخل حتى بالإدراج المباشر', format($q$insert into public.bookings(doctor_id,patient_name,patient_phone,start_at,end_at) values ('00000000-0000-0000-0000-0000000000d1','خالد','07803333333',%L,%L)$q$, (select slot_start + interval '10 minutes' from _slot order by 1 limit 1), (select slot_start + interval '20 minutes' from _slot order by 1 limit 1)));
set role authenticated;
select public._as(:D2);
select public._err('طبيب آخر لا يدير الحجز', format($q$select public.doctor_booking_action(%L,'confirm')$q$, (select booking_id from _b1)));
select public._ok('طبيب آخر لا يرى الحجز', (select count(*) from public.bookings)=0);
select public._as(:D1);
select public._ok('الطبيب يرى حجزه', (select count(*) from public.bookings)=1);
select public._ok('الطبيب استلم إشعار طلب الحجز', (select count(*) from public.notifications where type='booking_new')=1);
select public._run('الطبيب يؤكد الحجز', format($q$select public.doctor_booking_action(%L,'confirm','أهلاً')$q$, (select booking_id from _b1)));
select public._err('لا يمكن إكمال موعد لم يحن وقته', format($q$select public.doctor_booking_action(%L,'complete')$q$, (select booking_id from _b1)));
select public._err('الطبيب لا يعدّل الحجز مباشرة', format($q$update public.bookings set status='completed' where id=%L returning 1/0$q$, (select booking_id from _b1)));
reset role;
update public.bookings set start_at = now() - interval '2 hours', end_at = now() - interval '90 minutes' where id = (select booking_id from _b1);
set role authenticated; select public._as(:D1);
select public._run('الطبيب يُكمل الموعد بعد وقته', format($q$select public.doctor_booking_action(%L,'complete')$q$, (select booking_id from _b1)));

-- ===== التقييمات =====
select public._as(null); set role anon;
select public._run('المريض يقيّم بعد الموعد المكتمل', format($q$select public.add_review(%L, 5, 'ممتاز')$q$, (select token from _b1)));
select public._err('لا يقيّم نفس الحجز مرتين', format($q$select public.add_review(%L, 1, 'x')$q$, (select token from _b1)));
select public._ok('متوسط التقييم يظهر للعامة', (select avg_rating=5 and review_count=1 from public.doctor_ratings where doctor_id=:D1));
set role authenticated; select public._as(:D1);
with u as (update public.reviews set rating=5 returning 1) select public._ok('الطبيب لا يعدّل التقييمات', (select count(*) from u)=0);
with u as (delete from public.reviews returning 1) select public._ok('الطبيب لا يحذف التقييمات', (select count(*) from u)=0);
select public._as(:M1);
select public._err('المشرف لا يغيّر نص التقييم', $q$update public.reviews set comment='مزيف'$q$);
select public._run('المشرف يخفي تقييماً', $q$update public.reviews set status='hidden', hidden_reason='مخالف'$q$);
select public._as(null); set role anon;
select public._ok('التقييم المخفي لا يظهر للعامة', (select count(*) from public.reviews)=0);
reset role; create temp table _rv as select id from public.reviews limit 1; grant select on _rv to anon, authenticated; set role anon;

-- حجز ثانٍ: إلغاء واقتراح بديل
select public._run('حجز ثانٍ', format($q$create temp table _b2 as select * from public.create_booking('00000000-0000-0000-0000-0000000000d1', %L, 'سارة', '07804444444')$q$, (select slot_start from _slot order by 1 offset 1 limit 1)));
grant select on _b2 to anon, authenticated;
set role authenticated; select public._as(:D1);
select public._run('الطبيب يقترح موعداً بديلاً', format($q$select public.doctor_booking_action(%L,'propose','ما رأيك؟',%L)$q$, (select booking_id from _b2), (select slot_start from _slot order by 1 offset 2 limit 1)));
select public._as(null); set role anon;
select public._run('المريض يقبل البديل', format($q$select public.accept_proposal(%L)$q$, (select token from _b2)));
select public._ok('الحجز صار مؤكداً بالموعد الجديد', (select (public.get_booking(token)->>'status')='confirmed' from _b2));
select public._run('المريض يلغي حجزه', format($q$select public.cancel_booking(%L)$q$, (select token from _b2)));
select public._err('لا يمكن إلغاء الحجز مرتين', format($q$select public.cancel_booking(%L)$q$, (select token from _b2)));

-- ===== الحالات =====
set role authenticated; select public._as(:D1);
select public._err('نشر حالة بدون موافقة المريض مرفوض', $q$insert into public.cases(doctor_id,title,after_url) values ('00000000-0000-0000-0000-0000000000d1','حالة','https://abc.supabase.co/storage/v1/object/public/media/x.jpg')$q$);
select public._err('رابط صورة خارجي مرفوض', $q$insert into public.cases(doctor_id,title,after_url,consent_confirmed) values ('00000000-0000-0000-0000-0000000000d1','حالة','https://evil.example/x.jpg',true)$q$);
select public._run('نشر حالة صحيحة', $q$insert into public.cases(doctor_id,title,after_url,consent_confirmed) values ('00000000-0000-0000-0000-0000000000d1','حالة','https://abc.supabase.co/storage/v1/object/public/media/x.jpg',true)$q$);
update public.cases set hidden=true, title='معدّل';
select public._ok('الطبيب يعدّل العنوان لكن لا يغيّر حالة الإخفاء', (select title='معدّل' and not hidden from public.cases limit 1));
select public._as(:D2);
select public._err('طبيب لا ينشر حالة باسم غيره', $q$insert into public.cases(doctor_id,title,after_url,consent_confirmed) values ('00000000-0000-0000-0000-0000000000d1','x','https://abc.supabase.co/storage/v1/object/public/media/x.jpg',true)$q$);
select public._as(:M1);
select public._run('المشرف يخفي حالة', $q$update public.cases set hidden=true, hidden_reason='تُظهر الوجه'$q$);
select public._as(null); set role anon;
select public._ok('الحالة المخفية لا تظهر للعامة', (select count(*) from public.cases)=0);
select public._run('بلاغ عبر الدالة', $q$select public.submit_report(null, (select id from _rv), 'مسيء', 'sessX')$q$);

-- ===== التوثيق =====
set role authenticated; select public._as(:D1);
select public._err('مستند خارج مجلد الطبيب مرفوض', $q$insert into public.verification_requests(doctor_id,documents) values ('00000000-0000-0000-0000-0000000000d1', array['00000000-0000-0000-0000-0000000000d2/x.jpg'])$q$);
select public._run('الطبيب يقدّم طلب توثيق', $q$insert into public.verification_requests(doctor_id,documents,status) values ('00000000-0000-0000-0000-0000000000d1', array['00000000-0000-0000-0000-0000000000d1/lic.jpg'],'approved')$q$);
select public._ok('الطلب يبدأ قيد المراجعة مهما أرسل الطبيب', (select status='pending' from public.verification_requests where doctor_id=:D1));
with u as (update public.verification_requests set status='approved' returning 1) select public._ok('الطبيب لا يوافق على طلبه', (select count(*) from u)=0);
select public._as(:A2);
select public._run('المدير يطلب مستندات إضافية', $q$update public.verification_requests set status='needs_info', review_note='الوجه الخلفي للهوية' where doctor_id='00000000-0000-0000-0000-0000000000d1'$q$);
select public._as(:D1);
select public._run('الطبيب يستكمل المستندات', $q$update public.verification_requests set documents = documents || '00000000-0000-0000-0000-0000000000d1/back.jpg'::text where doctor_id='00000000-0000-0000-0000-0000000000d1'$q$);
select public._ok('الطلب رجع قيد المراجعة', (select status='pending' from public.verification_requests where doctor_id=:D1));
select public._as(:A2);
select public._run('المدير يوثّق', $q$update public.verification_requests set status='approved' where doctor_id='00000000-0000-0000-0000-0000000000d1'$q$);
select public._ok('الشارة تُمنح مع تسجيل المراجع والوقت', (select verified and verified_by='00000000-0000-0000-0000-0000000000a2' and verified_at is not null from public.doctors where id=:D1));
select public._ok('سجل التوثيق محفوظ', (select count(*) from public.audit_logs where action in ('verification.needs_info','verification.approved'))=2);

-- ===== التخزين =====
select public._as(:D1);
select public._err('طبيب لا يرفع في مجلد غيره', $q$insert into storage.objects(bucket_id,name) values ('media','00000000-0000-0000-0000-0000000000d2/x.jpg')$q$);
select public._run('طبيب يرفع في مجلده', $q$insert into storage.objects(bucket_id,name) values ('media','00000000-0000-0000-0000-0000000000d1/x.jpg'),('licenses','00000000-0000-0000-0000-0000000000d1/lic.jpg')$q$);
select public._as(:D2);
select public._ok('طبيب لا يسرد ملفات غيره', (select count(*) from storage.objects)=0);
select public._ok('طبيب لا يرى هوية طبيب آخر', (select count(*) from storage.objects where bucket_id='licenses')=0);
select public._as(:A2);
select public._ok('المدير يرى الهويات للمراجعة', (select count(*) from storage.objects where bucket_id='licenses')=1);

-- ===== الإجازات =====
select public._as(:D1);
select public._run('الطبيب يضيف إجازة', $q$insert into public.time_off(doctor_id,starts_on,ends_on) values ('00000000-0000-0000-0000-0000000000d1', (now() at time zone 'Asia/Baghdad')::date + 2, (now() at time zone 'Asia/Baghdad')::date + 3)$q$);
select public._ok('لا مواعيد في يوم الإجازة', (select count(*) from public.available_slots(:D1, (now() at time zone 'Asia/Baghdad')::date + 2))=0);
select public._ok('إحصائيات الطبيب اليومية', (select sum(views)=1 and sum(books)=2 from public.doctor_stats(7)));

-- ===== الإشعارات =====
select public._as(:D2);
with u as (update public.notifications set read_at=now() returning 1) select public._ok('لا يقرأ إشعارات غيره', (select count(*) from u)=0);
select public._as(:D1);
select public._err('لا يعدّل نص إشعاره', $q$update public.notifications set title='x'$q$);
select public._run('يعلّم كل إشعاراته مقروءة', $q$select public.mark_all_notifications_read()$q$);
reset role;
select public._err('بلاغ مكرر من نفس الجهاز مرفوض', $q$select public.submit_report(null, (select id from _rv), 'مسيء', 'sessX')$q$);
select public._ok('الزيارات المكررة من نفس الجلسة تُحسب مرة', (select count(*) from public.clicks where kind='view')=1);

select n, case when ok then 'PASS' else 'FAIL' end as result, label, coalesce(info,'') as info from public._t order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from public._t;
