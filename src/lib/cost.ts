/**
 * Cost basis (#15) and the vendor funding that Net Gross Margin $ adds (#7), by supply source. Pure functions.
 *
 * #15  Cost follows Power BI category reporting:
 *        DC items  → DC end-of-day average cost minus scan-downs;
 *        DSD items → net replacement cost in the store that day.
 * #7   If Net Gross Margin $ stays: HQ scan-downs at the expected amount (not vendor billing), bill-backs only for
 *      DSD items (DC bill-backs are already in the DC cost), no slotting or lump sums, and each allowance counted
 *      once (a CNS store shipment recap and the DC off-invoice are the same allowance).
 *
 * Counted once: a DC scan-down already lowers the DC cost (#15), so Net GM $ does not add it again for DC items.
 */
import type { SupplySource } from '../data/products';

/** Vendor money tied to an event. Slotting and lump sums may exist in vendor data but never enter Net GM $. */
export interface VendorAllowances {
  /** HQ scan-downs at the expected amount. */
  scan: number;
  bill: number;
  /** Other promo allowance (slotting and lump sums are not part of it). */
  other: number;
  slotting?: number;
  lumpSum?: number;
}

const num = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Cost of goods sold for promo units (#15). `baseCost` is the DC average cost (DC) or the replacement cost (DSD). */
export function promoCost(source: SupplySource, baseCost: number, scanDowns: number): number {
  return source === 'DC' ? baseCost - num(scanDowns) : baseCost;
}

/** Scan-downs that the cost already takes out (#15): all of them for DC items, none for DSD items. */
export function scanDownsInCost(source: SupplySource, f: VendorAllowances): number {
  return source === 'DC' ? num(f.scan) : 0;
}

/** Vendor funding Net GM $ and Net Incremental GM $ add on top of Promo GM $ (#7), never slotting or lump sums. */
export function netGmFunding(source: SupplySource, f: VendorAllowances): number {
  if (source === 'DSD') return num(f.scan) + num(f.bill) + num(f.other);
  // DC: scan-downs are already in the cost (#15) and DC bill-backs are already in the DC cost (#7).
  return num(f.other);
}
