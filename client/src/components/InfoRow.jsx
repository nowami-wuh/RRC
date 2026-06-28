export default function InfoRow({ label, value, onEdit }) {
  return (
    <div className="info-row">
      <div className="info-left">
        <span className="info-label">{label}</span>
        <span className="info-value">{value}</span>
      </div>
      {onEdit && <button className="pill-btn" onClick={onEdit}>Edit</button>}
    </div>
  );
}
