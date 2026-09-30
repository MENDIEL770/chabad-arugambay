-- 0008_content.sql — gallery, the about section, articles and their comments.

create type media_kind    as enum ('photo','video');
create type comment_state as enum ('pending','approved','rejected');

-- ---------------------------------------------------------------- gallery

create table media_items (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  kind       media_kind not null default 'photo',

  /** A photo lives in storage. A video is a link to YouTube or Vimeo —
   *  hosting video on Supabase would be expensive and slow to serve into
   *  Sri Lanka, and every phone already plays an embed. */
  storage_path text,
  external_url text,
  /** Still frame for a video, so the grid is not a row of grey boxes. */
  poster_path  text,

  caption    jsonb not null default '{}'::jsonb,
  album      text  not null default 'general',
  taken_on   date,

  sort       int not null default 0,
  is_active  boolean not null default true,
  /** Shown in the strip on the home page, not only in the full gallery. */
  is_featured boolean not null default false,

  width_px   int,
  height_px  int,
  bytes      int,
  created_at timestamptz not null default now(),

  constraint photo_needs_file  check (kind <> 'photo' or storage_path is not null),
  constraint video_needs_link  check (kind <> 'video' or external_url is not null)
);

create index on media_items (tenant_id, album, sort) where is_active;
create index on media_items (tenant_id, sort) where is_active and is_featured;

-- ---------------------------------------------------------------- about

/**
 * One row per tenant. A table rather than a settings blob so the two
 * portraits get real columns — they are uploaded and deleted like any other
 * file and should not be buried in JSON.
 */
create table site_about (
  tenant_id  uuid primary key references tenants(id) on delete cascade,
  heading    jsonb not null default '{}'::jsonb,
  body       jsonb not null default '{}'::jsonb,   -- {he, en}, plain paragraphs

  shluchim_path    text,
  shluchim_caption jsonb not null default '{}'::jsonb,
  rebbe_path       text,
  rebbe_caption    jsonb not null default '{}'::jsonb,

  updated_at timestamptz not null default now()
);

create trigger t_about_touch before update on site_about
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------- articles

create table articles (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  slug       text not null,

  title      jsonb not null,
  excerpt    jsonb not null default '{}'::jsonb,
  /** Markdown. Rendered to a restricted subset — see the renderer. */
  body       jsonb not null default '{}'::jsonb,

  cover_path text,
  read_minutes int not null default 4,

  is_published boolean not null default false,
  published_at timestamptz,
  sort       int not null default 0,

  /** Comments can be switched off per article. */
  comments_open boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, slug)
);

create index on articles (tenant_id, published_at desc) where is_published;

create trigger t_articles_touch before update on articles
  for each row execute function touch_updated_at();

create table article_comments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,

  author_name  text not null,
  author_email text,
  body         text not null,

  /**
   * Nothing appears on the site until a human approves it. An open comment
   * box on a Chabad house site is a spam magnet, and the shliach should
   * never have to discover that from a visitor.
   */
  state      comment_state not null default 'pending',
  /** Staff may correct a typo or trim abuse; the original is kept so an
   *  edit can be shown to be an edit rather than a silent rewrite. */
  edited_body text,
  edited_at   timestamptz,

  created_at timestamptz not null default now(),

  constraint body_not_empty check (length(trim(body)) > 0)
);

create index on article_comments (article_id, created_at desc);
create index on article_comments (tenant_id, state) where state = 'pending';

/** What the public sees: the edited text when staff changed it. */
create or replace function comment_display_body(c article_comments)
returns text language sql immutable as $$
  select coalesce(c.edited_body, c.body)
$$;

-- ---------------------------------------------------------------- rls

alter table media_items      enable row level security;
alter table site_about       enable row level security;
alter table articles         enable row level security;
alter table article_comments enable row level security;

create policy media_read_public on media_items for select using (is_active);
create policy media_write on media_items
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

create policy about_read_public on site_about for select using (true);
create policy about_write on site_about
  for all using (app_can(tenant_id, 'admin')) with check (app_can(tenant_id, 'admin'));

create policy articles_read_public on articles for select using (is_published);
create policy articles_write on articles
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- Only approved comments are readable by anyone; pending ones are staff-only.
create policy comments_read_public on article_comments
  for select using (state = 'approved');
create policy comments_manage on article_comments
  for all using (app_can(tenant_id, 'staff')) with check (app_can(tenant_id, 'staff'));

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content', 'content', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy content_images_read on storage.objects
  for select using (bucket_id = 'content');

create policy content_images_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'content'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff'));

create policy content_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'content'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff'));

create policy content_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'content'
    and public.app_can(((storage.foldername(name))[1])::uuid, 'staff'));

-- ---------------------------------------------------------------- comment submission

/**
 * Leave a comment, as a guest.
 *
 * Runs as definer because the caller is anonymous and RLS would block the
 * insert. It can only ever create a 'pending' row — the state is set here,
 * not taken from the caller — so a forged request cannot self-approve.
 */
create or replace function post_comment(
  p_tenant  uuid,
  p_article uuid,
  p_name    text,
  p_email   text,
  p_body    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article articles%rowtype;
  v_recent  int;
  v_id      uuid;
begin
  select * into v_article from articles
   where id = p_article and tenant_id = p_tenant and is_published;
  if not found then raise exception 'UNKNOWN_ARTICLE'; end if;
  if not v_article.comments_open then raise exception 'COMMENTS_CLOSED'; end if;

  if length(trim(coalesce(p_body, ''))) < 2 then raise exception 'EMPTY'; end if;
  if length(p_body) > 2000 then raise exception 'TOO_LONG'; end if;

  -- Crude flood guard: a handful per article per hour from one name.
  select count(*) into v_recent from article_comments
   where article_id = p_article
     and author_name = trim(p_name)
     and created_at > now() - interval '1 hour';
  if v_recent >= 3 then raise exception 'TOO_MANY'; end if;

  insert into article_comments (tenant_id, article_id, author_name, author_email, body)
  values (p_tenant, p_article, trim(p_name),
          nullif(trim(coalesce(p_email,'')),''), trim(p_body))
  returning id into v_id;

  return v_id;
end $$;

revoke all on function post_comment(uuid, uuid, text, text, text) from public;
