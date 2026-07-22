-- Bucket público para fotos de perfil. Cada usuario solo puede escribir
-- dentro de su propia carpeta (primer segmento del path = su uid), igual
-- que ocurre a nivel de aplicación con avatar_url en users/profiles.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars public read"
on storage.objects for select
to public
using (bucket_id = 'avatars');

create policy "avatars owner insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner update"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
