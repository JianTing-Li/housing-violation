export function Callout({ children }) {
  return (
    <div className="callout">
      <span className="callout__label">One idea to test</span>
      <p>{children}</p>
    </div>
  );
}
