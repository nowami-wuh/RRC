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

  // Filter items by category tab
  const categoryFilter = activeTab === 'sounds' ? 'Audio' : 'Lights';
  const filteredInventory = inventoryItems.filter((item) => item.category === categoryFilter);

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
            {Object.keys(groupedInventory).map((subCat) => {
              const itemsInSubCat = groupedInventory[subCat];
              return (
                <div key={subCat} className="category-card">
                  <div className="card-face">
                    <div className="card-header-row">
                      <span className="category-title">{subCat}</span>
                    </div>

                    <div className="detail-table-wrap">
                      <table className="detail-table">
                        <thead>
                          <tr>
                            <th className="col-var-name">Variation</th>
                            <th className="col-unit-id">Name</th>
                            <th className="col-condition">Condition</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsInSubCat.flatMap((item) => {
                            const units = parseNotes(item.notes);
                            return units.map((unit) => (
                              <tr key={unit.id}>
                                <td>
                                  <div className="variation-cell">
                                    <span>{getItemDisplayName(item.name)}</span>
                                    <button
                                      className="unit-remove-x"
                                      onClick={() => handleRemoveUnit(item, unit.id)}
                                    >
                                      ×
                                    </button>
                                  </div>
                                </td>
                                <td className="unit-id-cell col-unit-id">
                                  {unit.name}
                                  {unit.inUse && <span className="in-use-badge">In-Use</span>}
                                </td>
                                <td className="col-condition">
                                  <div className="condition-toggle">
                                    <button
                                      className={`condition-btn op ${unit.condition === 'Operational' ? 'selected' : ''}`}
                                      onClick={() => handleToggleCondition(item, unit.id, 'Operational')}
                                    >
                                      Operational
                                    </button>
                                    <button
                                      className={`condition-btn inop ${unit.condition !== 'Operational' ? 'selected' : ''}`}
                                      onClick={() => handleToggleCondition(item, unit.id, 'Inoperative')}
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
                                className="add-unit-row"
                                onClick={() => openAddUnitModal(subCat, itemsInSubCat)}
                              >
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
            })}
          </div>
        </>
      ) : (
        /* ── Package Rate Dashboard ── */
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {currentPkgSection === null ? (
            <div className="pkg-rate-menu">
              <button className="pkg-rate-menu-btn" onClick={() => setCurrentPkgSection('cosupplier')}>
                Packages
              </button>
              <button className="pkg-rate-menu-btn" onClick={() => setCurrentPkgSection('equipment')}>
                Equipment Add-ons
              </button>
              <button className="pkg-rate-menu-btn" onClick={() => setCurrentPkgSection('effects')}>
                Special Effects Add-ons
              </button>
              <button className="pkg-rate-menu-btn" onClick={() => setCurrentPkgSection('misc')}>
                Miscellaneous
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px 30px 0' }}>
                <button
                  className="back-btn"
                  onClick={() => {
                    setCurrentPkgSection(null);
                    setSelectedPackage(null);
                  }}
                >
                  ← Back
                </button>
              </div>

              {/* ── PACKAGES (CO-SUPPLIER) SECTION ── */}
              {currentPkgSection === 'cosupplier' && (
                <div>
                  {/* Selection tabs */}
                  <div style={{ display: 'flex', gap: '8px', padding: '10px 30px', flexWrap: 'wrap' }}>
                    {packages
                      .filter((p) => p.section === 'cosupplier')
                      .map((p) => (
                        <button
                          key={p.id}
                          className={`add-category-btn`}
                          style={{
                            background: selectedPackage?.id === p.id ? 'var(--dark-blue)' : '#111',
                          }}
                          onClick={() => handleSelectPackage(p)}
                        >
                          {p.name}
                        </button>
                      ))}
                  </div>

                  {selectedPackage ? (
                    <div className="pkg-edit-card">
                      <div className="pkg-edit-header">
                        <div className="pkg-edit-title-group">
                          <input
                            type="text"
                            className="m-input pkg-edit-title"
                            style={{ border: 'none', background: 'transparent', padding: '4px 0' }}
                            value={pkgEditInputs.name}
                            onChange={(e) => updatePkgField('name', e.target.value)}
                          />
                          <input
                            type="text"
                            className="m-input"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              fontSize: '14px',
                              fontStyle: 'italic',
                              padding: '2px 0',
                            }}
                            value={pkgEditInputs.subtitle}
                            onChange={(e) => updatePkgField('subtitle', e.target.value)}
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px' }}>Php</span>
                            <input
                              type="number"
                              className="m-input pkg-edit-price"
                              style={{ width: '120px', padding: '6px' }}
                              value={pkgEditInputs.price === 0 ? '' : pkgEditInputs.price}
                              onChange={(e) => updatePkgField('price', Number(e.target.value))}
                            />
                          </div>
                          <div
                            className="pkg-edit-promo"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}
                          >
                            <span>(promo Php</span>
                            <input
                              type="number"
                              className="m-input"
                              style={{ width: '80px', padding: '4px', fontSize: '12px' }}
                              value={pkgEditInputs.promo === 0 ? '' : pkgEditInputs.promo}
                              onChange={(e) => updatePkgField('promo', Number(e.target.value))}
                            />
                            <span>)</span>
                          </div>
                        </div>
                      </div>

                      <div className="pkg-tbl-wrap">
                        <div className="pkg-tbl-side">SOUNDS</div>
                        <div className="pkg-tbl-body">
                          <table className="pkg-tbl">
                            <thead>
                              <tr>
                                <th style={{ width: '40px' }}></th>
                                <th>Equipment Type</th>
                                <th style={{ textAlign: 'center', width: '180px' }}>Qty. Needed / Available</th>
                                <th style={{ textAlign: 'center', width: '80px' }}>Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pkgEditInputs.groups?.[0]?.items?.map((item, idx) => {
                                // Find stock available in inventory items matching the description
                                const matchedInv = inventoryItems.find((inv) =>
                                  inv.name.toLowerCase().includes(item.name.toLowerCase())
                                );
                                const stockAvailable = matchedInv ? matchedInv.stock : 0;
                                const neededVal = parseInt(item.qty) || 0;
                                const isAvailable = stockAvailable >= neededVal;

                                return (
                                  <tr key={idx}>
                                    <td style={{ textAlign: 'center' }}>
                                      <button
                                        className="pkg-remove-item"
                                        onClick={() => handleDeletePkgItem(0, idx)}
                                      >
                                        ×
                                      </button>
                                    </td>
                                    <td>
                                      <input
                                        type="text"
                                        className="m-input"
                                        style={{ border: 'none', background: 'transparent', padding: '4px 0' }}
                                        value={item.name}
                                        onChange={(e) => {
                                          const groupsCopy = JSON.parse(JSON.stringify(pkgEditInputs.groups));
                                          groupsCopy[0].items[idx].name = e.target.value;
                                          updatePkgField('groups', groupsCopy);
                                        }}
                                      />
                                    </td>
                                    <td>
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '8px',
                                        }}
                                      >
                                        <button
                                          className="qty-btn"
                                          onClick={() => handleAdjustPkgItemQty(0, idx, -1)}
                                        >
                                          -
                                        </button>
                                        <span className="qty-val">{neededVal}</span>
                                        <button
                                          className="qty-btn"
                                          onClick={() => handleAdjustPkgItemQty(0, idx, 1)}
                                        >
                                          +
                                        </button>
                                        <span style={{ color: 'var(--text-gray)' }}>/ {stockAvailable}</span>
                                        <span
                                          style={{
                                            color: isAvailable ? 'var(--green)' : 'var(--red)',
                                            fontWeight: 'bold',
                                            marginLeft: '6px',
                                          }}
                                        >
                                          {isAvailable ? '✓' : '×'}
                                        </span>
                                      </div>
                                    </td>
                                    <td style={{ textAlign: 'center', color: 'var(--text-gray)' }}>pc</td>
                                  </tr>
                                );
                              })}

                              <tr>
                                <td colSpan="4">
                                  {showAddPkgItem ? (
                                    <div style={{ display: 'flex', gap: '8px', padding: '6px 8px' }}>
                                      <input
                                        type="text"
                                        placeholder="Equipment description..."
                                        className="m-input"
                                        style={{ flex: 1, padding: '6px' }}
                                        value={newPkgItem.name}
                                        onChange={(e) => setNewPkgItem((p) => ({ ...p, name: e.target.value }))}
                                      />
                                      <button className="add-category-btn" onClick={handleAddPkgItem}>
                                        Add
                                      </button>
                                      <button
                                        className="m-btn-cancel"
                                        style={{ padding: '6px 12px' }}
                                        onClick={() => setShowAddPkgItem(false)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      className="add-equip-btn"
                                      onClick={() => setShowAddPkgItem(true)}
                                    >
                                      <em>Add Equipments</em> <span>+</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="pkg-notes-box">
                        <div className="pkg-notes-title">Notes:</div>
                        <textarea
                          className="pkg-notes-textarea"
                          value={pkgEditInputs.note}
                          onChange={(e) => updatePkgField('note', e.target.value)}
                          placeholder="Line-separated list of features or terms..."
                        />
                      </div>

                      <div className="pkg-action-row">
                        <button
                          className="m-btn-reject-confirm"
                          onClick={() => {
                            if (window.confirm('Delete this package?')) {
                              deleteAdminPackage(selectedPackage.id)
                                .then(() => {
                                  loadAllData();
                                  setSelectedPackage(null);
                                  showToast('Package deleted');
                                })
                                .catch((err) => {
                                  showToast(err.message || 'Failed to delete package', true);
                                });
                            }
                          }}
                        >
                          Delete Package
                        </button>
                        <button className="add-category-btn" onClick={handleSavePackageUpdates}>
                          Save Updates
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="summary-empty" style={{ padding: '80px 0' }}>
                      Select a package tab to edit, or click below to create a new one.
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 30px 40px' }}>
                    <button className="add-category-btn" onClick={handleAddPackage}>
                      Add Package
                    </button>
                  </div>
                </div>
              )}

              {/* ── ADD-ONS LIST VIEWS ── */}
              {currentPkgSection !== 'cosupplier' && (
                <div className="pkg-edit-card" style={{ margin: '20px 30px 40px' }}>
                  <div className="card-header-row">
                    <span className="category-title" style={{ textTransform: 'capitalize' }}>
                      {currentPkgSection === 'equipment'
                        ? 'Equipment'
                        : currentPkgSection === 'effects'
                        ? 'Special Effects'
                        : 'Miscellaneous'}
                    </span>
                    <span className="category-title">Price (Php)</span>
                  </div>

                  <div className="detail-table-wrap">
                    <table className="detail-table">
                      <thead>
                        <tr>
                          <th>Item Description</th>
                          <th className="col-action" style={{ textAlign: 'center' }}>Action</th>
                          <th className="col-price" style={{ textAlign: 'right' }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packages
                          .filter((p) => p.section === currentPkgSection)
                          .map((p) => (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.name}</strong>
                                {p.subtitle && (
                                  <p style={{ fontSize: '12px', color: 'var(--text-gray)', margin: 0 }}>
                                    ({p.subtitle})
                                  </p>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="bc-view-link"
                                  style={{ margin: '0 8px' }}
                                  onClick={() => openAddAddon(p)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="unit-remove-x"
                                  style={{ fontSize: '16px' }}
                                  onClick={() => handleDeleteAddon(p.id)}
                                >
                                  ×
                                </button>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                {p.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                {p.promo > 0 && (
                                  <span
                                    style={{
                                      display: 'block',
                                      fontSize: '12px',
                                      color: 'var(--text-gray)',
                                      fontWeight: 'normal',
                                    }}
                                  >
                                    (promo {p.promo.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}

                        <tr>
                          <td colSpan="3">
                            <button className="add-unit-row" onClick={() => openAddAddon(null)}>
                              <em>Add Equipment</em> <span className="plus">+</span>
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
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
                    onChange={() => setAddUnitModal((prev) => ({ ...prev, condition: 'Inoperative' }))}
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
