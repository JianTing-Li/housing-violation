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
        These are violation records, not a direct record of building conditions. A repeat
        violation does not show that the exact condition returned, that it involved the same
        apartment, or why it was recorded again.
      </p>
    </footer>
  );
}
