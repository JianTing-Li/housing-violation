export function PlaceholderSection({ id, title }) {
  return (
    <section id={id} className="section section--placeholder">
      <h2>{title}</h2>
      <p className="placeholder-note">Coming in the next build step.</p>
    </section>
  );
}
