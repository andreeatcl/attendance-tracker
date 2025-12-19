export default function Field({ label, hint, children }) {
  return (
    <label className="field">
      <div className="field-label">{label}</div>
      {children}
      {hint ? <div className="field-hint">{hint}</div> : null}
    </label>
  );
}
