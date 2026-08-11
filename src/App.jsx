import { Nav } from './components/Nav.jsx';
import { Footer } from './components/Footer.jsx';
import { Hero } from './sections/Hero.jsx';
import { OverallRecurrence } from './sections/OverallRecurrence.jsx';
import { Severity } from './sections/Severity.jsx';
import { ViolationTypes } from './sections/ViolationTypes.jsx';
import { Neighborhoods } from './sections/Neighborhoods.jsx';
import { Owners } from './sections/Owners.jsx';
import { Methodology } from './sections/Methodology.jsx';
import { Recommendations } from './sections/Recommendations.jsx';

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <OverallRecurrence />
        <Severity />
        <ViolationTypes />
        <Neighborhoods />
        <Owners />
        <Methodology />
        <Recommendations />
      </main>
      <Footer />
    </>
  );
}
