import { describe, expect, it } from 'vitest';
import { CAT_ITEMS } from '../data/generate';
import { PRICE_GROUPS } from '../data/products';
import { EVENTS } from '../data/promos';
import { INTENSITY, intensityBand } from './fatigue';
import { DEFAULT_STATE, fromQuery, toQuery } from './filters';
import { categoryIntensity } from './shopperDetail';
import { nextSubTab, openInEventDetail, parseProposal, PROPOSAL_CHIP, PROPOSALS, subTabLabel } from './shopperProposals';

const hb = EVENTS.find((e) => e.type === 'HB' && e.start > 400 && e.end + 40 < 1000)!;

describe('Promo Shopper Impact subtabs', () => {
  it('four subtabs: the current view first, then the proposals A, B, C with their "What to look at" line', () => {
    expect(PROPOSALS.map(subTabLabel)).toEqual(['Current · Event panels', 'A · Category summary', 'B · Event detail', 'C · Executive snapshot']);
    expect(PROPOSALS.map((p) => p.proposal)).toEqual([false, true, true, true]);
    expect(PROPOSALS.slice(1).map((p) => p.look)).toEqual([
      'Which categories gain buyers, and is the lift real vs. last year?',
      'Did this promotion increase buyers and baskets above their usual?',
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

describe('Promo Shopper Impact proposal metrics', () => {
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
