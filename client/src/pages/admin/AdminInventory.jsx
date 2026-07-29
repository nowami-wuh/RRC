import { useEffect, useState, useRef } from 'react';
import {
  fetchAdminInventory,
  updateAdminInventoryItem,
  createAdminInventoryItem,
  deleteAdminInventoryItem,
} from '../../api/api';

// ── Flip icon SVG ──────────────────────────────────────────────
const FlipIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z" />
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────
const getSubCategory = (name) => {
  const match = name.match(/^(.*?)\s*\(/);
  return match ? match[1].trim() : name;
};

const getVariationName = (name) => {
  const match = name.match(/\((.*?)\)/);
  return match ? match[1].trim() : name;
};

const parseUnits = (notesStr) => {
  try {
    return notesStr ? JSON.parse(notesStr) : [];
  } catch {
    return [];
  }
};

const buildSummary = (items) => {
  const map = {};
  items.forEach((item) => {
    const variation = getVariationName(item.name);
    const units = parseUnits(item.notes);
    units.forEach((u) => {
      if (!map[variation]) {
        map[variation] = { variation, inoperational: 0, operational: 0, inUse: 0, total: 0 };
      }
      const row = map[variation];
      row.total++;
      if (u.condition === 'Inoperational' || u.condition === 'Inoperative') row.inoperational++;
      else row.operational++;
      if (u.inUse) row.inUse++;
    });
  });
  return Object.values(map).map((r) => ({ ...r, available: Math.max(0, r.operational - r.inUse) }));
};

// ── Toast ──────────────────────────────────────────────────────
function Toast({ toast }) {
  return (
    <div className={`inv-toast${toast.show ? ' show' : ''}${toast.isError ? ' is-error' : ''}`}>
      {toast.message}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function AdminInventory() {
  const [activeTab, setActiveTab] = useState('sounds');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [flippedCards, setFlippedCards] = useState(new Set());
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  // ── Add Category Modal ──
  const [addCatModal, setAddCatModal] = useState({ show: false, name: '', error: '' });
  const addCatInputRef = useRef(null);

  // ── Add Equipment (Unit) Modal ──
  const [addUnitModal, setAddUnitModal] = useState({
    show: false,
    subCategory: '',
    items: [],           // existing items in this subCategory
    variation: '',       // typed variation / model name
    unitId: '',          // typed unit ID
    condition: 'Operational',
    error: '',
  });
  const addUnitVarRef = useRef(null);

  // ── Remove Unit Modal ──
  const [removeUnitModal, setRemoveUnitModal] = useState({
    show: false,
    item: null,
    unitId: '',
    unitLabel: '',
  });

  // ── Load ──
  useEffect(() => { loadInventory(); }, []);

  const loadInventory = () => {
    fetchAdminInventory()
      .then((data) => setInventoryItems(data.items || []))
      .catch((err) => showToast(err.message || 'Failed to load inventory', true));
  };

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  // ── Derived data ──
  const normalizeCategory = (cat = '') =>
    cat.toString().trim().toLowerCase().split(/[–-]/)[0].trim();

  const categoryFilter = activeTab === 'sounds' ? 'audio' : 'lights';

  const filteredItems = inventoryItems.filter(
    (item) => normalizeCategory(item.category) === categoryFilter
  );

  const groupedInventory = {};
  filteredItems.forEach((item) => {
    const sub = getSubCategory(item.name);
    if (!groupedInventory[sub]) groupedInventory[sub] = [];
    groupedInventory[sub].push(item);
  });

  // ── Tab switch ──
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setFlippedCards(new Set());
  };

  // ── Flip ──
  const toggleFlip = (subCat) => {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      if (next.has(subCat)) next.delete(subCat);
      else next.add(subCat);
      return next;
    });
  };

  // ── Condition toggle ──
  const handleToggleCondition = async (item, unitId, newCondition) => {
    const units = parseUnits(item.notes);
    const updated = units.map((u) => (u.id === unitId ? { ...u, condition: newCondition } : u));
    try {
      await updateAdminInventoryItem(item.id, { notes: JSON.stringify(updated) });
      setInventoryItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, notes: JSON.stringify(updated) } : i))
      );
      showToast('Condition updated');
    } catch (err) {
      showToast(err.message || 'Failed to update condition', true);
    }
  };

  // ── Remove category ──
  const handleRemoveCategory = async (subCat) => {
    if (!window.confirm(`Remove category "${subCat}" and all its equipment?`)) return;
    try {
      const toRemove = filteredItems.filter((it) => getSubCategory(it.name) === subCat);
      await Promise.all(toRemove.map((it) => deleteAdminInventoryItem(it.id)));
      setFlippedCards((prev) => { const n = new Set(prev); n.delete(subCat); return n; });
      loadInventory();
      showToast(`"${subCat}" category removed.`);
    } catch (err) {
      showToast(err.message || 'Failed to remove category', true);
    }
  };

  // ════════════════════════════════════════════
  // ADD CATEGORY MODAL handlers
  // ════════════════════════════════════════════
  const openAddCatModal = () => {
    setAddCatModal({ show: true, name: '', error: '' });
    setTimeout(() => addCatInputRef.current?.focus(), 60);
  };
  const closeAddCatModal = () => setAddCatModal({ show: false, name: '', error: '' });

  const handleAddCategory = async () => {
    const name = addCatModal.name.trim();
    if (!name) {
      setAddCatModal((p) => ({ ...p, error: 'Category name is required.' }));
      return;
    }
    const exists = Object.keys(groupedInventory).some(
      (k) => k.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setAddCatModal((p) => ({ ...p, error: 'A category with this name already exists.' }));
      return;
    }
    // We can't create a bare category without at least one variation/unit — open it flipped
    // so the user can add units immediately. Store a pending "empty" category in state.
    // Actually for the backend we just track by name prefix; we'll open the flip side.
    // Signal it by flipping the card after creation (show in flipped state).
    // We don't create a DB record until the first unit is added.
    const newKey = name;
    setFlippedCards((prev) => new Set([...prev, newKey]));
    closeAddCatModal();
    showToast(`"${name}" category added.`);
    // Optimistically inject a placeholder so the card renders
    setInventoryItems((prev) => [
      ...prev,
      {
        id: `_pending_${Date.now()}`,
        category: activeTab === 'sounds' ? 'Audio' : 'Lights',
        name: `${name} (__placeholder__)`,
        stock: 0,
        notes: JSON.stringify([]),
      },
    ]);
  };

  // ════════════════════════════════════════════
  // ADD UNIT MODAL handlers
  // ════════════════════════════════════════════
  const openAddUnitModal = (subCat, items) => {
    const allUnits = items.flatMap((i) => parseUnits(i.notes));
    const prefix = subCat.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'EQ';
    let n = allUnits.length + 1;
    let suggested = `${prefix}${n}`;
    while (allUnits.some((u) => u.id === suggested || u.name === suggested)) {
      n++;
      suggested = `${prefix}${n}`;
    }
    setAddUnitModal({
      show: true,
      subCategory: subCat,
      items,
      variation: '',
      unitId: suggested,
      condition: 'Operational',
      error: '',
    });
    setTimeout(() => addUnitVarRef.current?.focus(), 60);
  };

  const closeAddUnitModal = () =>
    setAddUnitModal((p) => ({ ...p, show: false, error: '' }));

  const handleSaveUnit = async () => {
    const { subCategory, items, variation, unitId, condition } = addUnitModal;
    const varName = variation.trim();
    const uid = unitId.trim();

    if (!varName) {
      setAddUnitModal((p) => ({ ...p, error: 'Variation / model name is required.' }));
      return;
    }

    // Find or create item with this variation name
    const fullName = `${subCategory} (${varName})`;

    // Check unit ID uniqueness across all units in category
    const allUnits = items.flatMap((i) => parseUnits(i.notes));
    if (uid && allUnits.some((u) => (u.id || u.name)?.toLowerCase() === uid.toLowerCase())) {
      setAddUnitModal((p) => ({ ...p, error: `Unit ID "${uid}" already exists in this category.` }));
      return;
    }

    const newUnit = { id: uid, name: uid, condition, inUse: false };

    try {
      // Check if a backend item with this exact variation already exists
      const existingItem = items.find(
        (i) => i.name.toLowerCase() === fullName.toLowerCase()
      );
      // Also check placeholder
      const placeholder = items.find((i) => i.id?.startsWith('_pending_'));

      if (existingItem) {
        const units = parseUnits(existingItem.notes);
        const updatedUnits = [...units, newUnit];
        await updateAdminInventoryItem(existingItem.id, {
          stock: updatedUnits.length,
          notes: JSON.stringify(updatedUnits),
        });
      } else if (placeholder) {
        // Replace placeholder with real item
        await createAdminInventoryItem({
          category: activeTab === 'sounds' ? 'Audio' : 'Lights',
          name: fullName,
          stock: 1,
          notes: JSON.stringify([newUnit]),
        });
        // Remove placeholder from local state
        setInventoryItems((prev) => prev.filter((i) => !i.id?.startsWith('_pending_')));
      } else {
        await createAdminInventoryItem({
          category: activeTab === 'sounds' ? 'Audio' : 'Lights',
          name: fullName,
          stock: 1,
          notes: JSON.stringify([newUnit]),
        });
      }

      loadInventory();
      closeAddUnitModal();
      showToast(`Unit ${uid} added to "${subCategory}".`);
    } catch (err) {
      setAddUnitModal((p) => ({ ...p, error: err.message || 'Failed to add unit.' }));
    }
  };

  // ════════════════════════════════════════════
  // REMOVE UNIT MODAL handlers
  // ════════════════════════════════════════════
  const openRemoveUnitModal = (item, unitId, unitLabel) => {
    setRemoveUnitModal({ show: true, item, unitId, unitLabel });
  };
  const closeRemoveUnitModal = () =>
    setRemoveUnitModal({ show: false, item: null, unitId: '', unitLabel: '' });

  const handleConfirmRemoveUnit = async () => {
    const { item, unitId } = removeUnitModal;
    if (!item || !unitId) return;
    try {
      const units = parseUnits(item.notes);
      const updatedUnits = units.filter((u) => u.id !== unitId);
      await updateAdminInventoryItem(item.id, {
        stock: updatedUnits.length,
        notes: JSON.stringify(updatedUnits),
      });
      setInventoryItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, stock: updatedUnits.length, notes: JSON.stringify(updatedUnits) } : i
        )
      );
      showToast(`Unit ${unitId} removed.`);
      closeRemoveUnitModal();
    } catch (err) {
      showToast(err.message || 'Failed to remove unit', true);
      closeRemoveUnitModal();
    }
  };

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════
  return (
    <section className="inventory-page">

      {/* ── Equipment Type Tabs ── */}
      <div className="equip-tabs">
        <button
          className={`equip-tab${activeTab === 'sounds' ? ' active' : ''}`}
          onClick={() => handleTabSwitch('sounds')}
        >
          Sounds Equipment
        </button>
        <button
          className={`equip-tab${activeTab === 'lights' ? ' active' : ''}`}
          onClick={() => handleTabSwitch('lights')}
        >
          Lights Equipment
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="inventory-toolbar">
        <button className="add-category-btn" onClick={openAddCatModal}>
          Add Equipment Category
        </button>
      </div>

      {/* ── Category Cards ── */}
      <div className="inv-category-list">
        {Object.keys(groupedInventory).length === 0 ? (
          <p className="inv-summary-empty" style={{ padding: '80px 0', textAlign: 'center' }}>
            No categories yet. Add one using the button above.
          </p>
        ) : (
          Object.keys(groupedInventory).map((subCat) => {
            const items = groupedInventory[subCat];
            // Filter out placeholder items for display purposes
            const realItems = items.filter((i) => !i.id?.startsWith('_pending_'));
            const summary = buildSummary(realItems);
            const isFlipped = flippedCards.has(subCat);

            return (
              <div
                key={subCat}
                className={`inv-category-card${isFlipped ? ' flipped' : ''}`}
              >
                <div className="inv-card-inner">

                  {/* ──── FRONT FACE ──── */}
                  <div className="inv-card-face front">
                    <div className="inv-card-header">
                      <span className="inv-category-title">{subCat}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          className="inv-flip-hint"
                          onClick={() => toggleFlip(subCat)}
                        >
                          <FlipIcon />
                          View Details
                        </button>
                        <button
                          className="inv-cat-remove-btn"
                          onClick={() => handleRemoveCategory(subCat)}
                          title="Remove category"
                        >
                          &times;
                        </button>
                      </div>
                    </div>

                    <div className="inv-summary-wrap">
                      <div className="inv-summary-title">Inventory Summary</div>
                      {summary.length === 0 ? (
                        <p className="inv-summary-empty">
                          No equipment yet. Flip the card to add some.
                        </p>
                      ) : (
                        <table className="inv-summary-table">
                          <thead>
                            <tr>
                              <th>VARIATION</th>
                              <th>INOPERATIONAL</th>
                              <th>OPERATIONAL</th>
                              <th>IN USE</th>
                              <th>AVAILABLE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.map((row) => (
                              <tr key={row.variation}>
                                <td>{row.variation}</td>
                                <td>{row.inoperational}</td>
                                <td>{row.operational}</td>
                                <td>{row.inUse || '-'}</td>
                                <td>{row.available}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  {/* ──── BACK FACE ──── */}
                  <div className="inv-card-face back">
                    <div className="inv-card-header">
                      <span className="inv-category-title">{subCat}</span>
                      <button
                        className="inv-flip-hint"
                        onClick={() => toggleFlip(subCat)}
                      >
                        <FlipIcon />
                        Back to Summary
                      </button>
                    </div>

                    <table className="inv-detail-table">
                      <thead>
                        <tr>
                          <th>VARIATION</th>
                          <th>NAME</th>
                          <th className="col-condition">CONDITION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {realItems.flatMap((item) => {
                          const units = parseUnits(item.notes);
                          return units.map((u) => (
                            <tr key={u.id}>
                              <td>
                                <div className="inv-variation-cell">
                                  <span>{getVariationName(item.name)}</span>
                                  <button
                                    className="inv-unit-remove-x"
                                    onClick={() => openRemoveUnitModal(item, u.id, u.name || u.id)}
                                    title="Remove unit"
                                  >
                                    &times;
                                  </button>
                                </div>
                              </td>
                              <td className="inv-unit-id-cell">
                                {u.name || u.id}
                                {u.inUse && (
                                  <span className="inv-in-use-badge">● In Use</span>
                                )}
                              </td>
                              <td>
                                <div className="inv-condition-toggle">
                                  <button
                                    className={`inv-condition-btn op${u.condition === 'Operational' ? ' selected' : ''}`}
                                    onClick={() => handleToggleCondition(item, u.id, 'Operational')}
                                  >
                                    Operational
                                  </button>
                                  <button
                                    className={`inv-condition-btn inop${u.condition !== 'Operational' ? ' selected' : ''}`}
                                    onClick={() => handleToggleCondition(item, u.id, 'Inoperational')}
                                  >
                                    Inoperational
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ));
                        })}
                        <tr>
                          <td colSpan="3">
                            <button
                              className="inv-add-unit-row"
                              onClick={() => openAddUnitModal(subCat, items)}
                            >
                              <em>Add Equipment</em>
                              <span className="inv-plus">+</span>
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ════════════════════════════════════════════
          ADD CATEGORY MODAL
      ════════════════════════════════════════════ */}
      <div className={`inv-modal-overlay${addCatModal.show ? ' active' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeAddCatModal(); }}>
        <div className="inv-modal">
          <div className="inv-modal-header">
            <h2 className="inv-modal-title">Add Equipment Category</h2>
            <button className="inv-modal-close" onClick={closeAddCatModal}>&times;</button>
          </div>
          <div className="inv-modal-body">
            <label className="inv-m-label">Category Name</label>
            <input
              ref={addCatInputRef}
              type="text"
              className={`inv-m-input${addCatModal.error ? ' error' : ''}`}
              placeholder="e.g. Main Speaker"
              value={addCatModal.name}
              onChange={(e) => setAddCatModal((p) => ({ ...p, name: e.target.value, error: '' }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
            />
            <p className="inv-m-error">{addCatModal.error}</p>
            <div className="inv-m-actions">
              <button className="inv-m-btn-cancel" onClick={closeAddCatModal}>Cancel</button>
              <button className="inv-m-btn-save" onClick={handleAddCategory}>Add Category</button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          ADD EQUIPMENT UNIT MODAL
      ════════════════════════════════════════════ */}
      <div className={`inv-modal-overlay${addUnitModal.show ? ' active' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeAddUnitModal(); }}>
        <div className="inv-modal">
          <div className="inv-modal-header">
            <h2 className="inv-modal-title">Add Equipment</h2>
            <button className="inv-modal-close" onClick={closeAddUnitModal}>&times;</button>
          </div>
          <div className="inv-modal-body">
            <label className="inv-m-label">Variation / Model</label>
            <input
              ref={addUnitVarRef}
              type="text"
              className={`inv-m-input${addUnitModal.error && !addUnitModal.variation.trim() ? ' error' : ''}`}
              placeholder="e.g. Kevler VRX-932A Line Array Speaker"
              value={addUnitModal.variation}
              onChange={(e) => setAddUnitModal((p) => ({ ...p, variation: e.target.value, error: '' }))}
            />

            <label className="inv-m-label" style={{ marginTop: '14px' }}>Unit ID</label>
            <input
              type="text"
              className="inv-m-input"
              placeholder="e.g. MS7 (auto-suggested if left blank)"
              value={addUnitModal.unitId}
              onChange={(e) => setAddUnitModal((p) => ({ ...p, unitId: e.target.value, error: '' }))}
            />

            <label className="inv-m-label" style={{ marginTop: '14px' }}>Initial Condition</label>
            <div className="inv-condition-radio-group">
              <label className="inv-condition-radio">
                <input
                  type="radio"
                  name="newUnitCondition"
                  value="Operational"
                  checked={addUnitModal.condition === 'Operational'}
                  onChange={() => setAddUnitModal((p) => ({ ...p, condition: 'Operational' }))}
                />
                Operational
              </label>
              <label className="inv-condition-radio">
                <input
                  type="radio"
                  name="newUnitCondition"
                  value="Inoperational"
                  checked={addUnitModal.condition === 'Inoperational'}
                  onChange={() => setAddUnitModal((p) => ({ ...p, condition: 'Inoperational' }))}
                />
                Inoperational
              </label>
            </div>

            <p className="inv-m-error">{addUnitModal.error}</p>
            <div className="inv-m-actions">
              <button className="inv-m-btn-cancel" onClick={closeAddUnitModal}>Cancel</button>
              <button className="inv-m-btn-save" onClick={handleSaveUnit}>Add</button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          REMOVE UNIT CONFIRM MODAL
      ════════════════════════════════════════════ */}
      <div className={`inv-modal-overlay${removeUnitModal.show ? ' active' : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeRemoveUnitModal(); }}>
        <div className="inv-modal">
          <div className="inv-modal-header">
            <h2 className="inv-modal-title">Remove Equipment</h2>
            <button className="inv-modal-close" onClick={closeRemoveUnitModal}>&times;</button>
          </div>
          <div className="inv-modal-body">
            <p className="inv-confirm-text">
              Remove unit <strong>{removeUnitModal.unitLabel}</strong> from inventory? This cannot be undone.
            </p>
            <div className="inv-m-actions">
              <button className="inv-m-btn-cancel" onClick={closeRemoveUnitModal}>Cancel</button>
              <button className="inv-m-btn-reject" onClick={handleConfirmRemoveUnit}>Remove</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ── */}
      <Toast toast={toast} />
    </section>
  );
}
