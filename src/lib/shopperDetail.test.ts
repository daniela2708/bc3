import { describe, expect, it } from 'vitest';
import { CAT_ITEMS } from '../data/generate';
import { ITEMS, PRICE_GROUPS } from '../data/products';
import { EVENTS } from '../data/promos';
import { INTENSITY, intensityBand } from './fatigue';
import { DEFAULT_STATE, fromQuery, toQuery } from './filters';
import { baselineWindow, sums, type EventCtx } from './metrics';
import { eventShopper } from './shopper';
import { alsoBoughtCategories, brandShare, buyerSources, categoryIntensity, multiItemBaskets, multiUnitShare, sameAdPromos } from './shopperDetail';
import { nextSubTab, openInEventDetail, parseProposal, PROPOSAL_CHIP, PROPOSALS, subTabLabel } from './shopperProposals';

const ctx: EventCtx = { baselineWeeks: 4, level: 'sub', itemMask: null, storeShare: null };
const hb = EVENTS.find((e) => e.type === 'HB' && e.start > 400 && e.end + 40 < 1000)!;

describe('Promo Shopper Impact subtabs', () => {
  it('four subtabs: the current view first, then the proposals A, B, C with their "What to look at" line', () => {
    expect(PROPOSALS.map(subTabLabel)).toEqual(['Current · Event panels', 'A · Category summary', 'B · Event detail', 'C · Executive snapshot']);
    expect(PROPOSALS.map((p) => p.proposal)).toEqual([false, true, true, true]);
    expect(PROPOSALS.slice(1).map((p) => p.look)).toEqual([
      'Which categories gain buyers, and is the lift real vs. last year?',
      'Did this promotion bring new shoppers and bigger baskets, or just discount existing buyers?',
      'Which Hot Buys should we run again, refine or reconsider?',
    ]);
    expect(PROPOSAL_CHIP).toBe('Proposals for review');
  });

  it('keyboard: arrows move and wrap, Home / End jump, other keys do nothing', () => {
    expect(nextSubTab('current', 'ArrowRight')).toBe('A');
    expect(nextSubTab('A', 'ArrowRight')).toBe('B');
    expect(nextSubTab('B', 'ArrowRight')).toBe('C');
    expect(nextSubTab('C', 'ArrowRight')).toBe('current');
    expect(nextSubTab('current', 'ArrowLeft')).toBe('C');
    expect(nextSubTab('B', 'ArrowUp')).toBe('A');
    expect(nextSubTab('C', 'Home')).toBe('current');
    expect(nextSubTab('current', 'End')).toBe('C');
    for (const k of ['Enter', ' ', 'Tab', 'a']) expect(nextSubTab('B', k)).toBeNull();
  });

  it('sp in the URL: A, B and C round-trip (so a reload keeps them); no sp or anything else is the current view', () => {
    expect(fromQuery('tab=shopper', EVENTS.length).sp).toBe('current');
    for (const sp of ['A', 'B', 'C'] as const) {
      const s = fromQuery(`tab=shopper&sp=${sp}`, EVENTS.length);
      expect(s.sp).toBe(sp);
      // Reload: the URL the app writes reads back to the same subtab.
      expect(fromQuery(toQuery(s), EVENTS.length).sp).toBe(sp);
    }
    expect(fromQuery('tab=shopper&sp=current', EVENTS.length).sp).toBe('current');
    expect(toQuery({ ...DEFAULT_STATE, tab: 'shopper' })).not.toMatch(/(^|&)sp=/);
    for (const bad of ['D', 'a', 'b', 'AB', '', '%3Cscript%3E', 'B%00', ' B', 'Current']) expect(fromQuery(`tab=shopper&sp=${bad}`, EVENTS.length).sp).toBe('current');
    expect(parseProposal('C')).toBe('C');
    expect(parseProposal('c')).toBe('current');
  });

  it('a card in C opens its event in B', () => {
    const s = openInEventDetail({ ...DEFAULT_STATE, tab: 'shopper', sp: 'C' }, hb.idx);
    expect(s).toMatchObject({ tab: 'shopper', sp: 'B', sel: hb.idx });
    expect(fromQuery(toQuery(s), EVENTS.length)).toMatchObject({ sp: 'B', sel: hb.idx });
  });
});

