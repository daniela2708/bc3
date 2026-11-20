import { useMemo, useState, type ReactNode } from 'react';
import { ChartCard, PromoWindowChart } from '../components/Charts';
import { Segmented } from '../components/ui';
import { PRICE_GROUPS } from '../data/products';
import type { PromoEvent } from '../data/promos';
import type { EventCtx } from '../lib/metrics';
import { defaultGranularity, promoSeries, seriesTable, type Granularity, type SeriesColumns, type SeriesKey } from '../lib/series';
import type { BlockId } from '../lib/settings';
import { BlockSettings, SettingTags } from './common';

/**
 * "<Weekly | Daily> <measure> vs. baseline" for one event, with the Baseline, Promo and After windows shaded. Daily /
 * Weekly defaults to Weekly for events longer than one ad week and Daily for one-week events. Render it with
 * key={event index} so the choice resets when another event is picked.
 */
export function PromoWindowCard({
  event,
  ctx,
  seriesKey,
  measure,
  columns,
  format,
  tickFormat,
  baselineFormat,
  height = 260,
  block,
  picker,
}: {
  /** Local filter shown in the card header (e.g. the Event dropdown). */
  picker?: ReactNode;
  /** Which block this chart is, for its setting tags and block-level controls (layout rules 5 and 6). */
  block: BlockId;
  event: PromoEvent;
  ctx: EventCtx;
  seriesKey: SeriesKey;
  /** e.g. "Net Customer Sales" or "Units". */
  measure: string;
  columns: SeriesColumns;
  format: (v: number) => string;
  /** Round axis labels (moneyAxis / volumeAxis). */
  tickFormat: (v: number) => string;
  /** Format of the weekly baseline in the tooltip and table note. */
  baselineFormat: (v: number) => string;
  height?: number;
}) {
  const [gran, setGran] = useState<Granularity>(defaultGranularity(event));
  const sr = useMemo(() => promoSeries(event, ctx, gran, seriesKey), [event, ctx, gran, seriesKey]);
  const word = gran === 'weekly' ? 'Weekly' : 'Daily';
  const w = sr.windows;
  const windowText = sr.baselineShownWeeks < w.baseline.weeks ? `baseline window ${w.baseline.weeks} weeks (last ${sr.baselineShownWeeks} shown in Daily)` : `baseline window ${w.baseline.weeks} weeks`;
  const note = `Baseline ${baselineFormat(sr.baselinePerWeek)} / week · ${windowText}${w.baseline.partial ? ', cut at the start of the data' : ''} · after 4 weeks`;
  return (
    <ChartCard
      title={`${word} ${measure} vs. baseline`}
      subtitle={`${PRICE_GROUPS[event.pg].name}, ${event.id}`}
      controls={
        <>
          {picker}
          <Segmented<Granularity>
            small
            label="Chart granularity"
            value={gran}
            onChange={setGran}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
            ]}
          />
          <BlockSettings block={block} />
        </>
      }
      tags={<SettingTags block={block} />}
      table={seriesTable(sr, columns)}
      tableNote={note}
      height={height}
    >
      <PromoWindowChart data={sr.points} format={format} axisFormat={tickFormat} actualLabel={`${word} ${measure}`} weekly={gran === 'weekly'} note={note} />
    </ChartCard>
  );
}
