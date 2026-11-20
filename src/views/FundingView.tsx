import { Banner, SectionHeading } from '../components/Blocks';
import { VIEW_INFO } from '../lib/viewInfo';

/**
 * KPIs the requirements workbook assigns to the Promo Funding view, and what the prototype does with each.
 * The view is not part of this dashboard (#2), so it shows no value of its own.
 */
const FUNDING_KPIS: { name: string; status: string }[] = [
  { name: 'Promo Investment $', status: 'Not shown, placement pending' },
  { name: 'Vendor Promo Funding $', status: 'Input to Net GM only' },
  { name: 'Vendor-Funded %', status: 'Not shown' },
  { name: 'Weis-Funded Promo Cost $', status: 'Not shown' },
  { name: 'Net GM $', status: 'Shown in Hot Buy and Other Promo Performance' },
  { name: 'Promo ROI', status: 'Not shown' },
];

const FUNDING_NOTICE =
  'Vendor funding analytics live in the DNP tool, so this view is not part of the Promo Effectiveness dashboard (open question #2). Vendor Promo Funding $ is still used as an input to Net Gross Margin $ and Net Incremental Gross Margin $ (#7).';

/** Promo Funding: a notice tab that keeps the workbook's view list complete. It calculates and shows no numbers. */
export default function FundingView() {
  return (
    <>
      <SectionHeading title="Promo Funding" badge={<span className="chip status-pending pending-chip">Not in this dashboard (#2)</span>} objective={VIEW_INFO.funding.objective} />
      <Banner kind="note">{FUNDING_NOTICE}</Banner>
      <section className="card funding-card" aria-label="Promo Funding KPIs in the workbook">
        <h3 className="chart-title">KPIs the workbook assigns to this view</h3>
        <ul className="funding-kpis">
          {FUNDING_KPIS.map((k) => (
            <li key={k.name}>
              <b>{k.name}</b>
              <span className="chip neutral">{k.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
