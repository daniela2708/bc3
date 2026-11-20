/**
 * Baseline window defaults (#4). Proposed defaults, adjustable by the user and pending confirmation:
 * 4 weeks before the promo for Hot Buys, 13 weeks for TPRs, BOGOs and price locks.
 *  - Hot Buy Performance: 4 weeks.
 *  - Other Promo Performance: 13 weeks.
 *  - Post-Promo Trend, Promo History, Promo Shopper Impact and Promo Run Trend: the default of each event's promo type.
 * The user can still pick 2, 4, 8, 13 or 52 weeks in every view.
 */
import type { PromoType } from '../data/promos';
import type { TabId } from './filters';
import { BASELINE_WEEKS, type BaselineWeeks } from './kpis';

export { BASELINE_WEEKS, type BaselineWeeks };

/** Weeks of the baseline window, or 'byType' for the proposed default of each event's promo type. */
export type BaselineSetting = BaselineWeeks | 'byType';

/**
 * Proposed default by promo type (#4). "Other temporary price reduction" (OTH) has no value of its own in the
 * proposal; it takes 13 weeks, the default of Other Promo Performance, the view that holds it.
 */
export const PROPOSED_BASELINE_BY_TYPE: Record<PromoType, BaselineWeeks> = { HB: 4, TPR: 13, BOGO: 13, PL: 13, OTH: 13 };

export const BASELINE_PENDING_TEXT = 'Proposed default, pending confirmation (#4)';

/** Default baseline of a view (#4). */
export function viewBaselineDefault(tab: TabId): BaselineSetting {
  if (tab === 'hotbuy') return PROPOSED_BASELINE_BY_TYPE.HB;
  if (tab === 'other') return 13;
  return 'byType';
}

/** The setting a view uses: the user's choice when there is one, otherwise the view default. */
export function effectiveBaseline(tab: TabId, choice: BaselineWeeks | null): BaselineSetting {
  return choice ?? viewBaselineDefault(tab);
}

/** Weeks of the baseline window for one event. */
export function baselineWeeksFor(type: PromoType, setting: BaselineSetting): BaselineWeeks {
  return setting === 'byType' ? PROPOSED_BASELINE_BY_TYPE[type] : setting;
}

/** Short text for captions: "4-week baseline" or "baseline by promo type (4 / 13 weeks)". */
export function baselineText(setting: BaselineSetting): string {
  return setting === 'byType' ? 'baseline by promo type (Hot Buy 4 wk, others 13 wk)' : `${setting}-week baseline`;
}
