-- 0009_dish_photos.sql — several photos per dish, not one.

create table menu_item_images (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  item_id    uuid not null references menu_items(id) on delete cascade,

  storage_path text not null,
  alt          jsonb not null default '{}'::jsonb,

  sort       int not null default 0,
  width_px   int,
  height_px  int,
  bytes      int,
  created_at timestamptz not null default now()
);

create index on menu_item_images (item_id, sort);

alter table menu_item_images enable row level security;

-- Visible wherever the dish is visible.
create policy dish_images_read_public on menu_item_images
  for select using (
    exists (
      select 1 from menu_items i
      join menu_categories c on c.id = i.category_id
      where i.id = menu_item_images.item_id and c.is_active
    )
  );

create policy dish_images_write on menu_item_images
  for all using (app_can(tenant_id, 'staff'))
  with check (app_can(tenant_id, 'staff'));

/**
 * Carry the existing single photo over as the first image, so nothing that
 * was already uploaded disappears when the menu starts reading from here.
 * menu_items.image_path stays as the thumbnail for lists.
 */
insert into menu_item_images (tenant_id, item_id, storage_path, sort)
select tenant_id, id, image_path, 0
  from menu_items
 where image_path is not null
on conflict do nothing;
