export default function PackageCard({ pkg }) {
  return (
    <div className="package-card" data-color={pkg.color}>
      <div className={`package-header ${pkg.color}`}>
        <div className="package-header-text">
          <span className="package-name">{pkg.name}</span>
          <span className="package-subtitle">{pkg.subtitle}</span>
        </div>
        <span className="package-occasion">{pkg.occasion}</span>
      </div>
      <div className="package-body">
        {pkg.groups.map((group) => (
          <div key={group.category} className="package-section">
            <h4 className="section-label">{group.category}</h4>
            <div className="divider" />
            <ul className="equipment-list">
              {group.items.map((item, idx) => (
                <li key={idx}><span className="qty">{item.qty} {item.unit}</span><span className="item">{item.name}</span></li>
              ))}
            </ul>
          </div>
        ))}
        <div className="divider" />
        <p className="note">{pkg.note}</p>
        <div className="package-pricing">
          <div className="price-regular">Package Cost: ₱{pkg.price.toLocaleString()}</div>
          <div className="price-promo">Promo Price: (₱{pkg.promo.toLocaleString()})</div>
        </div>
      </div>
    </div>
  );
}
