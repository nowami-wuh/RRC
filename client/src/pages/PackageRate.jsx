import { useEffect, useState } from 'react';
import { fetchPackages } from '../api/api';
import '../styles/package-rate.css';

function peso(n) {
  return Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PackageRate() {
  const [allPackages, setAllPackages] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [activeTab, setActiveTab]     = useState('packages');
  const [collapsed, setCollapsed]     = useState(new Set());

  useEffect(() => {
    fetchPackages()
      .then((data) => {
        setAllPackages(data.packages || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load package rates.');
        setLoading(false);
      });
  }, []);

  const mainPackages    = allPackages.filter((p) => p.section === 'cosupplier');
  const equipmentAddons = allPackages.filter((p) => p.section === 'equipment');
  const effectsAddons   = allPackages.filter((p) => p.section === 'effects');
  const miscItems       = allPackages.filter((p) => p.section === 'misc');

  const tabPositions = { packages: '0%', addons: '33.333%', misc: '66.666%' };

  function toggleCollapse(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="main-content">
      {/* ── Top Tabs ── */}
      <div className="top-tabs">
        <button
          className={`top-tab${activeTab === 'packages' ? ' active' : ''}`}
          onClick={() => setActiveTab('packages')}
        >
          PACKAGES
        </button>
        <button
          className={`top-tab${activeTab === 'addons' ? ' active' : ''}`}
          onClick={() => setActiveTab('addons')}
        >
          ADD-ONS
        </button>
        <button
          className={`top-tab${activeTab === 'misc' ? ' active' : ''}`}
          onClick={() => setActiveTab('misc')}
        >
          MISCELLANEOUS
        </button>
      </div>
      <div className="top-tab-track">
        <div
          className="top-tab-indicator"
          style={{ left: tabPositions[activeTab] }}
        />
      </div>

      <div className="tab-body">
        {loading && <p style={{ color: '#666', fontStyle: 'italic' }}>Loading package rates…</p>}
        {error && <p style={{ color: '#c62828' }}>{error}</p>}

        {/* ── TAB: PACKAGES ── */}
        {activeTab === 'packages' && !loading && (
          <div className="tab-panel active">
            <div className="package-list">
              {mainPackages.map((pkg) => {
                const isCollapsed = collapsed.has(pkg.id);
                return (
                  <div
                    key={pkg.id || pkg.name}
                    className={`package-card${isCollapsed ? ' collapsed' : ''}`}
                  >
                    <div
                      className="package-card-tab"
                      onClick={() => toggleCollapse(pkg.id)}
                    >
                      {pkg.name}
                    </div>
                    <div className="package-card-body">
                      <div
                        className="package-header-strip"
                        onClick={() => toggleCollapse(pkg.id)}
                      >
                        <svg
                          className="collapse-chevron"
                          viewBox="0 0 24 24"
                          width="20"
                          height="20"
                          fill="currentColor"
                        >
                          <path d="M7 10l5 5 5-5z" />
                        </svg>
                        <div className="package-header-info">
                          <div className="package-basic-title">{pkg.subtitle}</div>
                          <div className="package-occasion">{pkg.occasion}</div>
                        </div>
                        <div className="package-price-block">
                          <div className="package-price">₱{peso(pkg.price)}</div>
                          {pkg.promo > 0 && (
                            <div className="package-promo">
                              (promo price ₱{peso(pkg.promo)})
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="package-content">
                        {(pkg.groups || []).map((group, gIdx) => (
                          <div key={gIdx} className="equip-section">
                            <div className="equip-category-sidebar">{group.category}</div>
                            <div className="equip-table-wrap">
                              <div className="equip-table-header">
                                <span>Equipment Type</span>
                                <span>Qty</span>
                                <span>Unit</span>
                              </div>
                              {(group.items || []).map((item, iIdx) => {
                                const parts = item.qty.split(' ');
                                const qNum = parts[0] || '1';
                                const qUnit = parts.slice(1).join(' ') || 'pc';
                                return (
                                  <div key={iIdx} className="equip-row">
                                    <span className="equip-name">{item.name}</span>
                                    <span className="qty-val">{qNum}</span>
                                    <span className="equip-unit">{qUnit}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {pkg.note && (
                          <div className="notes-block">
                            <span className="notes-label">Notes:</span>
                            <div className="notes-box">
                              <ul>
                                {pkg.note.split('\n').filter(Boolean).map((n, ni) => (
                                  <li key={ni}>{n}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: ADD-ONS ── */}
        {activeTab === 'addons' && !loading && (
          <div className="tab-panel active">
            <div className="addon-card">
              <div className="addon-card-header">
                <span>Equipment</span>
                <span>Price (Php)</span>
              </div>
              <div className="addon-rows">
                {equipmentAddons.map((pkg) => (
                  <div key={pkg.id || pkg.name} className="addon-row">
                    <div className="addon-row-left">
                      <span className="addon-row-name">{pkg.name}</span>
                      {pkg.subtitle && <span className="addon-row-desc">{pkg.subtitle}</span>}
                    </div>
                    <div className="addon-row-right">
                      <div className="addon-price-block">
                        <div className="addon-price">₱{peso(pkg.price)}</div>
                        {pkg.promo > 0 && <div className="addon-promo">promo ₱{peso(pkg.promo)}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="addon-card">
              <div className="addon-card-header">
                <span>Special Effects</span>
                <span>Price (Php)</span>
              </div>
              <div className="addon-rows">
                {effectsAddons.map((pkg) => (
                  <div key={pkg.id || pkg.name} className="addon-row">
                    <div className="addon-row-left">
                      <span className="addon-row-name">{pkg.name}</span>
                      {pkg.subtitle && <span className="addon-row-desc">{pkg.subtitle}</span>}
                    </div>
                    <div className="addon-row-right">
                      <div className="addon-price-block">
                        <div className="addon-price">₱{peso(pkg.price)}</div>
                        {pkg.promo > 0 && <div className="addon-promo">promo ₱{peso(pkg.promo)}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: MISCELLANEOUS ── */}
        {activeTab === 'misc' && !loading && (
          <div className="tab-panel active">
            <div className="misc-card">
              <div className="misc-card-header">Miscellaneous</div>
              <div className="misc-rows">
                {miscItems.map((pkg) => (
                  <div key={pkg.id || pkg.name} className="misc-row">
                    <span className="misc-row-name">{pkg.name}</span>
                    <span className="misc-row-value">{pkg.subtitle}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
