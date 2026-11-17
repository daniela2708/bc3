import { describe, expect, it } from 'vitest';
import { EVENTS } from '../data/promos';
import type { EventCtx } from './metrics';
import { deriveShopper, emptyShopper, eventShopper, shopperOf, storeTxnsOf } from './shopper';

const ctx: EventCtx = { baselineWeeks: 4, level: 'category', itemMask: null, storeShare: null };

describe('Promo Shopper Impact (aggregates only)', () => {
  it('exposes totals per event only, with no customer- or card-level fields', () => {
    const s = eventShopper(EVENTS[0], ctx);
    expect(Object.values(s).every((v) => typeof v === 'number' && Number.isFinite(v))).toBe(true);
    expect(Object.keys(s).some((k) => /card|customer|household_id|member/i.test(k))).toBe(false);
  });
  it('rates stay in range', () => {
    for (const e of EVENTS.slice(0, 200)) {
      const m = deriveShopper(eventShopper(e, ctx));
      expect(m.newToCat!).toBeGreaterThan(0);
      expect(m.newToCat!).toBeLessThan(0.5);
      if (m.repeatRate !== null) expect(m.repeatRate).toBeLessThanOrEqual(0.6);
      expect(m.basket!).toBeGreaterThan(0);
    }
  });
  it('Transaction Count counts overlapping promo days once', () => {
    const pair = EVENTS.flatMap((x) => EVENTS.filter((y) => y.idx > x.idx && y.start === x.start && y.end === x.end).map((y) => [x.idx, y.idx]))[0];
    expect(pair).toBeDefined();
    const [a, b] = pair;
    expect(storeTxnsOf([a, b])).toBeCloseTo(storeTxnsOf([a]), 4);
    expect(shopperOf([a, b], ctx).storeTxns).toBeCloseTo(storeTxnsOf([a]), 4);
  });
  it('an empty selection gives nulls for every rate', () => {
    const m = deriveShopper(emptyShopper());
    expect(m.basket).toBeNull();
    expect(m.spendChange).toBeNull();
    expect(m.repeatRate).toBeNull();
    expect(m.newToCat).toBeNull();
  });
});
