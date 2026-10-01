-- 0013_receipt_media.sql — logo and banner images on the printed receipt.

alter table receipt_template
  /** Small mark above the header lines. */
  add column if not exists logo_path text,
  /** Full-width banner at the very top, before the logo. */
  add column if not exists header_image_path text,
  /** Full-width banner at the very bottom, after the footer lines. */
  add column if not exists footer_image_path text;

/**
 * Receipt artwork lives in its own bucket.
 *
 * Separate from 'menu' so that a staff member who may edit dish photos
 * cannot necessarily alter what is printed on every receipt, and so the
 * size limit can be much smaller: a thermal printer renders 576 pixels
 * wide and anything larger is wasted bandwidth on every poll.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipt', 'receipt', true, 2097152,
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy receipt_media_read on storage.objects
  for select using (bucket_id = 'receipt');

create policy receipt_media_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipt'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );

create policy receipt_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipt'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );

create policy receipt_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipt'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );
