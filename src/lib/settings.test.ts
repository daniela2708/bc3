import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, TABS } from './filters';
import { activeTag, AFFECTS, affectsText, barSettings, blockSettings, tagsFor, type BlockId } from './settings';

const S = { baseline: DEFAULT_STATE.baseline, basis: DEFAULT_STATE.basis, level: DEFAULT_STATE.level, weights: DEFAULT_STATE.weights };
const keys = (tab: Parameters<typeof tagsFor>[0], block: BlockId, s = S) => tagsFor(tab, block, s).map((t) => t.key);

describe('Hot Buy Score weights (layout rules 5 and 6)', () => {
  it('Weights changes only the score blocks in Hot Buy Performance', () => {
    expect(AFFECTS.hotbuy.weights!.blocks).toEqual(['tiles', 'table']);
    expect(AFFECTS.shopper.weights).toBeUndefined();
    expect(barSettings('shopper')).not.toContain('weights');
    for (const tab of ['other', 'post', 'history', 'trend'] as const) expect(AFFECTS[tab].weights).toBeUndefined();
    expect(keys('hotbuy', 'salesChart')).not.toContain('weights');
    expect(keys('shopper', 'panels')).not.toContain('weights');
  });
});

describe('calculation settings bar (layout rule 5)', () => {
  it('shows only the settings that change more than one block of the view', () => {
    expect(barSettings('hotbuy')).toEqual(['baseline', 'basis', 'cann', 'weights']);
    expect(barSettings('other')).toEqual(['baseline', 'basis', 'cann']);
    expect(barSettings('history')).toEqual(['baseline', 'basis', 'cann']);
    expect(barSettings('trend')).toEqual(['baseline', 'basis', 'cann']);
    expect(barSettings('post')).toEqual(['baseline']);
    expect(barSettings('shopper')).toEqual(['baseline']);
  });
  it('a setting that changes one block lives in that block: Sales basis in the Post-Promo sales chart', () => {
    expect(blockSettings('post', 'salesChart')).toEqual(['basis']);
    expect(blockSettings('post', 'unitsChart')).toEqual([]);
    expect(blockSettings('hotbuy', 'salesChart')).toEqual([]);
  });
  it('Rows is not a calculation setting: it changes only the table and lives in its header', () => {
    for (const t of TABS) expect(Object.keys(AFFECTS[t.id])).not.toContain('rows');
  });
  it('every control used in a view has an "Affects: …" text', () => {
    for (const t of TABS)
      for (const k of ['baseline', 'basis', 'cann'] as const) {
        const text = affectsText(t.id, k);
        if (AFFECTS[t.id][k]) expect(text).toMatch(/^Affects: \S/);
        else expect(text).toBeUndefined();
      }
  });
});

describe('active-value tags (layout rule 6)', () => {
  it('each affected block shows the tag of every setting that changes it', () => {
    expect(keys('hotbuy', 'tiles')).toEqual(['baseline', 'basis', 'cann', 'weights']);
    expect(keys('hotbuy', 'salesChart')).toEqual(['baseline', 'basis']);
    expect(keys('hotbuy', 'bridge')).toEqual(['baseline', 'basis', 'cann']);
    expect(keys('hotbuy', 'table')).toEqual(['baseline', 'basis', 'cann', 'weights']);
    expect(keys('other', 'runs')).toEqual(['baseline', 'basis', 'cann']);
    expect(keys('post', 'unitsChart')).toEqual(['baseline']);
    expect(keys('post', 'salesChart')).toEqual(['baseline', 'basis']);
    expect(keys('trend', 'liftChart')).toEqual(['baseline', 'basis']);
    expect(keys('trend', 'netIncChart')).toEqual(['baseline', 'basis', 'cann']);
    expect(keys('shopper', 'panels')).toEqual(['baseline']);
  });
  it('blocks that no setting changes show no tag', () => {
    expect(keys('hotbuy', 'unitsChart')).toEqual([]);
    expect(keys('post', 'bridge')).toEqual([]);
    expect(keys('shopper', 'salesChart')).toEqual([]);
  });
  it('shows the default values plainly', () => {
    expect(tagsFor('hotbuy', 'tiles', S).map((t) => [t.text, t.changed])).toEqual([
      ['Baseline 4 wk', false],
      ['Net Customer Sales', false],
      ['Subcategory level', false],
      ['Current weights', false],
    ]);
    expect(activeTag('other', 'baseline', S).text).toBe('Baseline 13 wk');
    expect(activeTag('trend', 'baseline', S).text).toBe('Baseline by promo type');
  });
  it('highlights a value that differs from the default and says what changed', () => {
    expect(activeTag('hotbuy', 'baseline', { ...S, baseline: 13 })).toMatchObject({ changed: true, text: 'Baseline 13 wk (default 4)' });
    expect(activeTag('hotbuy', 'basis', { ...S, basis: 'gross' })).toMatchObject({ changed: true, text: 'Gross Sales (default Net Customer)' });
    expect(activeTag('hotbuy', 'cann', { ...S, level: 'category' })).toMatchObject({ changed: true, text: 'Category level (default Subcategory)' });
    expect(activeTag('hotbuy', 'weights', S)).toMatchObject({ changed: false, text: 'Current weights' });
    expect(activeTag('hotbuy', 'weights', { ...S, weights: 'proposed' })).toMatchObject({ changed: true, text: 'Proposed weights (default Current)' });
    expect(activeTag('trend', 'baseline', { ...S, baseline: 4 })).toMatchObject({ changed: true, text: 'Baseline 4 wk (default by promo type)' });
    expect(activeTag('other', 'baseline', { ...S, baseline: 13 }).changed).toBe(false);
  });
  it('each tag carries the same "Affects: …" text as its control', () => {
    for (const t of tagsFor('history', 'table', S)) expect(t.affects).toBe(affectsText('history', t.key));
  });
});
