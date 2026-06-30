import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createRequest, fetchInventory } from '../api/api';
import '../styles/make-request.css';

function generateId(prefix = 'BK') {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const random = () => letters[Math.floor(Math.random() * letters.length)];
  const number = String(Math.floor(1 + Math.random() * 9999)).padStart(4, '0');
  return `${prefix}-${random()}${random()}${number}`;
}

const EMPTY_FORM = { title: '', venue: '', pax: '', date: '', timeStart: '', timeEnd: '' };

export default function MakeRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab flip
  const [activeTab, setActiveTab] = useState('book'); // 'book' | 'rent'

  // Form state (shared event fields)
  const [bookForm, setBookForm] = useState(EMPTY_FORM);
  const [rentForm, setRentForm] = useState(EMPTY_FORM);
  const [bookAdditional, setBookAdditional] = useState('');
  const [rentAdditional, setRentAdditional] = useState('');

  // Generated IDs
  const [bookingId, setBookingId] = useState(() => generateId('BK'));
  const [requestId, setRequestId] = useState(() => generateId('RQ'));

  // Inventory
  const [inventoryGroups, setInventoryGroups] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { type, id }
  const [error, setError] = useState('');

  // Load inventory from DB
  useEffect(() => {
    fetchInventory()
      .then((data) => {
        // Group items by category
        const grouped = {};
        (data.items || []).forEach((item) => {
          if (!grouped[item.category]) grouped[item.category] = [];
          grouped[item.category].push(item);
        });
        const groups = Object.entries(grouped).map(([group, items]) => ({ group, items }));
        setInventoryGroups(groups);
        // Open all groups by default
        const init = {};
        groups.forEach(g => { init[g.group] = true; });
        setOpenGroups(init);
      })
      .catch(() => {
        setInventoryGroups([]);
      })
      .finally(() => setInventoryLoading(false));
  }, []);

  // All flat inventory items (for lookup)
  const allItems = useMemo(() =>
    inventoryGroups.flatMap(g => g.items),
    [inventoryGroups]
  );

  // Filtered groups by search
  const filteredGroups = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return inventoryGroups;
    return inventoryGroups
      .map(g => ({ ...g, items: g.items.filter(i => i.name.toLowerCase().includes(q)) }))
      .filter(g => g.items.length > 0);
  }, [searchTerm, inventoryGroups]);

  // Selected items array with quantity
  const selectedItems = useMemo(() =>
    Object.keys(selectedEquipment).map(id => {
      const item = allItems.find(x => x.id === id);
      return item ? { ...item, qty: selectedEquipment[id] } : null;
    }).filter(Boolean),
    [selectedEquipment, allItems]
  );

  const handleToggleEquipment = (item) => {
    setSelectedEquipment(prev => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = 1;
      }
      return next;
    });
  };

  const handleQty = (itemId, change) => {
    const item = allItems.find(x => x.id === itemId);
    const maxStock = item?.stock ?? 99;
    setSelectedEquipment(prev => {
      const current = prev[itemId] ?? 1;
      const next = Math.min(maxStock, Math.max(1, current + change));
      return { ...prev, [itemId]: next };
    });
  };

  const toggleGroup = (group) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const resetFormState = () => {
    setBookForm(EMPTY_FORM);
    setRentForm(EMPTY_FORM);
    setBookAdditional('');
    setRentAdditional('');
    setSelectedEquipment({});
    setSearchTerm('');
    setDropdownOpen(false);
    setError('');
    setBookingId(generateId('BK'));
    setRequestId(generateId('RQ'));
  };

  const handleSubmit = async (type) => {
    const form = type === 'book' ? bookForm : rentForm;
    const additional = type === 'book' ? bookAdditional : rentAdditional;

    if (!user?.id) {
      setError('Please sign in before submitting a request.');
      return;
    }
    if (!form.title || !form.venue || !form.date || !form.timeStart || !form.timeEnd) {
      setError('Please fill out all required event details.');
      return;
    }
    if (type === 'rent' && selectedItems.length === 0) {
      setError('Please select at least one equipment item.');
      return;
    }

    const id = type === 'book' ? bookingId : requestId;
    const payload = {
      type,
      id,
      customerId: user.id,
      title: form.title,
      venue: form.venue,
      pax: form.pax,
      date: form.date,
      timeStart: form.timeStart,
      timeEnd: form.timeEnd,
      additional,
      equipment: type === 'rent' ? selectedItems : [],
    };

    setSubmitting(true);
    setError('');
    try {
      await createRequest(payload);
      setSubmitted({ type, id });
    } catch (err) {
      setError(err.message || 'Unable to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ──────────────────────────────────────────────────────────
  if (submitted) {
    const isBook = submitted.type === 'book';
    return (
      <div className="request-wrapper">
        <div className="card-scene">
          <div className="success-card">
            <div className="success-icon-wrap">
              <svg viewBox="0 0 52 52" className="success-checkmark">
                <circle className="success-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="success-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>
            <h2 className="success-title">Request Submitted!</h2>
            <p className="success-subtitle">
              Your {isBook ? 'booking' : 'rent'} request has been sent to the admin for evaluation.
            </p>
            <div className="success-id-box">
              <span className="success-id-label">{isBook ? 'Booking ID' : 'Request ID'}</span>
              <span className="success-id-value">{submitted.id}</span>
            </div>
            <p className="success-note">
              Please keep your {isBook ? 'Booking ID' : 'Request ID'} for reference. The admin will review your request and get back to you soon.
            </p>
            <div className="success-actions">
              <button
                className="success-btn primary"
                onClick={() => navigate('/my-requests')}
              >
                View My Requests
              </button>
              <button
                className="success-btn secondary"
                onClick={() => {
                  setSubmitted(null);
                  resetFormState();
                }}
              >
                Make Another Request
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form Fields renderer ────────────────────────────────────────────────────
  const renderFields = (formValues, setForm) => (
    <div className="form-fields">
      {[
        { label: 'Title of Event', key: 'title', type: 'text' },
        { label: 'Venue', key: 'venue', type: 'text' },
        { label: 'No. of Guests', key: 'pax', type: 'number' },
        { label: 'Date', key: 'date', type: 'date' },
        { label: 'Time Start', key: 'timeStart', type: 'time' },
        { label: 'Time End', key: 'timeEnd', type: 'time' },
      ].map(({ label, key, type }) => (
        <div className="field-row" key={key}>
          <label className="field-label">{label}</label>
          <input
            className="field-input"
            type={type}
            value={formValues[key]}
            onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
            required
          />
        </div>
      ))}
    </div>
  );

  // ── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div className="request-wrapper">
      <div className="card-scene single-card">

        {/* Tab Bar */}
        <div className="form-tab-bar">
          <div
            className={`tab ${activeTab === 'book' ? 'active-tab' : 'inactive-tab'}`}
            onClick={() => { setActiveTab('book'); setError(''); }}
          >
            BOOKING REQUEST
          </div>
          <div
            className={`tab ${activeTab === 'rent' ? 'active-tab' : 'inactive-tab'}`}
            onClick={() => { setActiveTab('rent'); setError(''); }}
          >
            RENT REQUEST
          </div>
        </div>

        {/* ── BOOKING REQUEST FORM ── */}
        {activeTab === 'book' && (
          <div className="form-body">
            <div className="form-id-row">
              <span className="form-id-label">Booking ID</span>
              <span className="form-id-value">{bookingId}</span>
            </div>
            <hr className="form-divider" />

            <div className="form-section-note">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              The admin will select the appropriate package for your event based on the details you provide.
            </div>

            <p className="form-instruction"><em>Kindly fill out the following event details.</em></p>
            {renderFields(bookForm, setBookForm)}

            <p className="form-instruction additional-label"><em>If you have any additional requirements, please specify.</em></p>
            <textarea
              className="additional-input"
              rows="3"
              placeholder="e.g. Need extra extension cords, specific microphone setups, etc."
              value={bookAdditional}
              onChange={(e) => setBookAdditional(e.target.value)}
            />

            {error && <div className="form-error">{error}</div>}

            <div className="form-footer">
              <button
                type="button"
                className="confirm-btn"
                onClick={() => handleSubmit('book')}
                disabled={submitting}
              >
                {submitting ? 'SUBMITTING...' : 'CONFIRM BOOKING REQUEST'}
              </button>
            </div>
          </div>
        )}

        {/* ── RENT REQUEST FORM ── */}
        {activeTab === 'rent' && (
          <div className="form-body">
            <div className="form-id-row">
              <span className="form-id-label">Request ID</span>
              <span className="form-id-value">{requestId}</span>
            </div>
            <hr className="form-divider" />

            <p className="form-instruction"><em>Kindly fill out the following event details.</em></p>
            {renderFields(rentForm, setRentForm)}

            {/* Equipment Dropdown */}
            <div className="equipment-dropdown-wrapper">
              <div
                className="equipment-dropdown-header"
                onClick={() => setDropdownOpen(v => !v)}
              >
                <div>
                  <div>Select equipment for rent</div>
                  <div className="equipment-dropdown-subtitle">
                    <em>(<span className="auth-star">*</span> = requires RRC operator to avoid equipment damage or misuse)</em>
                  </div>
                </div>
                <span className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`}>▼</span>
              </div>

              {dropdownOpen && (
                <div className="equipment-dropdown-body open">
                  {/* Search */}
                  <div className="equip-search-wrapper">
                    <svg className="equip-search-icon" viewBox="0 0 24 24">
                      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                    <input
                      type="text"
                      className="equip-search-input"
                      placeholder="Search equipment..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button className="equip-clear-btn" onClick={() => setSearchTerm('')}>✕</button>
                    )}
                  </div>

                  {inventoryLoading ? (
                    <div className="equip-loading">Loading equipment...</div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="equip-no-results">No equipment matching your search.</div>
                  ) : (
                    <div id="equipmentList">
                      {filteredGroups.map((group) => (
                        <div key={group.group}>
                          <div
                            className="equip-group-header"
                            onClick={() => toggleGroup(group.group)}
                          >
                            <span className="equip-group-name">{group.group}</span>
                            <span className="equip-group-count">{group.items.length} items</span>
                            <span className={`equip-group-chevron ${openGroups[group.group] ? 'open' : ''}`}>▶</span>
                          </div>
                          {openGroups[group.group] && group.items.map((item) => (
                            <label
                              key={item.id}
                              className={`equipment-item ${selectedEquipment[item.id] ? 'checked' : ''} ${item.stock === 0 ? 'out-of-stock' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(selectedEquipment[item.id])}
                                onChange={() => item.stock > 0 && handleToggleEquipment(item)}
                                disabled={item.stock === 0}
                              />
                              <span className="equipment-name">
                                {item.name}
                                {item.requiresAuth && <span className="equipment-auth-badge"> *</span>}
                              </span>
                              <span className={`equip-stock-tag ${item.stock === 0 ? 'stock-zero' : item.stock <= 2 ? 'stock-low' : ''}`}>
                                {item.stock === 0 ? 'Out of stock' : `${item.stock} avail.`}
                              </span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Equipment Summary */}
            {selectedItems.length > 0 && (
              <div className="selected-equip-section">
                <div className="selected-equip-label">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  Selected Equipment ({selectedItems.length} item{selectedItems.length > 1 ? 's' : ''})
                </div>
                <div className="selected-equip-chips">
                  {selectedItems.map((item) => (
                    <div key={item.id} className={`equip-chip ${item.requiresAuth ? 'chip-auth' : ''}`}>
                      <div className="chip-info">
                        <span className="chip-name">{item.name}</span>
                        {item.requiresAuth && (
                          <span className="chip-auth-note">Requires RRC operator</span>
                        )}
                      </div>
                      <div className="chip-stepper">
                        <button
                          type="button"
                          className="stepper-btn minus"
                          onClick={() => handleQty(item.id, -1)}
                          disabled={item.qty <= 1}
                        >−</button>
                        <span className="stepper-qty">{item.qty}</span>
                        <button
                          type="button"
                          className="stepper-btn plus"
                          onClick={() => handleQty(item.id, 1)}
                          disabled={item.qty >= item.stock}
                          title={item.qty >= item.stock ? `Max available: ${item.stock}` : `Add more (max ${item.stock})`}
                        >+</button>
                      </div>
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={() => handleToggleEquipment(item)}
                        title="Remove"
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="form-instruction additional-label"><em>If you have any additional requirements, please specify.</em></p>
            <textarea
              className="additional-input"
              rows="3"
              placeholder="e.g. Delivery instructions, setup notes, etc."
              value={rentAdditional}
              onChange={(e) => setRentAdditional(e.target.value)}
            />

            {error && <div className="form-error">{error}</div>}

            <div className="form-footer">
              <button
                type="button"
                className="confirm-btn"
                onClick={() => handleSubmit('rent')}
                disabled={submitting}
              >
                {submitting ? 'SUBMITTING...' : 'CONFIRM RENT REQUEST'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
