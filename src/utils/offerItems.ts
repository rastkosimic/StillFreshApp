import { OfferItem, VendorProduct } from '@/types';

/** Trims the name and collapses runs of whitespace, the same way the backend does. */
export function tidyItemName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Names are unique per location ignoring case, so that is how the app compares them too. */
export function isSameItemName(a: string, b: string): boolean {
  return tidyItemName(a).toLocaleLowerCase() === tidyItemName(b).toLocaleLowerCase();
}

/** "2× Kroasan", or just "Kroasan" when the vendor gave no quantity. */
export function formatOfferItemLabel(item: OfferItem): string {
  return item.quantity != null && item.quantity > 0
    ? `${item.quantity}× ${item.name}`
    : item.name;
}

export function sortProductsByName(products: VendorProduct[]): VendorProduct[] {
  return [...products].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

/** Shape sent to the backend: tidy names, and no null placeholders for absent fields. */
export function toOfferItemsPayload(items: OfferItem[]): OfferItem[] {
  return items.map((item) => {
    const payload: OfferItem = { name: tidyItemName(item.name) };
    if (item.productId != null) payload.productId = item.productId;
    if (item.quantity != null) payload.quantity = item.quantity;
    return payload;
  });
}

/**
 * Brings saved item names in line with the vendor's current product list, so reactivating
 * yesterday's bag picks up a product that was renamed since. Items whose product is gone,
 * and items typed only for one offer, are left as they are.
 *
 * Returns the same array when nothing changed, so callers can skip a state update.
 */
export function syncItemNamesWithProducts(
  items: OfferItem[],
  products: VendorProduct[],
): OfferItem[] {
  const nameById = new Map(products.map((p) => [p.id, p.name]));
  let changed = false;
  const next = items.map((item) => {
    if (item.productId == null) return item;
    const current = nameById.get(item.productId);
    if (current == null || current === item.name) return item;
    changed = true;
    return { ...item, name: current };
  });
  return changed ? next : items;
}

export interface ChipLayout {
  x: number;
  y: number;
  width: number;
}

/**
 * How many chips of a wrapping row layout can be shown within `maxRows`, leaving room for a
 * trailing "+N" chip when some have to be hidden.
 *
 * `layouts` are the measured positions of all chips laid out without any limit, in order.
 * Returns `layouts.length` when everything already fits.
 */
export function countVisibleChips(
  layouts: ChipLayout[],
  containerWidth: number,
  overflowChipWidth: number,
  gap: number,
  maxRows: number,
): number {
  if (layouts.length === 0 || maxRows < 1) return 0;

  // Row index of every chip: a new row starts whenever y moves down.
  const rows: number[] = [];
  let row = 0;
  for (let i = 0; i < layouts.length; i++) {
    if (i > 0 && layouts[i].y > layouts[i - 1].y + 1) row += 1;
    rows.push(row);
  }
  if (row < maxRows) return layouts.length;

  const lastAllowedRow = maxRows - 1;
  let visible = rows.findIndex((r) => r > lastAllowedRow);

  // Drop chips from the end of the last allowed row until the "+N" chip fits after them.
  // Once that row is empty the "+N" chip takes it alone.
  while (visible > 0 && rows[visible - 1] === lastAllowedRow) {
    const last = layouts[visible - 1];
    if (last.x + last.width + gap + overflowChipWidth <= containerWidth) break;
    visible -= 1;
  }
  return visible;
}
