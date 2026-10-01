-- 0011_printing.sql — printers, the print queue, and the receipt template.

create type printer_kind      as enum ('receipt','kitchen','bar');
create type printer_transport as enum ('cloudprnt','agent','browser');
create type print_status      as enum ('queued','claimed','printed','failed');

create table printers (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,

  name       text not null,
  kind       printer_kind not null default 'receipt',
  transport  printer_transport not null default 'browser',

  /**
   * Which stations this printer is responsible for. A kitchen printer by
   * the grill should not spit out the bar's drinks.
   */
  stations   text[] not null default '{}',

  paper_width int not null default 80 check (paper_width in (58, 80)),
  /** Shared secret a polling printer presents; never leaves the admin. */
  poll_token text not null default encode(gen_random_bytes(16), 'hex'),
  last_seen_at timestamptz,

  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index on printers (poll_token);
create index on printers (tenant_id) where is_active;

create table print_jobs (
  id         bigserial primary key,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  printer_id uuid not null references printers(id) on delete cascade,
  order_id   uuid references orders(id) on delete cascade,

  template   text not null default 'receipt',
  /** Rendered lines, so a reprint is byte-identical to the original even
   *  after the menu or the template changes. */
  payload    jsonb not null,

  status     print_status not null default 'queued',
  attempts   int not null default 0,
  error      text,

  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  printed_at timestamptz
);

create index on print_jobs (printer_id, status, created_at);
create index on print_jobs (order_id);

/** Per-tenant receipt layout, edited in the admin with a live preview. */
create table receipt_template (
  tenant_id   uuid primary key references tenants(id) on delete cascade,

  -- Free text lines, e.g. the house name and address. Kept out of this file
  -- as literals: Hebrew in a .sql is corrupted by a clipboard round-trip.
  header_lines jsonb not null default '[]'::jsonb,
  footer_lines jsonb not null default '[]'::jsonb,
  show_logo    boolean not null default true,
  show_qr      boolean not null default true,
  show_prices  boolean not null default true,
  /** Kitchen tickets deliberately omit money — a cook does not need it and
   *  it is one more thing to misread at speed. */
  kitchen_show_prices boolean not null default false,
  paper_width  int not null default 80 check (paper_width in (58, 80)),

  updated_at  timestamptz not null default now()
);

create trigger t_receipt_touch before update on receipt_template
  for each row execute function touch_updated_at();

alter table printers         enable row level security;
alter table print_jobs       enable row level security;
alter table receipt_template enable row level security;

create policy printers_staff on printers
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));
create policy jobs_staff on print_jobs
  for all using (app_can(tenant_id, 'kitchen')) with check (app_can(tenant_id, 'kitchen'));
create policy receipt_read_staff on receipt_template
  for select using (app_can(tenant_id, 'kitchen'));
create policy receipt_write on receipt_template
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

/**
 * Hand the next queued job to a polling printer, exactly once.
 *
 * `for update skip locked` is what makes two printers polling the same
 * moment safe: each takes a different row instead of both taking the same
 * one and printing the order twice.
 */
create or replace function claim_print_job(p_token text)
returns table (job_id bigint, template text, payload jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_printer printers%rowtype;
  v_job     print_jobs%rowtype;
begin
  select * into v_printer from printers where poll_token = p_token and is_active;
  if not found then raise exception 'UNKNOWN_PRINTER'; end if;

  update printers set last_seen_at = now() where id = v_printer.id;

  select * into v_job
    from print_jobs
   where printer_id = v_printer.id and status = 'queued'
   order by created_at
   for update skip locked
   limit 1;

  if not found then return; end if;

  update print_jobs
     set status = 'claimed', claimed_at = now(), attempts = attempts + 1
   where id = v_job.id;

  return query select v_job.id, v_job.template, v_job.payload;
end $$;

revoke all on function claim_print_job(text) from public;

create or replace function confirm_print_job(p_token text, p_job bigint, p_ok boolean, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_printer printers%rowtype;
begin
  select * into v_printer from printers where poll_token = p_token and is_active;
  if not found then raise exception 'UNKNOWN_PRINTER'; end if;

  update print_jobs
     set status = case when p_ok then 'printed' else 'failed' end,
         printed_at = case when p_ok then now() else null end,
         error = p_error
   where id = p_job and printer_id = v_printer.id;
end $$;

revoke all on function confirm_print_job(text, bigint, boolean, text) from public;

-- Default template for the single tenant. Hebrew is inserted from the app on
-- first load, not from this file, for the encoding reason noted above.
insert into receipt_template (tenant_id)
select id from tenants
on conflict (tenant_id) do nothing;
