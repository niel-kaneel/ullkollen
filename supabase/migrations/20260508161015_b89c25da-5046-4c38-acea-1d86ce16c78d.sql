DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM auth.users WHERE email='annatenberg@hotmail.com');
DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email='annatenberg@hotmail.com');
DELETE FROM auth.users WHERE email='annatenberg@hotmail.com';