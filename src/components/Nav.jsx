import { useEffect, useState } from 'react';

const LINKS = [
  { id: 'overview', label: 'Overview' },
  { id: 'severity', label: 'Severity' },
  { id: 'violation-types', label: 'Violation Types' },
  { id: 'neighborhoods', label: 'Neighborhoods' },
  { id: 'owners', label: 'Owners' },
  { id: 'recommendations', label: 'Recommendations' },
];

export function Nav() {
  const [activeId, setActiveId] = useState(LINKS[0].id);

  useEffect(() => {
    const sections = LINKS.map((link) => document.getElementById(link.id)).filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function handleClick(e, id) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <nav className="nav">
      <ul className="nav__list">
        {LINKS.map((link) => (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              className={activeId === link.id ? 'nav__link nav__link--active' : 'nav__link'}
              onClick={(e) => handleClick(e, link.id)}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
