import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { MESSAGE_BY_EVENT, type MessageEvent, type MessageChannel } from './catalogue';
import { renderTemplate } from './template';

export interface StoredTemplate {
  event: MessageEvent;
  channel: MessageChannel;
  subjectHe: string;
  bodyHe: string;
  isEnabled: boolean;
  delayMin: number;
}

function missingTable(msg: string): boolean {
  return /message_templates|schema cache|does not exist/i.test(msg);
}

/**
 * Every stored template, merged over the catalogue defaults.
 *
 * Returns a full set whether or not the table has rows, so the editor shows
 * ten messages on a fresh install rather than an empty page, and the sender
 * has wording to use before anyone has saved anything.
 */
export async function getTemplates(): Promise<StoredTemplate[]> {
  const base: StoredTemplate[] = [...MESSAGE_BY_EVENT.values()].map((d) => ({
    event: d.event,
    channel: 'whatsapp' as const,
    subjectHe: '',
    bodyHe: d.defaultBody,
    isEnabled: d.onByDefault,
    delayMin: 0,
  }));

  if (!hasSupabase()) return base;

  const { data, error } = await createServiceClient()
    .from('message_templates')
    .select('event, channel, subject, body, is_enabled, delay_min')
    .eq('tenant_id', TENANT_ID);

  if (error || !data?.length) return base;

  return base.map((b) => {
    const row = data.find((r) => r.event === b.event && r.channel === b.channel);
    if (!row) return b;
    const body = (row.body as { he?: string } | null)?.he;
    return {
      ...b,
      // An empty saved body falls back to the default rather than sending a
      // blank message — clearing the box should mean "use the standard
      // wording", not "send nothing".
      bodyHe: body?.trim() ? body : b.bodyHe,
      subjectHe: (row.subject as { he?: string } | null)?.he ?? '',
      isEnabled: row.is_enabled === true,
      delayMin: (row.delay_min as number) ?? 0,
    };
  });
}

/**
 * The exact text to send for one event, or null if the house switched it
 * off. Returning null rather than an empty string keeps "disabled" and
 * "nothing to say" distinguishable at the call site.
 */
export async function renderFor(
  event: MessageEvent,
  values: Record<string, string | number | null | undefined>,
): Promise<string | null> {
  const def = MESSAGE_BY_EVENT.get(event);
  if (!def) return null;

  let template = def.defaultBody;
  let enabled = def.onByDefault;

  if (hasSupabase()) {
    const { data, error } = await createServiceClient()
      .from('message_templates')
      .select('body, is_enabled')
      .eq('tenant_id', TENANT_ID)
      .eq('event', event)
      .eq('channel', 'whatsapp')
      .maybeSingle();

    if (error && !missingTable(error.message)) {
      // A read failure must not silence the customer notification; fall
      // back to the wording in the code rather than sending nothing.
      enabled = def.onByDefault;
    } else if (data) {
      const body = (data.body as { he?: string } | null)?.he;
      if (body?.trim()) template = body;
      enabled = data.is_enabled === true;
    }
  }

  if (!enabled) return null;

  const text = renderTemplate(template, values, { onMissing: 'blank' });
  return text.trim() ? text : null;
}
