import { useEffect, useState } from 'react';
import {
  fetchAdminInventory,
  updateAdminInventoryItem,
  createAdminInventoryItem,
  deleteAdminInventoryItem,
  fetchAdminPackages,
  updateAdminPackage,
  deleteAdminPackage,
  createAdminPackage,
} from '../../api/api';

export default function AdminInventory() {
  // Tabs: 'sounds' | 'lights' | 'packages'
  const [activeTab, setActiveTab] = useState('sounds');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [packages, setPackages] = useState([]);

  // Package rates menu section: null | 'cosupplier' | 'equipment' | 'effects' | 'misc'
  const [currentPkgSection, setCurrentPkgSection] = useState(null);
  // Selected package for details/edit view
  const [selectedPackage, setSelectedPackage] = useState(null);

  // Toast notifications
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  // Add unit modal state
  const [addUnitModal, setAddUnitModal] = useState({
    show: false,
    subCategory: '',
    items: [],
    selectedItemId: '',
    isNewVariation: false,
    newVariationName: '',
    unitName: '',
    condition: 'Operational',
  });

  // Add category modal state
  const [addCategoryModal, setAddCategoryModal] = useState({
    show: false,
    categoryName: '',
    variationName: '',
    unitName: '',
  });

  // UI state for flipped cards (array of category ids)
  const [flippedCards, setFlippedCards] = useState([]);

  // Package edit mode inputs
  const [pkgEditInputs, setPkgEditInputs] = useState({
    name: '',
    subtitle: '',
    occasion: '',
    price: 0,
    promo: 0,
    note: '',
    groups: [],
  });

  // For adding package items
  const [showAddPkgItem, setShowAddPkgItem] = useState(false);
  const [newPkgItem, setNewPkgItem] = useState({ qty: '1 pc', name: '' });

  // Add addon package modal
  const [addAddonModal, setAddAddonModal] = useState({
    show: false,
    id: null,
    name: '',
    subtitle: '',
    price: 0,
    promo: 0,
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = () => {
    Promise.all([fetchAdminInventory(), fetchAdminPackages()])
      .then(([invData, pkgData]) => {
        setInventoryItems(invData.items || []);
        setPackages(pkgData.packages || []);
      })
      .catch((err) => {
        console.error('Failed to load data', err);
        showToast('Error loading inventory and packages', true);
      });
  };

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  // Helper parsers for inventory subcategory and variation name
  const getSubCategory = (name) => {
    const match = name.match(/^(.*?)\s*\(/);
    return match ? match[1].trim() : name;
  };

  const getItemDisplayName = (name) => {
    const match = name.match(/\((.*?)\)/);
    return match ? match[1].trim() : name;
  };

  // Safe parsing of notes JSON
  const parseNotes = (notesStr) => {
    try {
      return notesStr ? JSON.parse(notesStr) : [];
    } catch {
      return [];
    }
  };

  // Build summary aggregation for a category (items array)
  const buildSummary = (items) => {
    const map = {};
    items.forEach((item) => {
      const variation = getItemDisplayName(item.name);
      const units = parseNotes(item.notes);
      units.forEach((u) => {
        if (!map[variation]) map[variation] = { variation, inoperational: 0, operational: 0, inUse: 0, total: 0 };
        const row = map[variation];
        row.total++;
        if (u.condition === 'Inoperational' || u.condition === 'Inoperative') row.inoperational++;
        else row.operational++;
        if (u.inUse) row.inUse++;
      });
    });
    return Object.values(map).map((r) => ({ ...r, available: Math.max(0, r.operational - r.inUse) }));
  };

  // Toggle unit condition
  const handleToggleCondition = async (item, unitId, newCondition) => {
    const units = parseNotes(item.notes);
    const updatedUnits = units.map((u) => (u.id === unitId ? { ...u, condition: newCondition } : u));
    try {
      await updateAdminInventoryItem(item.id, { notes: JSON.stringify(updatedUnits) });
      setInventoryItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, notes: JSON.stringify(updatedUnits) } : i))
      );
      showToast('Unit condition updated');
    } catch (err) {
      showToast(err.message || 'Failed to update condition', true);
    }
  };

  // Remove unit
  const handleRemoveUnit = async (item, unitId) => {
    if (!window.confirm('Are you sure you want to remove this unit?')) return;
    const units = parseNotes(item.notes);
    const updatedUnits = units.filter((u) => u.id !== unitId);
    const newStock = updatedUnits.length;
    try {
      await updateAdminInventoryItem(item.id, { stock: newStock, notes: JSON.stringify(updatedUnits) });
      setInventoryItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, stock: newStock, notes: JSON.stringify(updatedUnits) } : i))
      );
      showToast('Unit removed successfully');
    } catch (err) {
      showToast(err.message || 'Failed to remove unit', true);
    }
  };

  // Remove entire category (all inventory items under a subcategory)
  const handleRemoveCategory = async (subCat) => {
    if (!window.confirm(`Remove category "${subCat}" and all its equipment?`)) return;
    try {
      const itemsToRemove = filteredInventory.filter((it) => getSubCategory(it.name) === subCat);
      await Promise.all(itemsToRemove.map((it) => deleteAdminInventoryItem(it.id)));
      loadAllData();
      showToast(`"${subCat}" category removed.`);
    } catch (err) {
      showToast(err.message || 'Failed to remove category', true);
    }
  };

  const toggleFlip = (catId) => {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return Array.from(next);
    });
  };

  // Open Add Unit Modal
  const openAddUnitModal = (subCategory, itemsInSubCategory) => {
    const totalUnits = itemsInSubCategory.reduce((acc, item) => acc + parseNotes(item.notes).length, 0);
    // Suggest a unit code based on category initials e.g. Main Speaker -> MS1
    const prefix = subCategory
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    const suggestedName = `${prefix}${totalUnits + 1}`;

    setAddUnitModal({
      show: true,
      subCategory,
      items: itemsInSubCategory,
      selectedItemId: itemsInSubCategory[0]?.id || '',
      isNewVariation: false,
      newVariationName: '',
      unitName: suggestedName,
      condition: 'Operational',
    });
  };

  // Save unit
  const handleSaveUnit = async () => {
    const { selectedItemId, isNewVariation, newVariationName, unitName, condition, subCategory } = addUnitModal;
    if (!unitName.trim()) {
      showToast('Unit name is required', true);
      return;
    }

    try {
      if (isNewVariation) {
        if (!newVariationName.trim()) {
          showToast('Variation name is required', true);
          return;
        }
        const fullName = `${subCategory} (${newVariationName.trim()})`;
        const newUnit = { id: `U-${Date.now()}`, name: unitName.trim(), condition, inUse: false };
        await createAdminInventoryItem({
          category: activeTab === 'sounds' ? 'Audio' : 'Lights',
          name: fullName,
          stock: 1,
          notes: JSON.stringify([newUnit]),
        });
      } else {
        const item = inventoryItems.find((i) => i.id === selectedItemId);
        if (!item) return;
        const units = parseNotes(item.notes);
        const newUnit = { id: `U-${Date.now()}`, name: unitName.trim(), condition, inUse: false };
        const updatedUnits = [...units, newUnit];
        await updateAdminInventoryItem(item.id, {
          stock: updatedUnits.length,
          notes: JSON.stringify(updatedUnits),
        });
      }
      loadAllData();
      setAddUnitModal((prev) => ({ ...prev, show: false }));
      showToast('Unit added successfully');
    } catch (err) {
      showToast(err.message || 'Failed to add unit', true);
    }
  };

  // Save Equipment Category
  const handleSaveCategory = async () => {
    const { categoryName, variationName, unitName } = addCategoryModal;
    if (!categoryName.trim() || !variationName.trim() || !unitName.trim()) {
      showToast('All fields are required', true);
      return;
    }

    try {
      const fullName = `${categoryName.trim()} (${variationName.trim()})`;
      const newUnit = { id: `U-${Date.now()}`, name: unitName.trim(), condition: 'Operational', inUse: false };
      await createAdminInventoryItem({
        category: activeTab === 'sounds' ? 'Audio' : 'Lights',
        name: fullName,
        stock: 1,
        notes: JSON.stringify([newUnit]),
      });
      loadAllData();
      setAddCategoryModal({ show: false, categoryName: '', variationName: '', unitName: '' });
      showToast('Category created successfully');
    } catch (err) {
      showToast(err.message || 'Failed to create category', true);
    }
  };

  // Setup package editing
  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg);
    setPkgEditInputs({
      name: pkg.name || '',
      subtitle: pkg.subtitle || '',
      occasion: pkg.occasion || '',
      price: pkg.price || 0,
      promo: pkg.promo || 0,
      note: pkg.note || '',
      groups: pkg.groups || [],
    });
    setShowAddPkgItem(false);
  };

  // Update a field in current package inputs
  const updatePkgField = (key, value) => {
    setPkgEditInputs((prev) => ({ ...prev, [key]: value }));
  };

  // Adjust package item qty needed
  const handleAdjustPkgItemQty = (groupIndex, itemIndex, delta) => {
    const groupsCopy = JSON.parse(JSON.stringify(pkgEditInputs.groups));
    const item = groupsCopy[groupIndex]?.items?.[itemIndex];
    if (!item) return;

    const currentVal = parseInt(item.qty) || 0;
    const nextVal = Math.max(1, currentVal + delta);
    const unitLabel = item.qty.includes('pcs') ? 'pcs' : item.qty.includes('pcs') ? 'pcs' : item.qty.replace(/[0-9\s]/g, '') || 'pc';
    item.qty = `${nextVal} ${unitLabel.trim()}`;

    updatePkgField('groups', groupsCopy);
  };

  // Delete package item
  const handleDeletePkgItem = (groupIndex, itemIndex) => {
    const groupsCopy = JSON.parse(JSON.stringify(pkgEditInputs.groups));
    groupsCopy[groupIndex].items = groupsCopy[groupIndex].items.filter((_, idx) => idx !== itemIndex);
    updatePkgField('groups', groupsCopy);
  };

  // Add item to package group
  const handleAddPkgItem = () => {
    if (!newPkgItem.name.trim()) {
      showToast('Item description is required', true);
      return;
    }
    const groupsCopy = JSON.parse(JSON.stringify(pkgEditInputs.groups));
    if (groupsCopy.length === 0) {
      groupsCopy.push({ category: 'SOUNDS', items: [] });
    }
    groupsCopy[0].items.push({ qty: newPkgItem.qty, name: newPkgItem.name.trim() });
    updatePkgField('groups', groupsCopy);
    setNewPkgItem({ qty: '1 pc', name: '' });
    setShowAddPkgItem(false);
  };

  // Save package rates modifications
  const handleSavePackageUpdates = async () => {
    if (!selectedPackage?.id) return;
    try {
      await updateAdminPackage(selectedPackage.id, pkgEditInputs);
      loadAllData();
      showToast('Package updated successfully');
      setSelectedPackage(null);
    } catch (err) {
      showToast(err.message || 'Failed to update package', true);
    }
  };

  // Add package (co-supplier primary package)
  const handleAddPackage = async () => {
    try {
      await createAdminPackage({
        section: 'cosupplier',
        name: 'NEW PACKAGE',
        subtitle: 'New Subtitle',
        occasion: 'General Occasion',
        note: 'Default description notes.',
        price: 5000,
        promo: 4500,
        color: 'blue',
        groups: [{ category: 'SOUNDS', items: [] }],
      });
      loadAllData();
      showToast('New package created. Click to edit it.');
    } catch (err) {
      showToast(err.message || 'Failed to add package', true);
    }
  };

  // Open add addon package modal
  const openAddAddon = (addon = null) => {
    if (addon) {
      setAddAddonModal({
        show: true,
        id: addon.id,
        name: addon.name,
        subtitle: addon.subtitle,
        price: addon.price,
        promo: addon.promo,
      });
    } else {
      setAddAddonModal({
        show: true,
        id: null,
        name: '',
        subtitle: '',
        price: 0,
        promo: 0,
      });
    }
  };

  // Save addon package (equipment, special effect, or misc)
  const handleSaveAddon = async () => {
    const { id, name, subtitle, price, promo } = addAddonModal;
    if (!name.trim()) {
      showToast('Name is required', true);
      return;
    }
    try {
      if (id) {
        await updateAdminPackage(id, { name, subtitle, price, promo });
        showToast('Addon updated successfully');
      } else {
        await createAdminPackage({
          section: currentPkgSection,
          name,
          subtitle,
          occasion: 'Addon',
          note: subtitle,
          price,
          promo,
          color: 'blue',
          groups: [],
        });
        showToast('Addon created successfully');
      }
      loadAllData();
      setAddAddonModal((prev) => ({ ...prev, show: false }));
    } catch (err) {
      showToast(err.message || 'Failed to save addon', true);
    }
  };

  // Delete addon package
  const handleDeleteAddon = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteAdminPackage(id);
      loadAllData();
      showToast('Item deleted successfully');
    } catch (err) {
      showToast(err.message || 'Failed to delete item', true);
    }
  };

  // Filter items by category tab (normalize casing and whitespace)
  const categoryFilter = activeTab === 'sounds' ? 'audio' : 'lights';
  const filteredInventory = inventoryItems.filter((item) => {
    const cat = (item.category || '').toString().trim().toLowerCase();
    return cat === categoryFilter;
  });

  // Group items by their subcategory (prefix before bracket)
  const groupedInventory = {};
  filteredInventory.forEach((item) => {
    const subCat = getSubCategory(item.name);
    if (!groupedInventory[subCat]) {
      groupedInventory[subCat] = [];
    }
    groupedInventory[subCat].push(item);
  });

  return (
    <section className="main-content">
      {/* ── Equipment Type Tabs ── */}
      <div className="equip-tabs">
        <button
          className={`equip-tab ${activeTab === 'sounds' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('sounds');
            setCurrentPkgSection(null);
            setSelectedPackage(null);
          }}
        >
          Sounds Equipment
        </button>
        <button
          className={`equip-tab ${activeTab === 'lights' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('lights');
            setCurrentPkgSection(null);
            setSelectedPackage(null);
          }}
        >
          Lights Equipment
        </button>
        <button
          className={`equip-tab ${activeTab === 'packages' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('packages');
            setCurrentPkgSection(null);
            setSelectedPackage(null);
          }}
        >
          Package Rate
        </button>
      </div>

      {activeTab !== 'packages' ? (
        <>
          {/* ── Toolbar ── */}
          <div className="inventory-toolbar">
            <button
              className="add-category-btn"
              onClick={() => setAddCategoryModal((prev) => ({ ...prev, show: true }))}
            >
              Add Equipment Category
            </button>
          </div>

          {/* ── Category List ── */}
          <div className="category-list">
            {Object.keys(groupedInventory).length === 0 ? (
              <div className="summary-empty" style={{ padding: '80px 0' }}>
                No categories yet. Add one using the button above.
              </div>
            ) : (
              Object.keys(groupedInventory).map((subCat) => {
                const itemsInSubCat = groupedInventory[subCat];
                const summary = buildSummary(itemsInSubCat);
                const isFlipped = flippedCards.includes(subCat);
                return (
                  <div key={subCat} className={`category-card ${isFlipped ? 'flipped' : ''}`} data-cat-id={subCat}>
                    <div className="category-card-inner">
                      <div className="card-face front">
                        <div className="card-header-row">
                          <span className="category-title">{subCat}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="flip-hint" onClick={() => toggleFlip(subCat)} style={{ cursor: 'pointer' }}>
                              View Details
                            </span>
                            <button className="category-remove-btn" onClick={() => handleRemoveCategory(subCat)} title="Remove category">&times;</button>
                          </div>
                        </div>
                        <div className="summary-table-wrap">
                          <div className="summary-table-title">Inventory Summary</div>
                          {summary.length === 0 ? (
                            <p className="summary-empty">No equipment yet. Flip the card to add some.</p>
                          ) : (
                            <table className="summary-table">
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

                      <div className="card-face back">
                        <div className="card-header-row">
                          <span className="category-title">{subCat}</span>
                          <span className="flip-hint" onClick={() => toggleFlip(subCat)} style={{ cursor: 'pointer' }}>Back to Summary</span>
                        </div>
                        <table className="detail-table">
                          <thead>
                            <tr>
                              <th>VARIATION</th>
                              <th>NAME</th>
                              <th className="col-condition">CONDITION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemsInSubCat.flatMap((item) => {
                              const units = parseNotes(item.notes);
                              return units.map((u) => (
                                <tr key={u.id} data-unit-id={u.id}>
                                  <td>
                                    <div className="variation-cell">
                                      <span>{getItemDisplayName(item.name)}</span>
                                      <button className="unit-remove-x" onClick={() => handleRemoveUnit(item, u.id)} title="Remove unit">&times;</button>
                                    </div>
                                  </td>
                                  <td className="unit-id-cell">
                                    {u.name} {u.inUse && <span className="in-use-badge">● In Use</span>}
                                  </td>
                                  <td>
                                    <div className="condition-toggle">
                                      <button className={`condition-btn op ${u.condition === 'Operational' ? 'selected' : ''}`} onClick={() => handleToggleCondition(item, u.id, 'Operational')}>Operational</button>
                                      <button className={`condition-btn inop ${u.condition !== 'Operational' ? 'selected' : ''}`} onClick={() => handleToggleCondition(item, u.id, 'Inoperational')}>Inoperational</button>
                                    </div>
                                  </td>
                                </tr>
                              ));
                            })}
                            <tr>
                              <td colSpan="3">
                                <button className="add-unit-row" onClick={() => openAddUnitModal(subCat, itemsInSubCat)}>
                                  <em>Add Equipment</em> <span className="plus">+</span>
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
            </>
          ) : (
            <div className="summary-empty" style={{ padding: '80px 0' }}>
              Package Rate view is not available here.
            </div>
          )}
      {/* ══════════════════════════════
         MODALS
      ══════════════════════════════ */}

      {/* ── Add Unit Modal ── */}
      <div className={`modal-overlay ${addUnitModal.show ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">Add Equipment Unit</span>
            <button
              className="modal-close"
              onClick={() => setAddUnitModal((prev) => ({ ...prev, show: false }))}
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">Category Name</span>
              <input className="m-input" type="text" value={addUnitModal.subCategory} disabled />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">Variation Selection</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="condition-radio">
                  <input
                    type="radio"
                    checked={!addUnitModal.isNewVariation}
                    onChange={() => setAddUnitModal((prev) => ({ ...prev, isNewVariation: false }))}
                  />
                  Choose Existing
                </label>
                {!addUnitModal.isNewVariation && (
                  <select
                    className="m-input"
                    value={addUnitModal.selectedItemId}
                    onChange={(e) => setAddUnitModal((prev) => ({ ...prev, selectedItemId: e.target.value }))}
                  >
                    {addUnitModal.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {getItemDisplayName(item.name)}
                      </option>
                    ))}
                  </select>
                )}

                <label className="condition-radio">
                  <input
                    type="radio"
                    checked={addUnitModal.isNewVariation}
                    onChange={() => setAddUnitModal((prev) => ({ ...prev, isNewVariation: true }))}
                  />
                  Create New Variation
                </label>
                {addUnitModal.isNewVariation && (
                  <input
                    type="text"
                    className="m-input"
                    placeholder="E.g. Kevler VRX-932A Line Array Speaker"
                    value={addUnitModal.newVariationName}
                    onChange={(e) =>
                      setAddUnitModal((prev) => ({ ...prev, newVariationName: e.target.value }))
                    }
                  />
                )}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">Unit Code/Name</span>
              <input
                className="m-input"
                type="text"
                placeholder="E.g. MS7"
                value={addUnitModal.unitName}
                onChange={(e) => setAddUnitModal((prev) => ({ ...prev, unitName: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">Initial Condition</span>
              <div className="condition-radio-group">
                <label className="condition-radio">
                  <input
                    type="radio"
                    name="modal-cond"
                    checked={addUnitModal.condition === 'Operational'}
                    onChange={() => setAddUnitModal((prev) => ({ ...prev, condition: 'Operational' }))}
                  />
                  Operational
                </label>
                <label className="condition-radio">
                  <input
                    type="radio"
                    name="modal-cond"
                      checked={addUnitModal.condition !== 'Operational'}
                      onChange={() => setAddUnitModal((prev) => ({ ...prev, condition: 'Inoperational' }))}
                  />
                  Inoperative
                </label>
              </div>
            </div>

            <div className="m-actions">
              <button
                className="m-btn-cancel"
                onClick={() => setAddUnitModal((prev) => ({ ...prev, show: false }))}
              >
                Cancel
              </button>
              <button className="m-btn-save" onClick={handleSaveUnit}>
                Save Unit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Category Modal ── */}
      <div className={`modal-overlay ${addCategoryModal.show ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">Add Equipment Category</span>
            <button
              className="modal-close"
              onClick={() => setAddCategoryModal({ show: false, categoryName: '', variationName: '', unitName: '' })}
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">Category Name</span>
              <input
                className="m-input"
                type="text"
                placeholder="E.g. Main Speaker"
                value={addCategoryModal.categoryName}
                onChange={(e) => setAddCategoryModal((prev) => ({ ...prev, categoryName: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">First Variation Name</span>
              <input
                className="m-input"
                type="text"
                placeholder="E.g. Kevler VRX-932A Line Array Speaker"
                value={addCategoryModal.variationName}
                onChange={(e) => setAddCategoryModal((prev) => ({ ...prev, variationName: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">First Unit ID/Code</span>
              <input
                className="m-input"
                type="text"
                placeholder="E.g. MS1"
                value={addCategoryModal.unitName}
                onChange={(e) => setAddCategoryModal((prev) => ({ ...prev, unitName: e.target.value }))}
              />
            </div>

            <div className="m-actions">
              <button
                className="m-btn-cancel"
                onClick={() =>
                  setAddCategoryModal({ show: false, categoryName: '', variationName: '', unitName: '' })
                }
              >
                Cancel
              </button>
              <button className="m-btn-save" onClick={handleSaveCategory}>
                Create Category
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Add/Edit Addon Modal ── */}
      <div className={`modal-overlay ${addAddonModal.show ? 'active' : ''}`}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">{addAddonModal.id ? 'Edit Addon Item' : 'Add Addon Item'}</span>
            <button
              className="modal-close"
              onClick={() => setAddAddonModal((prev) => ({ ...prev, show: false }))}
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">Name</span>
              <input
                className="m-input"
                type="text"
                placeholder="E.g. Projector + Wide Screen"
                value={addAddonModal.name}
                onChange={(e) => setAddAddonModal((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">Description / Subtitle</span>
              <input
                className="m-input"
                type="text"
                placeholder="E.g. w/ HDMI Cable"
                value={addAddonModal.subtitle}
                onChange={(e) => setAddAddonModal((prev) => ({ ...prev, subtitle: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">Price (Php)</span>
              <input
                className="m-input"
                type="number"
                value={addAddonModal.price === 0 ? '' : addAddonModal.price}
                onChange={(e) => setAddAddonModal((prev) => ({ ...prev, price: Number(e.target.value) }))}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <span className="m-label">Promo Price (Optional)</span>
              <input
                className="m-input"
                type="number"
                value={addAddonModal.promo === 0 ? '' : addAddonModal.promo}
                onChange={(e) => setAddAddonModal((prev) => ({ ...prev, promo: Number(e.target.value) }))}
              />
            </div>

            <div className="m-actions">
              <button
                className="m-btn-cancel"
                onClick={() => setAddAddonModal((prev) => ({ ...prev, show: false }))}
              >
                Cancel
              </button>
              <button className="m-btn-save" onClick={handleSaveAddon}>
                Save Item
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast Element ── */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'is-error' : ''}`}>
        {toast.message}
      </div>
    </section>
  );
}
