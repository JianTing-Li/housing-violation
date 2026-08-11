export function Callout({ children }) {
  return (
    <div className="callout">
      <span className="callout__label">Potential policy test</span>
      <p>{children}</p>
    </div>
  );
}
