-- After you sign up on the website with YOUR email, run this ONCE
-- (replace the email) to make yourself the admin.
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'ddmel@ou.ac.lk');

-- Later, to make your sister a teacher (after she signs up):
-- update public.profiles set role = 'teacher'
-- where id = (select id from auth.users where email = 'SISTER_EMAIL@example.com');
-- (In Stage 2 the admin panel will do this for you.)
