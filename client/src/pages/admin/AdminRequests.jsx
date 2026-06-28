import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchAdminRequests,
  updateAdminRequest,
  fetchAdminInventory,
  fetchAdminPackages,
} from '../../api/api';

export default function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [packages, setPackages] = useState([]);

  // Active status tab: 'pending' | 'approved' | 'denied'
  const [activeStatusTab, setActiveStatusTab] = useState('pending');
  // Selected request for details view
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Active tab inside request detail view: 'equipment' | 'bill'
  const [activeSectionTab, setActiveSectionTab] = useState('equipment');

  // Package dropdown open state
  const [pkgDropdownOpen, setPkgDropdownOpen] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  // Custom equipment item to add state
  const [showAddCustomEquip, setShowAddCustomEquip] = useState(false);
  const [customEquipSelection, setCustomEquipSelection] = useState({
    name: '',
    qty: 1,
  });

  // Billing extras (admin-set)
  const [mobilizationPrice, setMobilizationPrice] = useState(0);
  const [extensionHours, setExtensionHours] = useState(0);
  const [denialReason, setDenialReason] = useState('');
  const [showDenialInput, setShowDenialInput] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState(location.state?.searchId || '');

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (location.state?.searchId) {
      setSearchId(location.state.searchId);
    }
  }, [location.state?.searchId]);

  const loadAllData = () => {
    Promise.all([fetchAdminRequests(), fetchAdminInventory(), fetchAdminPackages()])
      .then(([reqData, invData, pkgData]) => {
        const nextRequests = reqData.requests || [];
        setRequests(nextRequests);
        setInventoryItems(invData.items || []);
        setPackages(pkgData.packages || []);

        // If there's a searchId, auto-select that request
        if (searchId) {
          const matched = nextRequests.find((r) => r.id.toLowerCase() === searchId.toLowerCase());
          if (matched) {
            setSelectedRequest(matched);
            setActiveSectionTab('equipment');
            // Pre-populate billing extras from saved billing_json
            if (matched.billing) {
              setMobilizationPrice(Number(matched.billing.mobilization) || 0);
              setExtensionHours(Number(matched.billing.extensionHours) || 0);
            }
          }
        }
      })
      .catch((err) => {
        console.error(err);
        showToast('Error loading requests data', true);
      });
  };

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  // Status mapping logic
  const isRequestInTab = (req, tab) => {
    const status = req.status?.toLowerCase();
    if (tab === 'pending') {
      return status === 'pending';
    }
    if (tab === 'approved') {
      return status === 'approved' || status === 'awaitingpayment' || status === 'upcoming' || status === 'completed';
    }
    if (tab === 'denied') {
      return status === 'denied' || status === 'cancelled';
    }
    return false;
  };

  // Filter requests based on selected tab and search ID
  const filteredRequests = requests.filter((r) => {
    const matchesSearch = searchId ? r.id.toLowerCase().includes(searchId.toLowerCase()) : true;
    const matchesTab = isRequestInTab(r, activeStatusTab);
    return matchesSearch && matchesTab;
  });

  // Calculate pricing breakdown
  const calculateBilling = (req) => {
    if (!req) return { base: 0, addons: [], mobilization: 0, extension: 0, total: 0 };
    const selectedPkg = req.package;
    const basePrice = selectedPkg ? ((req.promoApplied ? selectedPkg.promo || selectedPkg.price : selectedPkg.price) || 0) : 0;

    let addonsTotal = 0;
    const addons = [];

    // Any equipment requested is checked against base package items
    const pkgEquipment = selectedPkg && selectedPkg.groups
      ? selectedPkg.groups.flatMap((g) => g.items.map((item) => ({ name: item.name.toLowerCase(), qty: parseInt(item.qty) || 0 })))
      : [];

    req.equipment?.forEach((item) => {
      const neededQty = parseInt(item.qty) || 0;
      const matchedPkgItem = pkgEquipment.find((pkgIt) => item.name.toLowerCase().includes(pkgIt.name) || pkgIt.name.includes(item.name.toLowerCase()));
      const pkgQty = matchedPkgItem ? matchedPkgItem.qty : 0;

      // If quantity needed is more than package defaults, charge the extra count as addon
      if (neededQty > pkgQty) {
        const extraQty = neededQty - pkgQty;
        // Find price of this addon item in packages table
        const matchedAddonPkg = packages.find(
          (p) =>
            p.section !== 'cosupplier' &&
            (p.name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(p.name.toLowerCase()))
        );
        const unitPrice = matchedAddonPkg && matchedAddonPkg.price ? matchedAddonPkg.price : 1000; // fallback default price
        const cost = unitPrice * extraQty;
        addonsTotal += cost;
        addons.push({
          name: item.name,
          qty: extraQty,
          unitPrice,
          total: cost,
        });
      }
    });

    const mobilization = Number(mobilizationPrice) || 0;
    const extension = (Number(extensionHours) || 0) * 2500;

    return {
      base: basePrice,
      addons,
      mobilization,
      extension,
      total: basePrice + addonsTotal + mobilization + extension,
    };
  };

  // Flatten package items when overriding package
  const loadPackageEquipment = (pkg) => {
    if (!pkg || !pkg.groups) return [];
    return pkg.groups.flatMap((g) =>
      g.items.map((item) => ({
        category: g.category || 'SOUNDS',
        qty: item.qty,
        name: item.name,
      }))
    );
  };

  // Override Package
  const handleSelectPackageOverride = (pkg) => {
    if (!selectedRequest) return;
    const pkgEquip = loadPackageEquipment(pkg);
    setSelectedRequest((prev) => ({
      ...prev,
      package: pkg,
      equipment: pkgEquip,
    }));
    setPkgDropdownOpen(false);
  };

  // Adjust equipment qty in checklist
  const handleAdjustEquipQty = (itemIndex, delta) => {
    if (!selectedRequest) return;
    const equipCopy = [...selectedRequest.equipment];
    const currentQty = parseInt(equipCopy[itemIndex].qty) || 0;
    const nextQty = Math.max(0, currentQty + delta);
    const unitLabel = equipCopy[itemIndex].qty.replace(/[0-9\s]/g, '') || 'pc';

    if (nextQty === 0) {
      // Remove item
      equipCopy.splice(itemIndex, 1);
    } else {
      equipCopy[itemIndex].qty = `${nextQty} ${unitLabel.trim()}`;
    }

    setSelectedRequest((prev) => ({ ...prev, equipment: equipCopy }));
  };

  // Remove equipment item
  const handleRemoveEquipItem = (itemIndex) => {
    if (!selectedRequest) return;
    const equipCopy = selectedRequest.equipment.filter((_, idx) => idx !== itemIndex);
    setSelectedRequest((prev) => ({ ...prev, equipment: equipCopy }));
  };

  // Add custom equipment item
  const handleAddCustomEquip = () => {
    if (!customEquipSelection.name.trim() || !selectedRequest) return;
    const isDuplicate = selectedRequest.equipment.some(
      (e) => e.name.toLowerCase() === customEquipSelection.name.toLowerCase()
    );

    if (isDuplicate) {
      showToast('Equipment already exists in checklist', true);
      return;
    }

    // Determine category
    const matchedInv = inventoryItems.find((i) => i.name.toLowerCase().includes(customEquipSelection.name.toLowerCase()));
    const category = matchedInv ? (matchedInv.category === 'Lights' ? 'LIGHTS' : 'SOUNDS') : 'SOUNDS';

    const newItem = {
      category,
      qty: `${customEquipSelection.qty} pc`,
      name: customEquipSelection.name.trim(),
    };

    setSelectedRequest((prev) => ({
      ...prev,
      equipment: [...prev.equipment, newItem],
    }));

    setCustomEquipSelection({ name: '', qty: 1 });
    setShowAddCustomEquip(false);
  };

  // Toggle Promo discount
  const handleTogglePromo = () => {
    if (!selectedRequest) return;
    setSelectedRequest((prev) => ({
      ...prev,
      promoApplied: !prev.promoApplied,
    }));
  };

  // Save changes and/or change status (Approve / Reject / Mark as Paid)
  const handleSaveRequest = async (statusOverride = null) => {
    if (!selectedRequest) return;
    const nextStatus = statusOverride || selectedRequest.status;
    const calc = calculateBilling(selectedRequest);

    // Build billing payload to persist
    const billingPayload = {
      basePrice: selectedRequest.package?.price || 0,
      promoPrice: selectedRequest.package?.promo || 0,
      promoApplied: Boolean(selectedRequest.promoApplied),
      addonsTotal: calc.addons.reduce((s, a) => s + a.total, 0),
      mobilization: Number(mobilizationPrice) || 0,
      extensionHours: Number(extensionHours) || 0,
    };

    try {
      const response = await updateAdminRequest(selectedRequest.id, {
        status: nextStatus,
        package: selectedRequest.package,
        equipment: selectedRequest.equipment,
        additional: selectedRequest.additional,
        event: selectedRequest.event,
        billing: billingPayload,
        ...(nextStatus === 'denied' ? { denialReason } : {}),
      });

      // Update local requests list
      setRequests((prev) =>
        prev.map((r) => (r.id === selectedRequest.id ? response.request : r))
      );
      setSelectedRequest(response.request);
      showToast(`Request updated successfully (Status: ${nextStatus})`);
      if (statusOverride) {
        setSelectedRequest(null);
        setDenialReason('');
        setShowDenialInput(false);
        setMobilizationPrice(0);
        setExtensionHours(0);
      }
    } catch (err) {
      showToast(err.message || 'Failed to update request', true);
    }
  };

  // Open detail and pre-fill billing extras
  const openRequestDetail = (req) => {
    setSelectedRequest(req);
    setActiveSectionTab('equipment');
    setShowDenialInput(false);
    setDenialReason('');
    if (req.billing) {
      setMobilizationPrice(Number(req.billing.mobilization) || 0);
      setExtensionHours(Number(req.billing.extensionHours) || 0);
    } else {
      setMobilizationPrice(0);
      setExtensionHours(0);
    }
  };

  const billingBreakdown = calculateBilling(selectedRequest);

  return (
    <section className="main-content">
      {/* ── Page Header ── */}
      <header className="page-header" style={{ borderBottom: 'none' }}>
        <div>
          <p className="admin-eyebrow" style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--text-gray)' }}>
            Requests
          </p>
          <h1 className="page-title" style={{ marginTop: '4px' }}>
            Manage Bookings and Rentals
          </h1>
        </div>
      </header>

      {/* ── Status Tab Tracker ── */}
      {!selectedRequest && (
        <div className="requests-status-bar">
          <div className="status-bar">
            <div className="status-tabs">
              <button
                className={`status-tab ${activeStatusTab === 'pending' ? 'active' : ''}`}
                onClick={() => setActiveStatusTab('pending')}
              >
                PENDING
              </button>
              <button
                className={`status-tab ${activeStatusTab === 'approved' ? 'active' : ''}`}
                onClick={() => setActiveStatusTab('approved')}
              >
                APPROVED
              </button>
              <button
                className={`status-tab ${activeStatusTab === 'denied' ? 'active' : ''}`}
                onClick={() => setActiveStatusTab('denied')}
              >
                DENIED
              </button>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  left:
                    activeStatusTab === 'pending'
                      ? '0%'
                      : activeStatusTab === 'approved'
                        ? '33.333%'
                        : '66.666%',
                  width: '33.333%',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Requests List ── */}
      {!selectedRequest ? (
        <div className="category-list" style={{ paddingTop: 0 }}>
          {searchId && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: '#fff',
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1.5px solid var(--border)',
                marginBottom: '10px',
              }}
            >
              <span style={{ fontSize: '14px', color: 'var(--text-dark)' }}>
                Showing only request: <strong>{searchId}</strong>
              </span>
              <button
                onClick={() => setSearchId('')}
                style={{
                  backgroundColor: 'var(--dark-blue)',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'Garet',
                  fontSize: '13px',
                }}
              >
                Clear Filter
              </button>
            </div>
          )}

          <div className="booking-list">
            {filteredRequests.length > 0 ? (
              filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className="booking-card"
                  onClick={() => openRequestDetail(req)}
                >
                  <div className="bc-top">
                    <div>
                      <span className="bc-id-label">Request ID:</span>
                      <span className="bc-id-value">{req.id}</span>
                    </div>
                    <button className="bc-view-link">View Details</button>
                  </div>
                  <div className="bc-cols">
                    <span>EVENT DATE</span>
                    <span>VENUE</span>
                    <span>STATUS</span>
                  </div>
                  <div className="bc-vals">
                    <span>{req.event?.date}</span>
                    <span>{req.event?.venue}</span>
                    <span>
                      <span
                        className={`status-badge ${req.status === 'approved' || req.status === 'awaitingpayment' || req.status === 'completed' || req.status === 'upcoming'
                            ? 'approved'
                            : req.status === 'denied' || req.status === 'cancelled'
                              ? 'denied'
                              : ''
                          }`}
                      >
                        {req.status}
                      </span>
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-msg" style={{ padding: '80px 0' }}>
                No requests found in this group.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Detailed Request View ── */
        <div className="requests-detail-view" id="detailView">
          <button
            className="back-btn"
            onClick={() => {
              setSelectedRequest(null);
              setSearchId('');
            }}
          >
            ← Back
          </button>

          <div className="detail-card">
            {/* Meta Row */}
            <div className="detail-meta">
              <div className="meta-row">
                <span className="meta-label">Request Details</span>
                <span className="meta-value bold">Request ID: {selectedRequest.id}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label" style={{ fontSize: '13px', color: 'var(--text-gray)' }}>
                  Date Requested: {selectedRequest.dateRequested || new Date(selectedRequest.createdAt).toLocaleDateString()}
                </span>
                <span className="meta-value">
                  Status:{' '}
                  <span
                    className={`status-badge ${selectedRequest.status === 'approved' || selectedRequest.status === 'awaitingpayment' || selectedRequest.status === 'completed' || selectedRequest.status === 'upcoming'
                        ? 'approved'
                        : selectedRequest.status === 'denied' || selectedRequest.status === 'cancelled'
                          ? 'denied'
                          : ''
                      }`}
                  >
                    {selectedRequest.status}
                  </span>
                </span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="details-grid">
              {/* Event Details */}
              <div className="details-box dashed">
                <div className="details-box-title">EVENT DETAILS</div>
                <div className="details-box-body">
                  <p>
                    <strong>Occasion:</strong> {selectedRequest.event?.title || 'N/A'}
                  </p>
                  <p>
                    <strong>Venue:</strong> {selectedRequest.event?.venue || 'N/A'}
                  </p>
                  <p>
                    <strong>Pax count:</strong> {selectedRequest.event?.pax || 'N/A'}
                  </p>
                  <p>
                    <strong>Date & Time:</strong> {selectedRequest.event?.date} (
                    {selectedRequest.event?.timeStart} - {selectedRequest.event?.timeEnd})
                  </p>
                </div>
              </div>

              {/* Client Details */}
              <div className="details-box dashed">
                <div className="details-box-title">CLIENT DETAILS</div>
                <div className="details-box-body">
                  <p>
                    <strong>Name:</strong> {selectedRequest.customerName || 'N/A'}
                  </p>
                  <p>
                    <strong>Email:</strong> {selectedRequest.customerEmail || 'N/A'}
                  </p>
                  <p>
                    <strong>Contact No.:</strong> {selectedRequest.customerPhone || 'N/A'}
                  </p>
                  <button
                    className="chat-btn"
                    onClick={() => {
                      navigate('/admin/inquiries', {
                        state: {
                          selectCustomerId: selectedRequest.customerId,
                          selectCustomerName: selectedRequest.customerName,
                        },
                      });
                    }}
                  >
                    Chat Client
                  </button>
                </div>
              </div>
            </div>

            {/* Section tabs */}
            <div className="section-tabs">
              <button
                className={`section-tab ${activeSectionTab === 'equipment' ? 'active' : ''}`}
                onClick={() => setActiveSectionTab('equipment')}
              >
                Equipment Details
              </button>
              <button
                className={`section-tab ${activeSectionTab === 'bill' ? 'active' : ''}`}
                onClick={() => setActiveSectionTab('bill')}
              >
                Estimated Bill
              </button>
            </div>

            {/* Section Content */}
            <div className="section-content">
              {activeSectionTab === 'equipment' ? (
                <>
                  {/* Package Overrides */}
                  <div className="pkg-dropdown-wrap">
                    <button
                      className={`pkg-dropdown-btn ${pkgDropdownOpen ? 'open' : ''}`}
                      onClick={() => setPkgDropdownOpen(!pkgDropdownOpen)}
                    >
                      <span>
                        Package Option:{' '}
                        <strong>{selectedRequest.package?.name || 'CUSTOM / NO PACKAGE'}</strong>
                      </span>
                      <span id="pkgArrow">▼</span>
                    </button>
                    <div className={`pkg-dropdown-menu ${pkgDropdownOpen ? 'open' : ''}`}>
                      <div
                        className="pkg-option"
                        onClick={() =>
                          handleSelectPackageOverride({
                            name: 'CUSTOM / NO PACKAGE',
                            price: 0,
                            promo: 0,
                            groups: [],
                          })
                        }
                      >
                        CUSTOM / NO PACKAGE
                      </div>
                      {packages
                        .filter((p) => p.section === 'cosupplier')
                        .map((p) => (
                          <div
                            key={p.id}
                            className="pkg-option"
                            onClick={() => handleSelectPackageOverride(p)}
                          >
                            {p.name} ({p.subtitle})
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Equipment Table */}
                  <div className="equip-table">
                    <div className="equip-header">
                      <span />
                      <span>Equipment Type</span>
                      <span className="col-qty">Qty. Needed</span>
                      <span className="col-unit">Unit</span>
                    </div>

                    {/* Group request equipment into Sounds and Lights */}
                    {['SOUNDS', 'LIGHTS'].map((cat) => {
                      const itemsInCat =
                        selectedRequest.equipment?.filter(
                          (item) => (item.category || 'SOUNDS').toUpperCase() === cat
                        ) || [];
                      if (itemsInCat.length === 0) return null;

                      return (
                        <div key={cat}>
                          <div className="equip-category-label">{cat}</div>
                          <hr className="equip-category-divider" />

                          {itemsInCat.map((item) => {
                            const globalIndex = selectedRequest.equipment.findIndex(
                              (e) => e.name === item.name
                            );
                            const neededVal = parseInt(item.qty) || 0;

                            // Lookup available stock in inventory
                            const matchedInv = inventoryItems.find((inv) =>
                              inv.name.toLowerCase().includes(item.name.toLowerCase())
                            );
                            const stockAvailable = matchedInv ? matchedInv.stock : 0;
                            const isAvailable = stockAvailable >= neededVal;

                            return (
                              <div key={item.name} className="equip-row removable">
                                <button
                                  className="equip-remove-x"
                                  onClick={() => handleRemoveEquipItem(globalIndex)}
                                >
                                  ×
                                </button>
                                <div>
                                  <span>{item.name}</span>
                                  {!isAvailable && (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        color: 'var(--red)',
                                        marginLeft: '8px',
                                        fontStyle: 'italic',
                                      }}
                                    >
                                      (Low stock: {stockAvailable} available)
                                    </span>
                                  )}
                                </div>
                                <div className="qty-stepper">
                                  <button
                                    className="qty-btn"
                                    onClick={() => handleAdjustEquipQty(globalIndex, -1)}
                                  >
                                    -
                                  </button>
                                  <span className="qty-val">{neededVal}</span>
                                  <button
                                    className="qty-btn"
                                    onClick={() => handleAdjustEquipQty(globalIndex, 1)}
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="equip-unit">pc</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    <div style={{ marginTop: '12px' }}>
                      {showAddCustomEquip ? (
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            padding: '8px',
                            border: '1px dashed #ccc',
                            borderRadius: '8px',
                          }}
                        >
                          <select
                            className="m-input"
                            style={{ flex: 1 }}
                            value={customEquipSelection.name}
                            onChange={(e) =>
                              setCustomEquipSelection((prev) => ({ ...prev, name: e.target.value }))
                            }
                          >
                            <option value="">-- Select Gear Variation --</option>
                            {inventoryItems.map((inv) => (
                              <option key={inv.id} value={getItemDisplayName(inv.name)}>
                                {inv.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            className="m-input"
                            style={{ width: '80px' }}
                            min="1"
                            value={customEquipSelection.qty}
                            onChange={(e) =>
                              setCustomEquipSelection((prev) => ({ ...prev, qty: Number(e.target.value) }))
                            }
                          />
                          <button className="add-category-btn" onClick={handleAddCustomEquip}>
                            Add
                          </button>
                          <button
                            className="m-btn-cancel"
                            onClick={() => setShowAddCustomEquip(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button className="add-equip-btn" onClick={() => setShowAddCustomEquip(true)}>
                          <em>Add Custom Equipment Addon</em> <span>+</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="approval-actions" style={{ marginTop: '20px' }}>
                    <button className="btn-next" onClick={() => setActiveSectionTab('bill')}>
                      Next
                    </button>
                  </div>
                </>
              ) : (
                /* ── Estimated Bill ── */
                <>
                  <div className="billing-table">
                    {/* Base package item */}
                    {selectedRequest.package && (
                      <>
                        <div className="billing-row">
                          <span className="billing-label">
                            {selectedRequest.package.name} (Base Price)
                          </span>
                          <span className="billing-val">
                            Php{' '}
                            {billingBreakdown.base.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <hr className="billing-divider" />
                      </>
                    )}

                    {/* Addons breakdown */}
                    {billingBreakdown.addons.map((add) => (
                      <div key={add.name} className="billing-row">
                        <span className="billing-label" style={{ fontSize: '14px' }}>
                          Add-on: {add.name} ({add.qty} extra @ Php {add.unitPrice.toLocaleString()})
                        </span>
                        <span className="billing-val">
                          Php {add.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}

                    {billingBreakdown.addons.length > 0 && <hr className="billing-divider" />}

                    {/* Mobilization and Extension inputs */}
                    <div className="billing-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
                      <span className="billing-label">Mobilization Fee:</span>
                      <span className="billing-val">
                        Php{' '}
                        <input
                          type="number"
                          value={mobilizationPrice}
                          onChange={(e) => setMobilizationPrice(Math.max(0, Number(e.target.value)))}
                          style={{
                            width: '120px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #ccc',
                            fontFamily: 'inherit',
                            fontSize: '14px',
                            textAlign: 'right'
                          }}
                        />
                      </span>
                    </div>

                    <div className="billing-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0' }}>
                      <span className="billing-label">Extension Hours (₱2,500/hr):</span>
                      <span className="billing-val" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={extensionHours}
                          onChange={(e) => setExtensionHours(Math.max(0, Number(e.target.value)))}
                          style={{
                            width: '70px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #ccc',
                            fontFamily: 'inherit',
                            fontSize: '14px',
                            textAlign: 'center'
                          }}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--text-gray)' }}>
                          (= Php {(extensionHours * 2500).toLocaleString()})
                        </span>
                      </span>
                    </div>
                    <hr className="billing-divider" />

                    {/* Estimated Total */}
                    <div className="billing-row total-row">
                      <span className="billing-label" style={{ fontWeight: 'bold' }}>
                        Estimated Rental Bill:
                      </span>
                      <span className="billing-val" style={{ fontWeight: 'bold' }}>
                        Php{' '}
                        {billingBreakdown.total.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  {showDenialInput ? (
                    <div style={{ marginTop: '20px', padding: '16px', background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: '10px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc2626', marginBottom: '8px' }}>
                        Specify Reason for Denial:
                      </div>
                      <textarea
                        value={denialReason}
                        onChange={(e) => setDenialReason(e.target.value)}
                        placeholder="Explain why this request is being denied..."
                        style={{
                          width: '100%',
                          minHeight: '80px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #fca5a5',
                          fontFamily: 'inherit',
                          fontSize: '14px',
                          marginBottom: '12px',
                          boxSizing: 'border-box',
                          resize: 'vertical'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-next"
                          onClick={() => {
                            setShowDenialInput(false);
                            setDenialReason('');
                          }}
                          style={{ backgroundColor: '#e5e7eb', color: '#374151' }}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => handleSaveRequest('denied')}
                          disabled={!denialReason.trim()}
                        >
                          Confirm Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="billing-actions" style={{ marginTop: '30px' }}>
                      {selectedRequest.package && (
                        <button
                          className={`btn-promo ${selectedRequest.promoApplied ? 'applied' : ''}`}
                          onClick={handleTogglePromo}
                        >
                          {selectedRequest.promoApplied ? 'Promo Applied ✓' : 'Apply Promo Price'}
                        </button>
                      )}

                      <div className="final-btns" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button className="btn-next" onClick={() => handleSaveRequest()}>
                          Save Changes
                        </button>

                        {(selectedRequest.status === 'pending' || selectedRequest.status === 'approved' || selectedRequest.status === 'awaitingpayment' || selectedRequest.status === 'upcoming') && (
                          <button className="btn-reject" onClick={() => setShowDenialInput(true)}>
                            Reject
                          </button>
                        )}

                        {selectedRequest.status === 'pending' && (
                          <button className="btn-approve" onClick={() => handleSaveRequest('approved')}>
                            Approve
                          </button>
                        )}

                        {(selectedRequest.status === 'approved' || selectedRequest.status === 'awaitingpayment') && (
                          <button
                            className="btn-approve"
                            onClick={() => handleSaveRequest('upcoming')}
                            style={{ backgroundColor: '#7c3aed' }}
                          >
                            Mark as Paid
                          </button>
                        )}

                        {selectedRequest.status === 'upcoming' && (
                          <button
                            className="btn-approve"
                            onClick={() => handleSaveRequest('completed')}
                            style={{ backgroundColor: '#059669' }}
                          >
                            Complete Event
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Element ── */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'is-error' : ''}`}>
        {toast.message}
      </div>
    </section>
  );
}
