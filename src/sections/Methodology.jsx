import { useState } from 'react';
import { useJsonData } from '../hooks/useJsonData.js';
import { formatNumber, formatPct } from '../lib/format.js';

export function Methodology() {
  const [expanded, setExpanded] = useState(false);
  const { data: summary } = useJsonData('overall_summary.json');
  const { data: violationTypes } = useJsonData('by_violation_type.json');

  const unresolved = expanded
    ? (violationTypes ?? []).filter((d) => d.category === 'mixed_or_unresolved').sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
    : [];

  return (
    <section id="methodology" className="section">
      <details className="methodology" onToggle={(e) => setExpanded(e.target.open)}>
        <summary>Methodology and limitations</summary>

        <div className="methodology__body">
          <h3 className="methodology__subhead">What counts as a repeat</h3>
          <p>
            In this analysis, a repeat means that a later violation has the same building ID and
            HPD order number, with an inspection date within <strong>365 days</strong> of the first
            record’s effective close date. The effective close date is the certified date, or the
            status-change date when no certified date is available. The order number identifies a
            kind of violation; it does not identify a specific apartment or physical condition.
          </p>

          <h3 className="methodology__subhead">Why some cases are excluded from the rate</h3>
          <p>
            A case is marked a repeat as soon as a matching record appears, but can only be marked
            “no repeat” after a full year passes with none. Cases still short of that year are{' '}
            <strong>censored</strong>, meaning they’re left out of the rate rather than counted as
            “no repeat,” since counting them now would bias the rate low simply because they’re
            newer.
            {summary && (
              <>
                {' '}Roughly {formatPct(summary.censored / summary.total)} of all closed
                violations in this dataset ({formatNumber(summary.censored)} of{' '}
                {formatNumber(summary.total)}) are currently censored this way, so the published
                rate reflects only the closed violations old enough to judge and could shift as
                those cases mature.
              </>
            )}
          </p>

          <h3 className="methodology__subhead">Why some categories are excluded from rankings</h3>
          <p>
            Rate rankings include only violation types, neighborhoods, and registrations with at
            least 25 classifiable closed violations. Below that threshold, a single case can move
            a rate sharply enough to be misleading.
          </p>

          <div className="threshold-examples">
            <div className="threshold-example">
              <span className="threshold-example__stat">1 repeat out of 1 case = 100%</span>
              <span className="threshold-example__verdict">Insufficient evidence for ranking</span>
            </div>
            <div className="threshold-example">
              <span className="threshold-example__stat">22 repeats out of 25 cases = 88%</span>
              <span className="threshold-example__verdict">Eligible for comparison</span>
            </div>
          </div>
          <p className="threshold-examples__note">
            These are illustrative examples, not actual results for a particular building, owner,
            neighborhood, or violation type.
          </p>
          <p>
            The threshold reduces the risk of an unstable ranking, but it doesn’t eliminate
            statistical uncertainty, particularly for categories close to it.
          </p>

          {unresolved.length > 0 && (
            <>
              <h3 className="methodology__subhead">Records we could not confidently classify</h3>
              <p>
                A small number of violation types do not read clearly as a physical condition, an
                administrative or posting requirement, or an enforcement or legal-status record
                from the violation text alone. They are excluded from every chart on this page
                rather than assigned to a category without sufficient evidence.
              </p>
              <ul className="category-list">
                {unresolved.map((d) => (
                  <li key={d.code}>
                    <span className="category-list__name">{d.display_name}</span>
                    <span className="category-list__rate">{formatPct(d.rate)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {summary && (
            <p className="methodology-line">
              Data source:{' '}
              <a href="https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5">
                NYC HPD Housing Maintenance Code Violations (wvxf-dwi5)
              </a>
              . Covers {summary.date_range_start.slice(0, 10)} through{' '}
              {summary.data_cutoff.slice(0, 10)}, Bronx only.
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
