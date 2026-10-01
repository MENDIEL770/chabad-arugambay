import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import type { I18n } from './types';

export interface MediaItem {
  id: string;
  kind: 'photo' | 'video';
  /** Resolved URL: storage for a photo, the embed source for a video. */
  url: string;
  posterUrl: string | null;
  caption: I18n | null;
  album: string;
  takenOn: string | null;
  isFeatured: boolean;
  widthPx: number | null;
  heightPx: number | null;
}

type Row = Record<string, unknown>;

/**
 * Turn a YouTube or Vimeo link into something that can sit in an iframe.
 *
 * Pasting a watch URL is what people actually do, and an iframe pointed at
 * one shows YouTube's refusal page rather than the video.
 */
export function toEmbedUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    }
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') ?? u.pathname.split('/').pop();
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (host.endsWith('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    // Not a URL we recognise; hand it back and let the iframe decide.
  }
  return raw;
}

function missingTable(msg: string): boolean {
  return /schema cache|does not exist/i.test(msg);
}

export async function getGallery(
  opts: { featuredOnly?: boolean; album?: string; limit?: number } = {},
): Promise<MediaItem[]> {
  if (!hasSupabase()) return [];

  const sb = createServiceClient();
  let q = sb
    .from('media_items')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('sort');

  if (opts.featuredOnly) q = q.eq('is_featured', true);
  if (opts.album && opts.album !== 'all') q = q.eq('album', opts.album);
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;

  if (error) {
    // The gallery is an addition, not the spine of the site: a missing table
    // hides the section rather than taking the page down.
    if (missingTable(error.message)) return [];
    throw new Error(`Could not load gallery: ${error.message}`);
  }

  const publicUrl = (p: string) => sb.storage.from('content').getPublicUrl(p).data.publicUrl;

  return (data ?? []).map((r: Row) => {
    const kind = r.kind as MediaItem['kind'];
    const storage = r.storage_path as string | null;
    const external = r.external_url as string | null;
    const poster = r.poster_path as string | null;

    return {
      id: r.id as string,
      kind,
      url: kind === 'photo' ? publicUrl(storage!) : toEmbedUrl(external ?? ''),
      posterUrl: poster ? publicUrl(poster) : null,
      caption: (r.caption as I18n) ?? null,
      album: (r.album as string) ?? 'general',
      takenOn: (r.taken_on as string | null) ?? null,
      isFeatured: r.is_featured === true,
      widthPx: (r.width_px as number | null) ?? null,
      heightPx: (r.height_px as number | null) ?? null,
    };
  });
}

/** Distinct albums that actually have something in them. */
export async function getAlbums(): Promise<string[]> {
  if (!hasSupabase()) return [];
  const { data, error } = await createServiceClient()
    .from('media_items')
    .select('album')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true);

  if (error || !data) return [];
  return [...new Set(data.map((r) => r.album as string))].sort();
}

export interface AboutContent {
  heading: I18n;
  body: I18n;
  shluchimUrl: string | null;
  shluchimCaption: I18n | null;
  rebbeUrl: string | null;
  rebbeCaption: I18n | null;
}

const ABOUT_FALLBACK: AboutContent = {
  heading: { he: 'על הבית', en: 'About us' },
  body: {
    he:
      'בית חב״ד ארוגם ביי נפתח כדי שכל יהודי שמגיע לקצה המזרחי של סרי לנקה ' +
      'ימצא כאן בית — שולחן שבת, אוכל כשר, מיטה אם צריך, ומישהו לדבר איתו.',
    en:
      'Chabad of Arugam Bay exists so that any Jew reaching the east coast of ' +
      'Sri Lanka finds a home here.',
  },
  shluchimUrl: null,
  shluchimCaption: null,
  rebbeUrl: null,
  rebbeCaption: null,
};

export async function getAbout(): Promise<AboutContent> {
  if (!hasSupabase()) return ABOUT_FALLBACK;

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('site_about')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  if (error || !data) return ABOUT_FALLBACK;

  const publicUrl = (p: string | null) =>
    p ? sb.storage.from('content').getPublicUrl(p).data.publicUrl : null;

  const pick = (v: unknown, fallback: I18n): I18n => {
    const t = v as I18n | null;
    return t?.he?.trim() ? t : fallback;
  };

  return {
    heading: pick(data.heading, ABOUT_FALLBACK.heading),
    body: pick(data.body, ABOUT_FALLBACK.body),
    shluchimUrl: publicUrl(data.shluchim_path as string | null),
    shluchimCaption: (data.shluchim_caption as I18n) ?? null,
    rebbeUrl: publicUrl(data.rebbe_path as string | null),
    rebbeCaption: (data.rebbe_caption as I18n) ?? null,
  };
}
