-- 0023_receipt_formats.sql — accept AVIF on receipt artwork.
--
-- ASCII only: Hebrew in a .sql file on this project has been corrupted by a
-- clipboard round-trip before.

/**
 * The bucket's own allow-list rejected anything but PNG, JPEG and WebP, and
 * Storage refuses before the app ever sees the file. AVIF is what a modern
 * phone and most export tools produce now.
 *
 * SVG is deliberately NOT added. A thermal printer rasterises at 576px, so
 * vector art buys nothing, and an SVG served from a public bucket can carry
 * script. The app says so by name rather than refusing silently.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipt', 'receipt', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
