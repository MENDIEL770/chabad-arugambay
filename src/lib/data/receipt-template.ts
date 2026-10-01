import { createServiceClient } from '@/lib/supabase/server';
import { hasSupabase, TENANT_ID } from '@/lib/config';
import { DEFAULT_TEMPLATE, type ReceiptTemplate } from '@/lib/receipt';

/**
 * The saved layout, or the default when nothing has been configured — and
 * also when the migration has not run yet, so the designer page still opens
 * and shows what it would look like.
 */
export async function getReceiptTemplate(): Promise<ReceiptTemplate> {
  if (!hasSupabase()) return DEFAULT_TEMPLATE;

  const sb = createServiceClient();
  const { data, error } = await sb
    .from('receipt_template')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  if (error || !data) return DEFAULT_TEMPLATE;

  const header = data.header_lines as string[] | null;
  const footer = data.footer_lines as string[] | null;

  const url = (p: unknown) =>
    typeof p === 'string' && p
      ? sb.storage.from('receipt').getPublicUrl(p).data.publicUrl
      : null;

  return {
    logoUrl: url(data.logo_path),
    headerImageUrl: url(data.header_image_path),
    footerImageUrl: url(data.footer_image_path),
    // An empty array is a deliberate "no header"; only a missing row falls
    // back to the defaults.
    headerLines: header ?? DEFAULT_TEMPLATE.headerLines,
    footerLines: footer ?? DEFAULT_TEMPLATE.footerLines,
    showLogo: data.show_logo !== false,
    showQr: data.show_qr !== false,
    showPrices: data.show_prices !== false,
    kitchenShowPrices: data.kitchen_show_prices === true,
    paperWidth: (data.paper_width as number) ?? 80,
  };
}
