-- 0004_rls.sql — row-level security and the menu-image storage bucket.
--
-- Shape of every policy:
--   public read   → only rows a guest is allowed to see (active menu, zmanim)
--   staff write   → app_can(tenant_id, 'staff') or stricter
-- Anything not matched by a policy is denied, because RLS is forced on.

alter table tenants               enable row level security;
alter table memberships           enable row level security;
alter table device_sessions       enable row level security;
alter table tenant_settings       enable row level security;
alter table audit_log             enable row level security;
alter table tenant_zmanim         enable row level security;
alter table menu_categories       enable row level security;
alter table menu_items            enable row level security;
alter table item_modifier_groups  enable row level security;
alter table item_modifier_options enable row level security;
alter table opening_hours         enable row level security;
alter table opening_exceptions    enable row level security;
alter table orders                enable row level security;
alter table order_events          enable row level security;

-- ---------------------------------------------------------------- tenants

create policy tenants_read_public on tenants
  for select using (is_active);

create policy tenants_write_owner on tenants
  for update using (app_can(id, 'owner')) with check (app_can(id, 'owner'));

-- ---------------------------------------------------------------- memberships
-- A member sees their own tenant's roster; only an admin may change it.
-- Self-elevation is blocked by requiring admin on the TARGET tenant.

create policy memberships_read on memberships
  for select using (tenant_id in (select app_tenant_ids()));

create policy memberships_write on memberships
  for all using (app_can(tenant_id, 'admin'))
  with check (app_can(tenant_id, 'admin'));

-- ---------------------------------------------------------------- settings

create policy settings_read_public on tenant_settings
  for select using (true);

create policy settings_write_admin on tenant_settings
  for all using (app_can(tenant_id, 'admin'))
  with check (app_can(tenant_id, 'admin'));

-- ---------------------------------------------------------------- devices

create policy devices_admin on device_sessions
  for all using (app_can(tenant_id, 'admin'))
  with check (app_can(tenant_id, 'admin'));

-- ---------------------------------------------------------------- audit
-- Readable by admins, never updated or deleted by anyone through the API.

create policy audit_read on audit_log
  for select using (app_can(tenant_id, 'admin'));

create policy audit_insert on audit_log
  for insert with check (tenant_id in (select app_tenant_ids()));

-- ---------------------------------------------------------------- zmanim

create policy zmanim_read_public on tenant_zmanim
  for select using (true);

create policy zmanim_write_admin on tenant_zmanim
  for all using (app_can(tenant_id, 'admin'))
  with check (app_can(tenant_id, 'admin'));

-- ---------------------------------------------------------------- menu
-- Guests see active categories and the items inside them. They may see a
-- sold-out item (greyed out in the UI) but the checkout re-checks
-- item_is_sellable server-side before accepting money.

create policy menu_cat_read_public on menu_categories
  for select using (is_active);

create policy menu_cat_write on menu_categories
  for all using (app_can(tenant_id, 'staff'))
  with check (app_can(tenant_id, 'staff'));

create policy menu_item_read_public on menu_items
  for select using (
    exists (select 1 from menu_categories c
             where c.id = menu_items.category_id and c.is_active)
  );

create policy menu_item_write on menu_items
  for all using (app_can(tenant_id, 'kitchen'))
  with check (app_can(tenant_id, 'kitchen'));

create policy modgroup_read_public on item_modifier_groups for select using (true);
create policy modgroup_write on item_modifier_groups
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy modopt_read_public on item_modifier_options for select using (true);
create policy modopt_write on item_modifier_options
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- ---------------------------------------------------------------- hours

create policy hours_read_public on opening_hours for select using (true);
create policy hours_write on opening_hours
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy hours_exc_read_public on opening_exceptions for select using (true);
create policy hours_exc_write on opening_exceptions
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- ---------------------------------------------------------------- orders
--
-- Deliberately NO anonymous select policy. A guest tracking an order at
-- /order/{id} goes through a server route that looks the row up with the
-- service key and returns only the tracking fields. Letting the browser read
-- the table directly would expose every customer's name, phone and address to
-- anyone who can guess a uuid.

create policy orders_read_staff on orders
  for select using (app_can(tenant_id, 'kitchen'));

create policy orders_write_staff on orders
  for all using (app_can(tenant_id, 'kitchen'))
  with check (app_can(tenant_id, 'kitchen'));

create policy order_events_read on order_events
  for select using (app_can(tenant_id, 'kitchen'));

create policy order_events_insert on order_events
  for insert with check (app_can(tenant_id, 'kitchen'));

-- ---------------------------------------------------------------- storage
-- Dish photos. Public read (they appear on the menu), staff-only write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu', 'menu', true, 8388608,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy menu_images_read on storage.objects
  for select using (bucket_id = 'menu');

-- Object keys are '<tenant_id>/<item_id>/<file>', so the first path segment
-- decides who may write. Without this check any staff member of any tenant
-- could overwrite another tenant's photos once the system is replicated.
create policy menu_images_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menu'
    and app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );

create policy menu_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'menu'
    and app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );

create policy menu_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menu'
    and app_can(((storage.foldername(name))[1])::uuid, 'staff')
  );
