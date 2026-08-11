import { Nav } from './components/Nav.jsx';
import { Hero } from './sections/Hero.jsx';
import { PlaceholderSection } from './sections/PlaceholderSection.jsx';

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <PlaceholderSection id="severity" title="Recurrence by Severity Class" />
        <PlaceholderSection id="violation-types" title="Recurrence by Violation Type" />
        <PlaceholderSection id="neighborhoods" title="Neighborhood Patterns" />
        <PlaceholderSection id="owners" title="Owner &amp; Building Level" />
        <PlaceholderSection id="methodology" title="Methodology" />
        <PlaceholderSection id="recommendations" title="Recommendations" />
      </main>
      <footer className="footer">
        <p>
          Data: NYC HPD Housing Maintenance Code Violations (
          <a href="https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5">
            wvxf-dwi5
          </a>
          )
        </p>
      </footer>
    </>
  );
}
