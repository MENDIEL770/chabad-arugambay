-- 0005_hero.sql — rotating hero images for the public home page.

create table hero_slides (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,

  image_path text not null,                       -- storage key in bucket 'hero'

  /**
   * Where the subject sits, as percentages. A 2:1 hero cropped to a phone
   * loses most of its width, and without this the crop takes the centre —
   * which is how you end up with a photo of the sea and no building.
   */
  focal_x    int not null default 50 check (focal_x between 0 and 100),
  focal_y    int not null default 50 check (focal_y between 0 and 100),

  /**
   * Optional text bound to THIS image. When headline is present it replaces
   * the default hero copy for as long as the slide is showing; otherwise the
   * page keeps showing the upcoming occasion.
   */
  headline   jsonb,                               -- {he, en} or null
  subhead    jsonb,
  cta_label  jsonb,
  cta_href   text,

  /** How dark to make the scrim over this particular image, 0–80. A bright
   *  midday beach needs more than a dusk shot for the text to stay legible. */
  overlay    int not null default 35 check (overlay between 0 and 80),

  sort       int not null default 0,
  is_active  boolean not null default true,

  -- Kept for the admin so it can warn about an image that is too small.
  width_px   int,
  height_px  int,
  bytes      int,

  created_at timestamptz not null default now(),

  constraint cta_needs_both
    check ((cta_label is null) = (cta_href is null))
);

create index on hero_slides (tenant_id, sort) where is_active;

alter table hero_slides enable row level security;

create policy hero_read_public on hero_slides
  for select using (is_active);

create policy hero_write on hero_slides
  for all using (app_can(tenant_id, 'admin'))
  with check (app_can(tenant_id, 'admin'));

-- Hero images are large; a higher ceiling than dish photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hero', 'hero', true, 6291456,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy hero_images_read on storage.objects
  for select using (bucket_id = 'hero');

-- Schema-qualified: storage policies run with search_path = storage.
create policy hero_images_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hero'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'admin')
  );

create policy hero_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'hero'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'admin')
  );

create policy hero_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hero'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'admin')
  );
