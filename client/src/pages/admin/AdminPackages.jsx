import { useEffect, useRef, useState } from 'react';
import {
  fetchAdminPackages,
  createAdminPackage,
  updateAdminPackage,
  deleteAdminPackage,
} from '../../api/api';

// ─── helpers ────────────────────────────────────────────────────────────────
function peso(n) {
  return Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function useToast() {
  const [toast, setToast] = useState({ show: false, msg: '', isError: false });
  const timerRef = useRef(null);

  function show(msg, isError = false) {
    clearTimeout(timerRef.current);
    setToast({ show: true, msg, isError });
    timerRef.current = setTimeout(
      () => setToast({ show: false, msg: '', isError: false }),
      3000
    );
  }

  return { toast, show };
}

// Modal backdrop click helper
function Overlay({ active, onClose, children }) {
  return (
    <div
      className={`apm-overlay${active ? ' active' : ''}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>
  );
}

// ─── SECTION KEYS ───────────────────────────────────────────────────────────
const SECTION_COSUPPLIER = 'cosupplier';
const SECTION_EQUIPMENT  = 'equipment';
const SECTION_EFFECTS    = 'effects';
const SECTION_MISC       = 'misc';

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function AdminPackages() {
  const { toast, show: showToast } = useToast();

  // ── data ──
  const [allPackages, setAllPackages] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  // ── tabs: 'packages' | 'addons' | 'misc' ──
  const [activeTab, setActiveTab] = useState('packages');

  // ── collapsed package IDs ──
  const [collapsed, setCollapsed] = useState(new Set());

  // ── Edit Package Header modal ──
  const HEADER_EMPTY = { show: false, pkgId: null, label: '', title: '', occasion: '', notes: '', price: '', promo: '', err: '' };
  const [headerModal, setHeaderModal] = useState(HEADER_EMPTY);

  // ── Add/Edit Equipment modal (inside a package) ──
  const EQUIP_EMPTY = { show: false, pkgId: null, groupIndex: null, itemIndex: null, name: '', category: 'SOUNDS', qty: '1', unit: 'pc', err: '' };
  const [equipModal, setEquipModal] = useState(EQUIP_EMPTY);

  // ── Add/Edit Add-On modal ──
  const ADDON_EMPTY = { show: false, id: null, section: SECTION_EQUIPMENT, name: '', description: '', price: '', promo: '', err: '' };
  const [addonModal, setAddonModal] = useState(ADDON_EMPTY);

  // ── Edit Misc modal ──
  const MISC_EMPTY = { show: false, id: null, label: '', value: '', err: '' };
  const [miscModal, setMiscModal] = useState(MISC_EMPTY);

  // ── Delete confirm ──
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, label: '' });

  // ── saving flag to prevent double-submit ──
  const [saving, setSaving] = useState(false);

  // ── load ──
  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminPackages();
      setAllPackages(data.packages || []);
    } catch (e) {
      setError(e.message || 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }

  // ── derived slices ──
  const mainPackages    = allPackages.filter((p) => p.section === SECTION_COSUPPLIER);
  const equipmentAddons = allPackages.filter((p) => p.section === SECTION_EQUIPMENT);
  const effectsAddons   = allPackages.filter((p) => p.section === SECTION_EFFECTS);
  const miscItems       = allPackages.filter((p) => p.section === SECTION_MISC);

  // ── toggle collapse ──
  function toggleCollapse(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ════════════════════════════════════════════
  // PACKAGE HEADER MODAL
  // ════════════════════════════════════════════
  function openHeaderModal(pkg) {
    setHeaderModal({
      show: true,
      pkgId: pkg.id,
      label: pkg.name,
      title: pkg.subtitle || '',
      occasion: pkg.occasion || '',
      notes: pkg.note || '',
      price: pkg.price != null ? String(pkg.price) : '',
      promo: pkg.promo != null ? String(pkg.promo) : '',
      err: '',
    });
  }

  async function saveHeader() {
    const { pkgId, title, occasion, notes, price, promo } = headerModal;
    if (!title.trim()) { setHeaderModal((p) => ({ ...p, err: 'Title is required.' })); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) { setHeaderModal((p) => ({ ...p, err: 'Enter a valid price.' })); return; }
    setSaving(true);
    try {
      const pkg = allPackages.find((p) => p.id === pkgId);
      await updateAdminPackage(pkgId, {
        subtitle: title.trim(),
        occasion: occasion.trim(),
        note: notes.trim(),
        price: priceNum,
        promo: promo ? parseFloat(promo) : 0,
        groups: pkg?.groups || [],
      });
      await load();
      setHeaderModal(HEADER_EMPTY);
      showToast(`"${title.trim()}" updated.`);
    } catch (e) {
      setHeaderModal((p) => ({ ...p, err: e.message || 'Failed to save.' }));
    } finally {
      setSaving(false);
    }
  }

  // ════════════════════════════════════════════
  // EQUIPMENT MODAL (within a main package)
  // ════════════════════════════════════════════
  function openAddEquip(pkgId) {
    setEquipModal({ show: true, pkgId, groupIndex: null, itemIndex: null, name: '', category: 'SOUNDS', qty: '1', unit: 'pc', err: '' });
  }

  function openEditEquip(pkgId, groupIndex, itemIndex) {
    const pkg  = allPackages.find((p) => p.id === pkgId);
    const group = pkg?.groups?.[groupIndex];
    const item  = group?.items?.[itemIndex];
    if (!item) return;
    // qty is stored as e.g. "2 pc" — split
    const parts = item.qty.split(' ');
    const qtyNum  = parts[0] || '1';
    const unitStr = parts.slice(1).join(' ') || 'pc';
    setEquipModal({ show: true, pkgId, groupIndex, itemIndex, name: item.name, category: group.category, qty: qtyNum, unit: unitStr, err: '' });
  }

  async function saveEquip() {
    const { pkgId, groupIndex, itemIndex, name, category, qty, unit } = equipModal;
    if (!name.trim()) { setEquipModal((p) => ({ ...p, err: 'Name is required.' })); return; }
    const qtyNum = parseInt(qty, 10);
    if (isNaN(qtyNum) || qtyNum < 1) { setEquipModal((p) => ({ ...p, err: 'Enter a valid quantity.' })); return; }

    const pkg = allPackages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const groups = JSON.parse(JSON.stringify(pkg.groups || []));

    if (itemIndex !== null) {
      // edit existing
      groups[groupIndex].items[itemIndex] = { qty: `${qtyNum} ${unit}`, name: name.trim() };
    } else {
      // add new — find or create group for this category
      let gIdx = groups.findIndex((g) => g.category === category);
      if (gIdx === -1) { groups.push({ category, items: [] }); gIdx = groups.length - 1; }
      groups[gIdx].items.push({ qty: `${qtyNum} ${unit}`, name: name.trim() });
    }

    setSaving(true);
    try {
      await updateAdminPackage(pkgId, { groups });
      await load();
      setEquipModal(EQUIP_EMPTY);
      showToast('Equipment saved.');
    } catch (e) {
      setEquipModal((p) => ({ ...p, err: e.message || 'Failed to save.' }));
    } finally {
      setSaving(false);
    }
  }

  async function removeEquip(pkgId, groupIndex, itemIndex) {
    const pkg = allPackages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const groups = JSON.parse(JSON.stringify(pkg.groups || []));
    groups[groupIndex].items.splice(itemIndex, 1);
    // Remove empty group
    const cleanedGroups = groups.filter((g) => g.items.length > 0);
    try {
      await updateAdminPackage(pkgId, { groups: cleanedGroups });
      await load();
      showToast('Equipment removed.');
    } catch (e) {
      showToast(e.message || 'Failed to remove.', true);
    }
  }

  async function changeQty(pkgId, groupIndex, itemIndex, delta) {
    const pkg = allPackages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const groups = JSON.parse(JSON.stringify(pkg.groups || []));
    const item = groups[groupIndex]?.items?.[itemIndex];
    if (!item) return;
    const parts  = item.qty.split(' ');
    const cur    = Math.max(1, parseInt(parts[0], 10) + delta);
    const unit   = parts.slice(1).join(' ') || 'pc';
    item.qty = `${cur} ${unit}`;
    try {
      await updateAdminPackage(pkgId, { groups });
      await load();
    } catch (e) {
      showToast(e.message || 'Failed.', true);
    }
  }

  // ════════════════════════════════════════════
  // ADD PACKAGE
  // ════════════════════════════════════════════
  async function addPackage() {
    setSaving(true);
    try {
      await createAdminPackage({
        section: SECTION_COSUPPLIER,
        name: `PACKAGE ${String.fromCharCode(65 + mainPackages.length)}`,
        subtitle: 'New Package',
        occasion: 'General Occasion',
        note: 'Package notes.',
        price: 5000,
        promo: 0,
        color: 'blue',
        groups: [{ category: 'SOUNDS', items: [] }],
      });
      await load();
      showToast('New package created. Click Edit to fill in the details.');
    } catch (e) {
      showToast(e.message || 'Failed to add package.', true);
    } finally {
      setSaving(false);
    }
  }

  // ════════════════════════════════════════════
  // DELETE PACKAGE (with confirm)
  // ════════════════════════════════════════════
  function confirmDelete(pkg) {
    setDeleteConfirm({ show: true, id: pkg.id, label: `${pkg.name} — ${pkg.subtitle}` });
  }

  async function executeDelete() {
    const { id, label } = deleteConfirm;
    setSaving(true);
    try {
      await deleteAdminPackage(id);
      setDeleteConfirm({ show: false, id: null, label: '' });
      await load();
      showToast(`"${label}" deleted.`);
    } catch (e) {
      showToast(e.message || 'Failed to delete.', true);
    } finally {
      setSaving(false);
    }
  }

  // ════════════════════════════════════════════
  // ADD-ON MODAL
  // ════════════════════════════════════════════
  function openAddAddon(section) {
    setAddonModal({ show: true, id: null, section, name: '', description: '', price: '', promo: '', err: '' });
  }

  function openEditAddon(pkg) {
    setAddonModal({
      show: true,
      id: pkg.id,
      section: pkg.section,
      name: pkg.name || '',
      description: pkg.subtitle || '',
      price: pkg.price != null ? String(pkg.price) : '',
      promo: pkg.promo != null ? String(pkg.promo) : '',
      err: '',
    });
  }

  async function saveAddon() {
    const { id, section, name, description, price, promo } = addonModal;
    if (!name.trim()) { setAddonModal((p) => ({ ...p, err: 'Name is required.' })); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) { setAddonModal((p) => ({ ...p, err: 'Enter a valid price.' })); return; }
    setSaving(true);
    try {
      if (id) {
        await updateAdminPackage(id, {
          name: name.trim(),
          subtitle: description.trim(),
          price: priceNum,
          promo: promo ? parseFloat(promo) : 0,
        });
        showToast('Add-on updated.');
      } else {
        await createAdminPackage({
          section,
          name: name.trim(),
          subtitle: description.trim(),
          occasion: 'Addon',
          note: description.trim(),
          price: priceNum,
          promo: promo ? parseFloat(promo) : 0,
          color: 'blue',
          groups: [],
        });
        showToast('Add-on created.');
      }
      await load();
      setAddonModal(ADDON_EMPTY);
    } catch (e) {
      setAddonModal((p) => ({ ...p, err: e.message || 'Failed to save.' }));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAddon(pkg) {
    if (!window.confirm(`Delete "${pkg.name}"?`)) return;
    try {
      await deleteAdminPackage(pkg.id);
      await load();
      showToast(`"${pkg.name}" deleted.`);
    } catch (e) {
      showToast(e.message || 'Failed to delete.', true);
    }
  }

  // ════════════════════════════════════════════
  // MISC MODAL
  // ════════════════════════════════════════════
  function openMiscModal(pkg) {
    setMiscModal({ show: true, id: pkg.id, label: pkg.name, value: pkg.subtitle || '', err: '' });
  }

  async function saveMisc() {
    const { id, value } = miscModal;
    if (!value.trim()) { setMiscModal((p) => ({ ...p, err: 'Value is required.' })); return; }
    setSaving(true);
    try {
      await updateAdminPackage(id, { subtitle: value.trim() });
      await load();
      setMiscModal(MISC_EMPTY);
      showToast('Miscellaneous value updated.');
    } catch (e) {
      setMiscModal((p) => ({ ...p, err: e.message || 'Failed to save.' }));
    } finally {
      setSaving(false);
    }
  }

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════
  const tabPositions = { packages: '0%', addons: '33.333%', misc: '66.666%' };

  return (
    <section className="main-content apm-root">

      {/* ── Top Tabs ── */}
      <div className="equip-tabs">
        <button
          className={`equip-tab${activeTab === 'packages' ? ' active' : ''}`}
          onClick={() => setActiveTab('packages')}
        >
          PACKAGES
        </button>
        <button
          className={`equip-tab${activeTab === 'addons' ? ' active' : ''}`}
          onClick={() => setActiveTab('addons')}
        >
          ADD-ONS
        </button>
        <button
          className={`equip-tab${activeTab === 'misc' ? ' active' : ''}`}
          onClick={() => setActiveTab('misc')}
        >
          MISCELLANEOUS
        </button>
      </div>

      {/* ── Tab Body ── */}
      <div className="apm-tab-body">

        {/* ══════════ PACKAGES TAB ══════════ */}
        {activeTab === 'packages' && (
          <div className="apm-panel">
            {loading && <p className="apm-loading">Loading…</p>}
            {error   && <p className="apm-error-msg">{error}</p>}

            <div className="apm-pkg-list">
              {mainPackages.map((pkg) => {
                const isCollapsed = collapsed.has(pkg.id);
                return (
                  <div key={pkg.id} className={`apm-card${isCollapsed ? ' collapsed' : ''}`}>
                    {/* Card label tab */}
                    <div
                      className="apm-card-tab"
                      onClick={() => toggleCollapse(pkg.id)}
                      role="button"
                    >
                      {pkg.name}
                    </div>

                    {/* Header strip */}
                    <div className="apm-header-strip" onClick={() => toggleCollapse(pkg.id)}>
                      <svg
                        className="apm-chevron"
                        viewBox="0 0 24 24" width="20" height="20" fill="currentColor"
                      >
                        <path d="M7 10l5 5 5-5z" />
                      </svg>
                      <div className="apm-header-info">
                        <div className="apm-pkg-title">{pkg.subtitle}</div>
                        <div className="apm-pkg-occasion">{pkg.occasion}</div>
                      </div>
                      <button
                        className="apm-btn-edit"
                        onClick={(e) => { e.stopPropagation(); openHeaderModal(pkg); }}
                      >
                        Edit
                      </button>
                      <div className="apm-price-block">
                        <div className="apm-price">₱{peso(pkg.price)}</div>
                        {pkg.promo > 0 && (
                          <div className="apm-promo">(promo ₱{peso(pkg.promo)})</div>
                        )}
                      </div>
                    </div>

                    {/* Expandable content */}
                    {!isCollapsed && (
                      <div className="apm-content">
                        {/* Equipment groups */}
                        {(pkg.groups || []).map((group, gIdx) => (
                          <div key={gIdx} className="apm-equip-section">
                            <div className="apm-cat-sidebar">{group.category}</div>
                            <div className="apm-equip-table">
                              <div className="apm-equip-head">
                                <span />
                                <span>Equipment Type</span>
                                <span>Qty</span>
                                <span>Unit</span>
                              </div>
                              {(group.items || []).map((item, iIdx) => {
                                const parts = item.qty.split(' ');
                                const qNum  = parts[0] || '1';
                                const qUnit = parts.slice(1).join(' ') || 'pc';
                                return (
                                  <div key={iIdx} className="apm-equip-row">
                                    <button
                                      className="apm-remove-x"
                                      title="Remove"
                                      onClick={() => removeEquip(pkg.id, gIdx, iIdx)}
                                    >
                                      &times;
                                    </button>
                                    <span
                                      className="apm-equip-name"
                                      onClick={() => openEditEquip(pkg.id, gIdx, iIdx)}
                                    >
                                      {item.name}
                                    </span>
                                    <span className="apm-qty-wrap">
                                      <span className="apm-stepper">
                                        <button className="apm-step" onClick={() => changeQty(pkg.id, gIdx, iIdx, 1)}>▲</button>
                                        <button className="apm-step" onClick={() => changeQty(pkg.id, gIdx, iIdx, -1)}>▼</button>
                                      </span>
                                      <span className="apm-qty-val">{qNum}</span>
                                    </span>
                                    <span className="apm-unit">{qUnit}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <button
                          className="apm-add-equip-link"
                          onClick={() => openAddEquip(pkg.id)}
                        >
                          <em>Add Equipment</em> <span>+</span>
                        </button>

                        {/* Notes */}
                        {pkg.note && (
                          <div className="apm-notes-block">
                            <span className="apm-notes-label">Notes:</span>
                            <div className="apm-notes-box">
                              {pkg.note.split('\n').filter(Boolean).map((n, ni) => (
                                <p key={ni} className="apm-note-line">{n}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Delete */}
                        <div className="apm-card-actions">
                          <button
                            className="apm-btn-delete"
                            onClick={() => confirmDelete(pkg)}
                          >
                            Delete Package
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="apm-add-pkg-row">
              <button className="apm-btn-add-pkg" onClick={addPackage} disabled={saving}>
                Add Package
              </button>
            </div>
          </div>
        )}

        {/* ══════════ ADD-ONS TAB ══════════ */}
        {activeTab === 'addons' && (
          <div className="apm-panel">
            {loading && <p className="apm-loading">Loading…</p>}

            {/* Equipment add-ons */}
            <div className="apm-addon-card">
              <div className="apm-addon-header">
                <span>Equipment</span>
                <span>Price (Php)</span>
              </div>
              <div className="apm-addon-rows">
                {equipmentAddons.map((pkg) => (
                  <div key={pkg.id} className="apm-addon-row">
                    <div className="apm-addon-left">
                      <span className="apm-addon-name">{pkg.name}</span>
                      {pkg.subtitle && <span className="apm-addon-desc">{pkg.subtitle}</span>}
                    </div>
                    <div className="apm-addon-right">
                      <button className="apm-addon-edit" onClick={() => openEditAddon(pkg)}>Edit</button>
                      <div className="apm-addon-price-block">
                        <span className="apm-addon-price">₱{peso(pkg.price)}</span>
                        {pkg.promo > 0 && <span className="apm-addon-promo">Promo ₱{peso(pkg.promo)}</span>}
                      </div>
                      <button className="apm-addon-del" onClick={() => deleteAddon(pkg)} title="Delete">&times;</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="apm-add-row-btn" onClick={() => openAddAddon(SECTION_EQUIPMENT)}>
                <em>Add Equipment</em> <span>+</span>
              </button>
            </div>

            {/* Special Effects add-ons */}
            <div className="apm-addon-card">
              <div className="apm-addon-header">
                <span>Special Effects</span>
                <span>Price (Php)</span>
              </div>
              <div className="apm-addon-rows">
                {effectsAddons.map((pkg) => (
                  <div key={pkg.id} className="apm-addon-row">
                    <div className="apm-addon-left">
                      <span className="apm-addon-name">{pkg.name}</span>
                      {pkg.subtitle && <span className="apm-addon-desc">{pkg.subtitle}</span>}
                    </div>
                    <div className="apm-addon-right">
                      <button className="apm-addon-edit" onClick={() => openEditAddon(pkg)}>Edit</button>
                      <div className="apm-addon-price-block">
                        <span className="apm-addon-price">₱{peso(pkg.price)}</span>
                        {pkg.promo > 0 && <span className="apm-addon-promo">Promo ₱{peso(pkg.promo)}</span>}
                      </div>
                      <button className="apm-addon-del" onClick={() => deleteAddon(pkg)} title="Delete">&times;</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="apm-add-row-btn" onClick={() => openAddAddon(SECTION_EFFECTS)}>
                <em>Add Effect</em> <span>+</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════ MISCELLANEOUS TAB ══════════ */}
        {activeTab === 'misc' && (
          <div className="apm-panel">
            {loading && <p className="apm-loading">Loading…</p>}
            <div className="apm-misc-card">
              <div className="apm-misc-header">Miscellaneous</div>
              <div className="apm-misc-rows">
                {miscItems.map((pkg) => (
                  <div key={pkg.id} className="apm-misc-row">
                    <span className="apm-misc-name">{pkg.name}</span>
                    <div className="apm-misc-right">
                      <button className="apm-misc-edit" onClick={() => openMiscModal(pkg)}>Edit</button>
                      <span className="apm-misc-value">{pkg.subtitle}</span>
                    </div>
                  </div>
                ))}
                {miscItems.length === 0 && !loading && (
                  <p className="apm-empty">No miscellaneous items yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

      </div>{/* /tab-body */}

      {/* ════ MODALS ════ */}

      {/* Edit Package Header */}
      <Overlay active={headerModal.show} onClose={() => setHeaderModal(HEADER_EMPTY)}>
        <div className="apm-modal">
          <div className="apm-modal-hd">
            <span className="apm-modal-title">Edit Package Details</span>
            <button className="apm-modal-x" onClick={() => setHeaderModal(HEADER_EMPTY)}>&times;</button>
          </div>
          <div className="apm-modal-bd">
            <label className="m-label">Package Title</label>
            <input
              className="m-input"
              value={headerModal.title}
              onChange={(e) => setHeaderModal((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. BASIC PA"
            />
            <label className="m-label" style={{ marginTop: 14 }}>Occasion / Subtitle</label>
            <input
              className="m-input"
              value={headerModal.occasion}
              onChange={(e) => setHeaderModal((p) => ({ ...p, occasion: e.target.value }))}
              placeholder="e.g. for Wedding Ceremony Only"
            />
            <label className="m-label" style={{ marginTop: 14 }}>Notes</label>
            <textarea
              className="m-input apm-textarea"
              rows={4}
              value={headerModal.notes}
              onChange={(e) => setHeaderModal((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Package notes…"
            />
            <div className="apm-mrow">
              <div style={{ flex: 1 }}>
                <label className="m-label" style={{ marginTop: 14 }}>Price (Php)</label>
                <input
                  type="number" className="m-input" min="0" step="0.01"
                  value={headerModal.price}
                  onChange={(e) => setHeaderModal((p) => ({ ...p, price: e.target.value }))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="m-label" style={{ marginTop: 14 }}>Promo Price (optional)</label>
                <input
                  type="number" className="m-input" min="0" step="0.01"
                  value={headerModal.promo}
                  onChange={(e) => setHeaderModal((p) => ({ ...p, promo: e.target.value }))}
                />
              </div>
            </div>
            {headerModal.err && <p className="m-error">{headerModal.err}</p>}
            <div className="m-actions">
              <button className="m-btn-cancel" onClick={() => setHeaderModal(HEADER_EMPTY)}>Cancel</button>
              <button className="m-btn-save" onClick={saveHeader} disabled={saving}>Save</button>
            </div>
          </div>
        </div>
      </Overlay>

      {/* Add/Edit Equipment (in package) */}
      <Overlay active={equipModal.show} onClose={() => setEquipModal(EQUIP_EMPTY)}>
        <div className="apm-modal">
          <div className="apm-modal-hd">
            <span className="apm-modal-title">{equipModal.itemIndex !== null ? 'Edit Equipment' : 'Add Equipment'}</span>
            <button className="apm-modal-x" onClick={() => setEquipModal(EQUIP_EMPTY)}>&times;</button>
          </div>
          <div className="apm-modal-bd">
            <label className="m-label">Equipment Name</label>
            <input
              className="m-input"
              value={equipModal.name}
              onChange={(e) => setEquipModal((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Main Powered Speaker"
            />
            <label className="m-label" style={{ marginTop: 14 }}>Category</label>
            <select
              className="m-input"
              value={equipModal.category}
              onChange={(e) => setEquipModal((p) => ({ ...p, category: e.target.value }))}
            >
              <option value="SOUNDS">SOUNDS</option>
              <option value="LIGHTS">LIGHTS</option>
            </select>
            <div className="apm-mrow">
              <div style={{ flex: 1 }}>
                <label className="m-label" style={{ marginTop: 14 }}>Qty</label>
                <input
                  type="number" className="m-input" min="1"
                  value={equipModal.qty}
                  onChange={(e) => setEquipModal((p) => ({ ...p, qty: e.target.value }))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="m-label" style={{ marginTop: 14 }}>Unit</label>
                <select
                  className="m-input"
                  value={equipModal.unit}
                  onChange={(e) => setEquipModal((p) => ({ ...p, unit: e.target.value }))}
                >
                  <option value="pc">pc</option>
                  <option value="pcs">pcs</option>
                  <option value="set">set</option>
                  <option value="unit">unit</option>
                </select>
              </div>
            </div>
            {equipModal.err && <p className="m-error">{equipModal.err}</p>}
            <div className="m-actions">
              <button className="m-btn-cancel" onClick={() => setEquipModal(EQUIP_EMPTY)}>Cancel</button>
              <button className="m-btn-save" onClick={saveEquip} disabled={saving}>Save</button>
            </div>
          </div>
        </div>
      </Overlay>

      {/* Add/Edit Add-On */}
      <Overlay active={addonModal.show} onClose={() => setAddonModal(ADDON_EMPTY)}>
        <div className="apm-modal">
          <div className="apm-modal-hd">
            <span className="apm-modal-title">{addonModal.id ? 'Edit Add-On' : 'Add Add-On'}</span>
            <button className="apm-modal-x" onClick={() => setAddonModal(ADDON_EMPTY)}>&times;</button>
          </div>
          <div className="apm-modal-bd">
            <label className="m-label">Name</label>
            <input
              className="m-input"
              value={addonModal.name}
              onChange={(e) => setAddonModal((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Smoke Machine"
            />
            <label className="m-label" style={{ marginTop: 14 }}>Description (optional)</label>
            <input
              className="m-input"
              value={addonModal.description}
              onChange={(e) => setAddonModal((p) => ({ ...p, description: e.target.value }))}
              placeholder="e.g. for 1 Acoustic Guitar..."
            />
            <div className="apm-mrow">
              <div style={{ flex: 1 }}>
                <label className="m-label" style={{ marginTop: 14 }}>Price (Php)</label>
                <input
                  type="number" className="m-input" min="0" step="0.01"
                  value={addonModal.price}
                  onChange={(e) => setAddonModal((p) => ({ ...p, price: e.target.value }))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="m-label" style={{ marginTop: 14 }}>Promo Price (optional)</label>
                <input
                  type="number" className="m-input" min="0" step="0.01"
                  value={addonModal.promo}
                  onChange={(e) => setAddonModal((p) => ({ ...p, promo: e.target.value }))}
                />
              </div>
            </div>
            {addonModal.err && <p className="m-error">{addonModal.err}</p>}
            <div className="m-actions">
              <button className="m-btn-cancel" onClick={() => setAddonModal(ADDON_EMPTY)}>Cancel</button>
              <button className="m-btn-save" onClick={saveAddon} disabled={saving}>Save</button>
            </div>
          </div>
        </div>
      </Overlay>

      {/* Edit Misc */}
      <Overlay active={miscModal.show} onClose={() => setMiscModal(MISC_EMPTY)}>
        <div className="apm-modal">
          <div className="apm-modal-hd">
            <span className="apm-modal-title">Edit Value</span>
            <button className="apm-modal-x" onClick={() => setMiscModal(MISC_EMPTY)}>&times;</button>
          </div>
          <div className="apm-modal-bd">
            <label className="m-label">{miscModal.label}</label>
            <input
              className="m-input"
              value={miscModal.value}
              onChange={(e) => setMiscModal((p) => ({ ...p, value: e.target.value }))}
            />
            {miscModal.err && <p className="m-error">{miscModal.err}</p>}
            <div className="m-actions">
              <button className="m-btn-cancel" onClick={() => setMiscModal(MISC_EMPTY)}>Cancel</button>
              <button className="m-btn-save" onClick={saveMisc} disabled={saving}>Save</button>
            </div>
          </div>
        </div>
      </Overlay>

      {/* Delete Confirm */}
      <Overlay active={deleteConfirm.show} onClose={() => setDeleteConfirm({ show: false, id: null, label: '' })}>
        <div className="apm-modal apm-modal-sm">
          <div className="apm-modal-hd">
            <span className="apm-modal-title">Delete Package</span>
            <button className="apm-modal-x" onClick={() => setDeleteConfirm({ show: false, id: null, label: '' })}>&times;</button>
          </div>
          <div className="apm-modal-bd">
            <p className="confirm-msg">
              Are you sure you want to delete <strong>{deleteConfirm.label}</strong>? This action cannot be undone.
            </p>
            <div className="m-actions">
              <button className="m-btn-cancel" onClick={() => setDeleteConfirm({ show: false, id: null, label: '' })}>Cancel</button>
              <button className="apm-btn-confirm-del" onClick={executeDelete} disabled={saving}>Delete</button>
            </div>
          </div>
        </div>
      </Overlay>

      {/* Toast */}
      <div className={`apm-toast${toast.show ? ' show' : ''}${toast.isError ? ' is-error' : ''}`}>
        {toast.msg}
      </div>

    </section>
  );
}
