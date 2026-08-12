import { useEffect, useState } from 'react';

const LINKS = [
  { id: 'overview', label: 'Overview' },
  { id: 'severity', label: 'Severity' },
  { id: 'violation-types', label: 'Violation types' },
  { id: 'neighborhoods', label: 'Neighborhoods' },
  { id: 'owners', label: 'Owners' },
  { id: 'recommendations', label: 'Next steps' },
];

export function Nav() {
  const [activeId, setActiveId] = useState(LINKS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );

    // Several sections wait on an async data fetch before rendering their
    // <section id="..."> at all (see useJsonData), so they don't exist in
    // the DOM yet when this effect first runs. Watch for them to mount
    // and hand each one to the observer as it appears, instead of only
    // capturing whichever sections happened to be present synchronously.
    const observedIds = new Set();

    function observeAvailableSections() {
      LINKS.forEach((link) => {
        if (observedIds.has(link.id)) return;
        const el = document.getElementById(link.id);
        if (el) {
          observer.observe(el);
          observedIds.add(link.id);
        }
      });
    }

    observeAvailableSections();

    const mutationObserver = new MutationObserver(() => {
      observeAvailableSections();
      if (observedIds.size === LINKS.length) {
        mutationObserver.disconnect();
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
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
