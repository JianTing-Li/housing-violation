import { useJsonData } from '../hooks/useJsonData.js';

export function Footer() {
  const { data } = useJsonData('overall_summary.json');

  return (
    <footer className="footer">
      <p>
        Data: NYC HPD Housing Maintenance Code Violations (
        <a href="https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5">
          wvxf-dwi5
        </a>
        ){data && <> · last updated {data.last_updated.slice(0, 10)}</>}
      </p>
      <p className="footer__limitations">
        This data tracks violation records, not ground truth about a building's condition. It
        can't distinguish a landlord neglecting a repair from a genuinely failing, hard-to-fix
        piece of infrastructure — both look the same as a "recurrence" here.
      </p>
    </footer>
  );
}
