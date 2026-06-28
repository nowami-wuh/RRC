import { useEffect, useState } from 'react';
import { fetchPackages } from '../api/api';
import '../styles/package-rate.css';

export default function PackageRate() {
  const [packages, setPackages] = useState([]);
  const [activeSection, setActiveSection] = useState('cosupplier');

  useEffect(() => {
    fetchPackages().then((data) => setPackages(data.packages || [])).catch(() => setPackages([]));
  }, []);

  const sections = packages.reduce((acc, pkg) => {
    acc[pkg.section] = acc[pkg.section] || [];
    acc[pkg.section].push(pkg);
    return acc;
  }, {});

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Package Rate</h1>
      </header>

      <div className="section-tabs">
        {Object.keys(sections).map((section) => (
          <button
            key={section}
            className={`section-tab ${activeSection === section ? 'active' : ''}`}
            onClick={() => setActiveSection(section)}
            data-section={section}
          >
            {section === 'cosupplier' ? 'Co-Supplier Rate' : 'Wedding Rate'}
          </button>
        ))}
      </div>

      <div className="packages-wrapper" id="packagesWrapper">
        {(sections[activeSection] || []).map((pkg) => (
          <div key={pkg.name} className="package-card" data-color={pkg.color}>
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
        ))}
      </div>
    </>
  );
}
