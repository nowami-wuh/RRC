import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchRequests,
  cancelRequest,
} from '../api/api';
import '../styles/my-requests.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'pending',   label: 'Pending',   color: '#d97706' },
  { key: 'approved',  label: 'Approved',  color: '#2563eb' },
  { key: 'upcoming',  label: 'Upcoming',  color: '#7c3aed' },
  { key: 'completed', label: 'Completed', color: '#059669' },
  { key: 'denied',    label: 'Denied',    color: '#dc2626' },
  { key: 'cancelled', label: 'Cancelled', color: '#6b7280' },
];

// Map DB statuses to tab keys
function getTabKey(status) {
  if (!status) return 'pending';
  const s = status.toLowerCase();
  if (s === 'pending') return 'pending';
  if (s === 'approved' || s === 'awaitingpayment') return 'approved';
  if (s === 'upcoming') return 'upcoming';
  if (s === 'completed') return 'completed';
  if (s === 'denied') return 'denied';
  if (s === 'cancelled') return 'cancelled';
  return 'pending';
}

function statusBadgeText(status) {
  const map = {
    pending: 'Pending Review',
    approved: 'Approved',
    awaitingpayment: 'Awaiting Downpayment',
    upcoming: 'Upcoming',
    completed: 'Completed',
    denied: 'Denied',
    cancelled: 'Cancelled',
  };
  return map[status?.toLowerCase()] || (status || 'Unknown');
}

