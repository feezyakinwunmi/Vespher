-- =====================================================================
-- Rider application photos (selfie, vehicle, papers, licence, ID) live in the
-- `rider-documents` bucket under <user_id>/... . Admin screens show them with
-- signed links, which need read access here; applicants can only upload and
-- see their own folder.
-- The bucket's public/private setting is left as it is.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('rider-documents', 'rider-documents', false)
on conflict (id) do nothing;

drop policy if exists "rider-documents: owner upload" on storage.objects;
create policy "rider-documents: owner upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'rider-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Re-uploading a photo (upsert) replaces the file.
drop policy if exists "rider-documents: owner update" on storage.objects;
create policy "rider-documents: owner update" on storage.objects
  for update to authenticated using (
    bucket_id = 'rider-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "rider-documents: owner or admin read" on storage.objects;
create policy "rider-documents: owner or admin read" on storage.objects
  for select to authenticated using (
    bucket_id = 'rider-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