describe('Promo Shopper Impact new metrics', () => {
  it('brand share gain = brand share of category sales during − before, in share points', () => {
    const r = brandShare(hb, ctx);
    const pg = PRICE_GROUPS[hb.pg];
    const cat = CAT_ITEMS[pg.cat];
    const brand = cat.filter((i) => ITEMS[i].brand === pg.brand);
    const bw = baselineWindow(hb, 4);
    const before = sums(brand, bw.from, bw.to).net / sums(cat, bw.from, bw.to).net;
    const during = sums(brand, hb.start, hb.end).net / sums(cat, hb.start, hb.end).net;
    expect(r.before).toBeCloseTo(before, 10);
    expect(r.during).toBeCloseTo(during, 10);
    expect(r.gain).toBeCloseTo(during - before, 10);
    expect(r.before! > 0 && r.before! <= 1 && r.during! > 0 && r.during! <= 1).toBe(true);
    // A Hot Buy gains share for its brand.
    expect(r.gain!).toBeGreaterThan(0);
  });

  it('where buyers came from: the three parts add up to 100 % and never go below 0', () => {
    for (const e of EVENTS.slice(0, 200)) {
      const s = buyerSources(eventShopper(e, ctx));
      if (!s) continue;
      expect(s.newToCategory + s.existing + s.switched).toBeCloseTo(1, 12);
      for (const v of [s.newToCategory, s.existing, s.switched]) expect(v).toBeGreaterThanOrEqual(0);
    }
    // Hand-made aggregates: 20 % new, 50 % usual buyers, 30 % switched.
    expect(buyerSources({ buyers: 100, usualBuyers: 50, newBuyers: 20 })).toEqual({ newToCategory: 0.2, existing: 0.5, switched: expect.closeTo(0.3, 12) });
    // More usual buyers than room left: capped, switched 0.
    expect(buyerSources({ buyers: 100, usualBuyers: 95, newBuyers: 20 })).toEqual({ newToCategory: 0.2, existing: 0.8, switched: 0 });
    // Fails safely with no buyers.
    expect(buyerSources({ buyers: 0, usualBuyers: 10, newBuyers: 0 })).toBeNull();
  });

  it('multi-item baskets: 1 − e^−(u − 1) from the units per basket, before vs. during', () => {
    expect(multiUnitShare(100, 100)).toBe(0); // one unit per basket
    expect(multiUnitShare(200, 100)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(multiUnitShare(150, 100)).toBeCloseTo(1 - Math.exp(-0.5), 12);
    expect(multiUnitShare(50, 0)).toBeNull();
    const m = multiItemBaskets(eventShopper(hb, ctx));
    expect(m.before! >= 0 && m.before! < 1 && m.during! > 0 && m.during! < 1).toBe(true);
    // Promo buyers put more units in each basket than usual.
    expect(m.during!).toBeGreaterThan(m.before!);
  });

  it('also bought: 5 other categories by index, highest first; same-ad promotions share the ad week', () => {
    const cats = alsoBoughtCategories(hb);
    expect(cats).toHaveLength(5);
    expect(cats.every((c) => c.cat !== PRICE_GROUPS[hb.pg].cat)).toBe(true);
    expect([...cats].sort((a, b) => b.index - a.index)).toEqual(cats);
    expect(alsoBoughtCategories(hb)).toEqual(cats); // deterministic
    const promos = sameAdPromos(hb);
    expect(promos.length).toBeLessThanOrEqual(5);
    for (const p of promos) {
      expect(p.event).not.toBe(hb.idx);
      expect(p.share).toBeGreaterThan(0);
      expect(p.share).toBeLessThan(1);
    }
  });

  it('promo intensity per category = item-days on offer ÷ (items × days); overlapping promos count a day once', () => {
    const cat = PRICE_GROUPS[hb.pg].cat;
    const items = CAT_ITEMS[cat];
    const from = hb.start - 27;
    const to = hb.end;
    let itemDays = 0;
    for (const i of items)
      for (let d = from; d <= to; d++) if (EVENTS.some((e) => PRICE_GROUPS[e.pg].cat === cat && PRICE_GROUPS[e.pg].items.includes(i) && e.start <= d && e.end >= d)) itemDays++;
    const v = categoryIntensity(cat, from, to)!;
    expect(v).toBeCloseTo(itemDays / (items.length * (to - from + 1)), 12);
    expect(v).toBeGreaterThan(0); // the event's own items are on offer
    expect(v).toBeLessThanOrEqual(1);
    // Only the event's own days: its items are on offer every day.
    expect(categoryIntensity(cat, hb.start, hb.end)!).toBeGreaterThanOrEqual(PRICE_GROUPS[hb.pg].items.length / items.length - 1e-12);
    expect(categoryIntensity(cat, -100, -50)).toBe(0); // before the data
    expect(categoryIntensity(cat, 10, 5)).toBeNull(); // empty period
    expect(INTENSITY).toEqual({ watch: 0.15, flag: 0.25 });
    expect(intensityBand(0.149)).toBe('ok');
    expect(intensityBand(0.15)).toBe('watch');
    expect(intensityBand(0.249)).toBe('watch');
    expect(intensityBand(0.25)).toBe('flag');
    expect(intensityBand(null)).toBeNull();
  });
});
