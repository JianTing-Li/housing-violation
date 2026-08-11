export function Callout({ children }) {
  return (
    <div className="callout">
      <span className="callout__label">Recommendation</span>
      <p>{children}</p>
    </div>
  );
}
