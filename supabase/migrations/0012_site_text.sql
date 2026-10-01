-- 0012_site_text.sql — editable copy for the public pages.

/**
 * Overrides, not storage.
 *
 * Every string also exists as a default in the code, so a missing row, an
 * unrun migration or a typo in a key can never leave a blank page. A row
 * here only replaces what the code already says.
 */
create table site_text (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  key        text not null,
  value      jsonb not null,            -- {he, en}
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

create trigger t_site_text_touch before update on site_text
  for each row execute function touch_updated_at();

alter table site_text enable row level security;

create policy site_text_read_public on site_text
  for select using (true);

create policy site_text_write on site_text
  for all using (app_can(tenant_id, 'staff'))
  with check (app_can(tenant_id, 'staff'));
