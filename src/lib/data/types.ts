export interface I18n { he: string; en: string }

export type KosherType = 'meat' | 'dairy' | 'pareve';
export type StockMode = 'none' | 'count' | 'daily_limit';
export type Station = 'grill' | 'cold' | 'bar' | 'bakery';

export interface MenuItem {
  id: string;
  categoryId: string;
  name: I18n;
  description: I18n;
  priceLkr: number;
  imagePath: string | null;
  imageUrl: string | null;
  kosher: KosherType;
  tags: string[];
  prepMinutes: number;
  station: Station;
  isAvailable: boolean;
  stock: StockMode;
  stockQty: number | null;
  dailyLimit: number | null;
  soldToday: number;
  sort: number;
}

export interface MenuCategory {
  id: string;
  name: I18n;
  sort: number;
  isActive: boolean;
  items: MenuItem[];
}

/**
 * The one rule that decides whether a dish can be added to a cart.
 *
 * Mirrors item_is_sellable() in the database. The database is authoritative —
 * checkout re-checks there before taking money — but the UI needs the same
 * answer without a round trip, so the rule is written once here and kept in
 * step by a test.
 */
export function isSellable(item: MenuItem): boolean {
  if (!item.isAvailable) return false;
  switch (item.stock) {
    case 'none':
      return true;
    case 'count':
      return (item.stockQty ?? 0) > 0;
    case 'daily_limit':
      return item.soldToday < (item.dailyLimit ?? 0);
  }
}

/** Why an item cannot be ordered, for the badge on the menu card. */
export function unavailableReason(item: MenuItem): I18n | null {
  if (isSellable(item)) return null;
  if (!item.isAvailable) return { he: 'אזל להיום', en: 'Sold out' };
  return { he: 'אזל להיום', en: 'Sold out' };
}