function formatCurrency(val) {
  const num = Number(val) || 0;
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Billing Breakdown Component ────────────────────────────────────────────────
function BillingBreakdown({ billing, pkg }) {
  if (!billing && !pkg) return <p className="mr-no-billing">No billing details yet.</p>;

  const b = billing || {};
  const basePrice   = Number(b.basePrice)   || 0;
  const promoPrice  = Number(b.promoPrice)  || 0;
  const addonsTotal = Number(b.addonsTotal) || 0;
  const mobilization= Number(b.mobilization)|| 0;
  const extensionHrs= Number(b.extensionHours) || 0;
  const extensionAmt= extensionHrs * 2500;
  const downpayment = Number(b.downpayment) || 0;
  const promoApplied = Boolean(b.promoApplied);

  const effectiveBase = promoApplied && promoPrice > 0 ? promoPrice : basePrice;
  const total = effectiveBase + addonsTotal + mobilization + extensionAmt;
  const balance = total - downpayment;

  return (
    <div className="mr-billing-table">
      {basePrice > 0 && (
        <div className="mr-billing-row">
          <span className="mr-billing-label">
            {pkg?.name || 'Package'} — Base Price
            {promoApplied && promoPrice > 0 && (
              <span className="mr-promo-tag">PROMO</span>
            )}
          </span>
          <span className="mr-billing-val">
            {promoApplied && promoPrice > 0 ? (
              <>
                <span className="mr-strike">{formatCurrency(basePrice)}</span>
                {' '}{formatCurrency(promoPrice)}
              </>
            ) : formatCurrency(basePrice)}
          </span>
        </div>
      )}

      {addonsTotal > 0 && (
        <div className="mr-billing-row">
          <span className="mr-billing-label">Equipment / Special Effects Add-ons</span>
          <span className="mr-billing-val">{formatCurrency(addonsTotal)}</span>
        </div>
      )}

      {mobilization > 0 && (
        <div className="mr-billing-row">
          <span className="mr-billing-label">Mobilization Fee</span>
          <span className="mr-billing-val">{formatCurrency(mobilization)}</span>
        </div>
      )}

      {extensionHrs > 0 && (
        <div className="mr-billing-row">
          <span className="mr-billing-label">
            Duration Extension ({extensionHrs} hr{extensionHrs > 1 ? 's' : ''} × ₱2,500/hr)
          </span>
          <span className="mr-billing-val">{formatCurrency(extensionAmt)}</span>
        </div>
      )}

      <div className="mr-billing-divider" />

      <div className="mr-billing-row mr-billing-total">
        <span className="mr-billing-label">Total Amount</span>
        <span className="mr-billing-val">{formatCurrency(total)}</span>
      </div>

      {downpayment > 0 && (
        <>
          <div className="mr-billing-row">
            <span className="mr-billing-label">Downpayment Received</span>
            <span className="mr-billing-val mr-green">{formatCurrency(downpayment)}</span>
          </div>
          <div className="mr-billing-row">
            <span className="mr-billing-label">Remaining Balance</span>
            <span className="mr-billing-val">{formatCurrency(balance)}</span>
          </div>
        </>
      )}

      {!billing && (
        <p className="mr-billing-note">
          * Billing details will be finalized by the admin. Please check back or coordinate via chat.
        </p>
      )}
    </div>
  );
}

// ── Equipment List Component ───────────────────────────────────────────────────
function EquipmentList({ equipment, type }) {
  if (!equipment || equipment.length === 0) {
    return (
      <p className="mr-no-billing">
        {type === 'rent'
          ? 'No equipment specified.'
          : 'Equipment list will be provided once the admin assigns a package.'}
      </p>
    );
  }

  const grouped = equipment.reduce((acc, item) => {
    const cat = (item.category || 'SOUNDS').toUpperCase();
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="mr-equip-list">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <div className="mr-equip-cat">{cat}</div>
          {items.map((item, i) => (
            <div key={i} className="mr-equip-row">
              <span className="mr-equip-qty">{item.qty}</span>
              <span className="mr-equip-name">{item.name}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MyRequests() {
  const { user } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();

  const [requests,      setRequests]      = useState([]);
  const [activeTab,     setActiveTab]     = useState('pending');
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  // Expanded card state (one expanded at a time per tab)
  const [expandedId, setExpandedId] = useState(null);
  // Active section inside expanded card
  const [expandedSection, setExpandedSection] = useState('details'); // 'details' | 'billing' | 'equipment'

  // Cancel modal
  const [cancelModal, setCancelModal]   = useState(null); // { request }
  const [cancelling,  setCancelling]    = useState(false);
  const [cancelError, setCancelError]   = useState('');

  // Search / highlight from calendar navigation
  const [searchId,    setSearchId]    = useState(location.state?.searchId || '');
  const highlightRef = useRef(null);

  // ── Data Loading ─────────────────────────────────────────────────────────────

  const loadData = useCallback(() => {
    if (!user?.id) { setLoading(false); setError('Please sign in to view your requests.'); return; }

    setLoading(true);
    fetchRequests(user.id)
      .then((data) => {
        setRequests(data.requests || []);
      })
      .catch(() => setError('Unable to load requests.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-select tab when arriving from calendar with searchId
  useEffect(() => {
    if (location.state?.searchId) {
      setSearchId(location.state.searchId);
      setActiveTab('pending'); // will be overridden once requests load
    }
  }, [location.state?.searchId]);

  // Once requests load, if searchId set, jump to the right tab and expand the card
  useEffect(() => {
    if (searchId && requests.length > 0) {
      const found = requests.find((r) => r.id.toLowerCase() === searchId.toLowerCase());
      if (found) {
        setActiveTab(getTabKey(found.status));
        setExpandedId(found.id);
      }
    }
  }, [searchId, requests]);

  // Scroll highlighted card into view
  useEffect(() => {
    if (searchId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchId, expandedId]);

  // ── Derived data ──────────────────────────────────────────────────────────────

  const filteredRequests = requests.filter((r) => getTabKey(r.status) === activeTab);

  // ── Cancel handlers ───────────────────────────────────────────────────────────

  const openCancelModal  = (req) => { setCancelModal({ request: req }); setCancelError(''); };
  const closeCancelModal = () => { setCancelModal(null); setCancelError(''); setCancelling(false); };

  const handleConfirmCancel = async () => {
    if (!cancelModal?.request) return;
    setCancelling(true);
    setCancelError('');
    try {
      await cancelRequest(cancelModal.request.id);
      closeCancelModal();
      loadData();
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel request.');
      setCancelling(false);
    }
  };

  // ── Expand / collapse ────────────────────────────────────────────────────────

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setExpandedSection('details');
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const tabCfg = STATUS_TABS.find((t) => t.key === activeTab) || STATUS_TABS[0];

  const canCancel = (status) => {
    const s = status?.toLowerCase();
    return s === 'pending' || s === 'approved' || s === 'awaitingpayment';
  };

  return (
    <>
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <header className="page-header">
        <h1 className="page-title">My Requests</h1>
      </header>

      {/* ── Status Tabs ──────────────────────────────────────────────────────── */}
      <div className="mr-tabs-bar">
        {STATUS_TABS.map((tab) => {
          const count = requests.filter((r) => getTabKey(r.status) === tab.key).length;
          return (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              className={`mr-tab ${activeTab === tab.key ? 'active' : ''}`}
              style={activeTab === tab.key ? { '--tab-color': tab.color } : {}}
              onClick={() => { setActiveTab(tab.key); setExpandedId(null); setSearchId(''); }}
            >
              {tab.label}
              {count > 0 && <span className="mr-tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Search Highlight Banner ───────────────────────────────────────────── */}
      {searchId && (
        <div className="mr-search-banner">
          <span>📌 Showing: <strong>{searchId}</strong></span>
          <button onClick={() => setSearchId('')}>Clear</button>
        </div>
      )}

      {/* ── Request Cards ─────────────────────────────────────────────────────── */}
      <div className="requests-wrapper" id="requestsWrapper">
        {loading && <div className="empty-state">Loading requests…</div>}
        {error   && <div className="empty-state">{error}</div>}

        {!loading && filteredRequests.length === 0 && (
          <div className="empty-state" id="emptyState">
            <div className="mr-empty-icon">{
              activeTab === 'pending'   ? '⏳' :
              activeTab === 'approved'  ? '✅' :
              activeTab === 'upcoming'  ? '📅' :
              activeTab === 'completed' ? '🎉' :
              activeTab === 'denied'    ? '❌' : '🚫'
            }</div>
            <div>No {tabCfg.label.toLowerCase()} requests.</div>
          </div>
        )}

        {filteredRequests.map((req) => {
          const isHighlighted = searchId && req.id === searchId;
          const isExpanded    = expandedId === req.id;
          const days          = getTabKey(req.status) === 'upcoming' ? daysUntil(req.event?.date) : null;

          return (
            <div
              key={req.id}
              ref={isHighlighted ? highlightRef : null}
              className={`request-card tab-${getTabKey(req.status)} ${isHighlighted ? 'highlighted' : ''} ${isExpanded ? 'expanded' : ''}`}
            >
              {/* ── Card Header ── */}
              <div
                className="request-card-header"
                onClick={() => toggleExpand(req.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="mr-card-left">
                  <span
                    className="request-status"
                    style={{ '--status-color': tabCfg.color }}
                  >
                    {statusBadgeText(req.status)}
                  </span>
                  <div className="request-title">{req.event?.title || 'Untitled Event'}</div>
                  <div className="mr-card-meta">
                    <span>📅 {req.event?.date}</span>
                    <span>📍 {req.event?.venue}</span>
                    <span>👥 {req.event?.pax} pax</span>
                    <span>🕐 {req.event?.timeStart} – {req.event?.timeEnd}</span>
                  </div>
                </div>
                <div className="mr-card-right">
                  {days !== null && (
                    <div className={`mr-countdown ${days <= 3 ? 'urgent' : ''}`}>
                      {days === 0 ? 'Today!' : days > 0 ? `${days} day${days > 1 ? 's' : ''} away` : 'Past'}
                    </div>
                  )}
                  <div className="request-id">{req.id}</div>
                  <div className="mr-type-badge">{req.type === 'rent' ? '🔧 Rent' : '📦 Book'}</div>
                  <span className="mr-expand-chevron">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* ── Expanded Body ── */}
              {isExpanded && (
                <div className="request-card-body">
                  {/* Section tabs (for approved/upcoming/completed) */}
                  {(getTabKey(req.status) === 'approved' ||
                    getTabKey(req.status) === 'upcoming' ||
                    getTabKey(req.status) === 'completed') && (
                    <div className="mr-section-tabs">
                      <button
                        className={`mr-section-tab ${expandedSection === 'details' ? 'active' : ''}`}
                        onClick={() => setExpandedSection('details')}
                      >Details</button>
                      {req.type !== 'rent' && (
                        <button
                          className={`mr-section-tab ${expandedSection === 'equipment' ? 'active' : ''}`}
                          onClick={() => setExpandedSection('equipment')}
                        >Equipment</button>
                      )}
                      {req.type === 'rent' && (
                        <button
                          className={`mr-section-tab ${expandedSection === 'equipment' ? 'active' : ''}`}
                          onClick={() => setExpandedSection('equipment')}
                        >Rent Items</button>
                      )}
                      <button
                        className={`mr-section-tab ${expandedSection === 'billing' ? 'active' : ''}`}
                        onClick={() => setExpandedSection('billing')}
                      >Billing</button>
                    </div>
                  )}

                  {/* ── PENDING ── */}
                  {getTabKey(req.status) === 'pending' && (
                    <div className="mr-pending-body">
                      <div className="mr-info-grid">
                        <div className="mr-info-row"><strong>Request ID:</strong> {req.id}</div>
                        <div className="mr-info-row"><strong>Type:</strong> {req.type === 'rent' ? 'Equipment Rent' : 'Event Booking'}</div>
                        <div className="mr-info-row"><strong>Submitted:</strong> {req.dateRequested}</div>
                        {req.additional && <div className="mr-info-row"><strong>Notes:</strong> {req.additional}</div>}
                      </div>
                      <div className="mr-pending-status-msg">
                        <span className="mr-pending-pulse" />
                        Your request is under review. The admin will assign a package or approve your equipment shortly.
                      </div>
                      <div className="mr-card-actions">
                        <button className="mr-chat-btn" onClick={() => navigate('/chat')} id={`chat-btn-${req.id}`}>
                          💬 Chat with Admin
                        </button>
                        <button className="mr-cancel-btn" onClick={() => openCancelModal(req)} id={`cancel-btn-${req.id}`}>
                          Cancel Request
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── APPROVED / UPCOMING / COMPLETED ── */}
                  {(getTabKey(req.status) === 'approved' ||
                    getTabKey(req.status) === 'upcoming' ||
                    getTabKey(req.status) === 'completed') && (
                    <>
                      {expandedSection === 'details' && (
                        <div className="mr-info-grid">
                          <div className="mr-info-row"><strong>Request ID:</strong> {req.id}</div>
                          <div className="mr-info-row"><strong>Type:</strong> {req.type === 'rent' ? 'Equipment Rent' : 'Event Booking'}</div>
                          <div className="mr-info-row"><strong>Submitted:</strong> {req.dateRequested}</div>
                          {req.package?.name && <div className="mr-info-row"><strong>Package:</strong> {req.package.name}</div>}
                          {req.additional && <div className="mr-info-row"><strong>Notes:</strong> {req.additional}</div>}
                          {getTabKey(req.status) === 'approved' && (
                            <div className="mr-approved-notice">
                              💳 To confirm your booking, please settle your <strong>downpayment</strong> via GCash or bank transfer and send your receipt through the chat.
                            </div>
                          )}
                          {getTabKey(req.status) === 'upcoming' && (
                            <div className="mr-upcoming-notice">
                              🎉 Your booking is <strong>confirmed!</strong> Your downpayment has been received. See you on event day!
                            </div>
                          )}
                        </div>
                      )}
                      {expandedSection === 'equipment' && (
                        <EquipmentList equipment={req.equipment} type={req.type} />
                      )}
                      {expandedSection === 'billing' && (
                        <BillingBreakdown billing={req.billing} pkg={req.package} />
                      )}
                      <div className="mr-card-actions" style={{ marginTop: '16px' }}>
                        <button className="mr-chat-btn" onClick={() => navigate('/chat')} id={`chat-approved-${req.id}`}>
                          💬 Chat with Admin
                        </button>
                        {canCancel(req.status) && (
                          <button className="mr-cancel-btn" onClick={() => openCancelModal(req)} id={`cancel-approved-${req.id}`}>
                            Cancel Request
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── DENIED ── */}
                  {getTabKey(req.status) === 'denied' && (
                    <div className="mr-denied-body">
                      <div className="mr-info-grid">
                        <div className="mr-info-row"><strong>Request ID:</strong> {req.id}</div>
                        <div className="mr-info-row"><strong>Submitted:</strong> {req.dateRequested}</div>
                      </div>
                      <div className="mr-denial-box">
                        <div className="mr-denial-title">❌ Reason for Denial</div>
                        <div className="mr-denial-reason">
                          {req.denialReason || 'No reason provided. Please contact the admin for more information.'}
                        </div>
                      </div>
                      <div className="mr-card-actions">
                        <button className="mr-chat-btn" onClick={() => navigate('/chat')}>💬 Contact Admin</button>
                        <button className="mr-new-req-btn" onClick={() => navigate('/make-request')}>Submit New Request</button>
                      </div>
                    </div>
                  )}

                  {/* ── CANCELLED ── */}
                  {getTabKey(req.status) === 'cancelled' && (
                    <div className="mr-cancelled-body">
                      <div className="mr-info-grid">
                        <div className="mr-info-row"><strong>Request ID:</strong> {req.id}</div>
                        <div className="mr-info-row"><strong>Submitted:</strong> {req.dateRequested}</div>
                      </div>
                      <div className="mr-cancelled-notice">🚫 This request has been cancelled.</div>
                      <div className="mr-card-actions">
                        <button className="mr-new-req-btn" onClick={() => navigate('/make-request')}>Submit New Request</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Cancel Confirmation Modal ─────────────────────────────────────────── */}
      {cancelModal && (
        <div className="mr-modal-overlay" id="cancelModal">
          <div className="mr-modal">
            <div className="mr-modal-icon">⚠️</div>
            <h2 className="mr-modal-title">Cancel Booking?</h2>
            <p className="mr-modal-desc">
              Are you sure you want to cancel your request for{' '}
              <strong>{cancelModal.request.event?.title}</strong> on{' '}
              <strong>{cancelModal.request.event?.date}</strong>?
              <br />This action cannot be undone.
            </p>
            {cancelError && <div className="mr-modal-error">{cancelError}</div>}
            <div className="mr-modal-actions">
              <button className="mr-modal-back" onClick={closeCancelModal} disabled={cancelling} id="cancelModalBack">
                Go Back
              </button>
              <button className="mr-modal-confirm" onClick={handleConfirmCancel} disabled={cancelling} id="cancelModalConfirm">
                {cancelling ? 'Cancelling…' : 'Yes, Cancel It'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


