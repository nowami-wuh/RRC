export default function FormSection({ title, children }) {
  return (
    <div className="info-section">
      <div className="section-label-row"><span>{title}</span></div>
      <div className="info-card">{children}</div>
    </div>
  );
}
