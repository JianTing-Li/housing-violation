import { useState } from 'react';
import { useJsonData } from '../hooks/useJsonData.js';
import { formatPct } from '../lib/format.js';

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
        <summary>What this does—and doesn’t—tell us</summary>

        <div className="methodology__body">
          <p>
            In this analysis, a repeat means that a later violation has the same building ID and
            HPD order number, with an inspection date within <strong>365 days</strong> of the first
            record’s effective close date. The effective close date is the certified date, or the
            status-change date when no certified date is available. The order number identifies a
            kind of violation; it does not identify a specific apartment or physical condition.
          </p>
          <p>
            A case is classified as a repeat as soon as a matching record appears within that
            year. A case counts as “no repeat” only after the full year passes without a match.
            Newer cases with no match yet are <strong>censored</strong>, meaning they are left out
            of the rate until there is enough follow-up time. Counting them as “no repeat” now
            would make the rate look lower simply because they are newer.
          </p>
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
            Rates based on very few cases can change sharply as new records arrive. The 25-case
            threshold reduces the risk of an unstable ranking driven by a small number of records.
            It does not eliminate statistical uncertainty, particularly for categories close to
            the threshold.
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
