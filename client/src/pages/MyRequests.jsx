import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchRequests, cancelRequest } from '../api/api';
import '../styles/my-requests.css';

// ── Status Tab Config ───────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'approved',  label: 'Approved' },
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'denied',    label: 'Denied' },
  { key: 'cancelled', label: 'Cancelled' },
];

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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function statusBadgeClass(status) {
  const s = status?.toLowerCase();
  if (s === 'approved' || s === 'awaitingpayment') return 'approved';
  if (s === 'upcoming') return 'upcoming';
  if (s === 'completed') return 'completed';
  if (s === 'denied') return 'denied';
  if (s === 'cancelled') return 'cancelled';
  return 'pending';
}

function statusBadgeText(status) {
  const map = {
    pending: 'PENDING',
    approved: 'APPROVED',
    awaitingpayment: 'APPROVED',
    upcoming: 'UPCOMING',
    completed: 'COMPLETED',
    denied: 'DENIED',
    cancelled: 'CANCELLED',
  };
  return map[status?.toLowerCase()] || (status?.toUpperCase() || 'UNKNOWN');
}

// ── Timeline ────────────────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  { key: 'submitted',   label: 'Request\nSubmitted' },
  { key: 'evaluated',   label: 'Admin\nEvaluation' },
  { key: 'downpayment', label: 'Downpayment' },
  { key: 'upcoming',    label: 'Upcoming' },
  { key: 'completed',   label: 'Completed' },
];

function getTimelineState(status) {
  const s = status?.toLowerCase();
  // returns array of 'done' | 'active' | 'idle' | 'denied-step' | 'cancelled-step' for each step
  if (s === 'pending') {
    return ['done', 'active', 'idle', 'idle', 'idle'];
  }
  if (s === 'approved' || s === 'awaitingpayment') {
    return ['done', 'done', 'active', 'idle', 'idle'];
  }
  if (s === 'upcoming') {
    return ['done', 'done', 'done', 'active', 'idle'];
  }
  if (s === 'completed') {
    return ['done', 'done', 'done', 'done', 'done'];
  }
  if (s === 'denied') {
    return ['done', 'denied-step', 'idle', 'idle', 'idle'];
  }
  if (s === 'cancelled') {
    return ['done', 'cancelled-step', 'idle', 'idle', 'idle'];
  }
  return ['done', 'active', 'idle', 'idle', 'idle'];
}

function Timeline({ status }) {
  const states = getTimelineState(status);
  const checkSvg = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div className="status-timeline">
      {TIMELINE_STEPS.map((step, i) => {
        const state = states[i];
        return (
          <div key={step.key} className={`timeline-step ${state}`}>
            <div className="step-circle">
              {state === 'done' && checkSvg}
              {state === 'denied-step' && '✕'}
              {state === 'cancelled-step' && '—'}
              {state === 'active' && '●'}
            </div>
            <span className="step-label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Equipment / Package Table ────────────────────────────────────────────────────

function PackageSection({ pkg }) {
  if (!pkg) return null;
  // pkg can be { name, groups: [{category, items:[{name,qty,unit}]}], packageCost }
  // OR it might come from DB as a flat object
  const groups = pkg.groups || [];
  const packageName = pkg.name || 'PACKAGE';
  const packageCost = pkg.packageCost ?? pkg.basePrice ?? null;

  return (
    <div className="package-section">
      <div className="package-section-label">Assigned Package</div>
      <div className="package-tag">{packageName}</div>
      <div className="package-table-wrapper">
        <table className="package-table">
          <thead>
            <tr>
              <th>Item Description</th>
              <th>Qty</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {groups.length > 0 ? (
              groups.map((group, gi) => (
                <>
                  <tr key={`g-${gi}`} className="package-group-row">
                    <td colSpan={3}>{group.category}</td>
                  </tr>
                  {(group.items || []).map((item, ii) => (
                    <tr key={`i-${gi}-${ii}`}>
                      <td>{item.name}</td>
                      <td>{item.qty}</td>
                      <td>{item.unit}</td>
                    </tr>
                  ))}
                </>
              ))
            ) : (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: '#aaa', fontStyle: 'italic', padding: '16px' }}>
                  Equipment details will be provided by the admin.
                </td>
              </tr>
            )}
            {packageCost != null && (
              <tr className="package-cost-row">
                <td colSpan={3}>Package Cost: {formatCurrency(packageCost)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RentItemsSection({ equipment }) {
  if (!equipment || equipment.length === 0) return null;

  return (
    <div className="package-section">
      <div className="package-section-label">Requested Equipment</div>
      <div className="rent-table-wrapper">
        <table className="package-table">
          <thead>
            <tr>
              <th>Item Description</th>
              <th>Qty</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((item, i) => (
              <tr key={i}>
                <td>{item.name}</td>
                <td>{item.qty}</td>
                <td>{item.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Billing Section ─────────────────────────────────────────────────────────────

function BillingSection({ billing, pkg }) {
  if (!billing && !pkg) return null;

  const b = billing || {};
  const basePrice    = Number(b.basePrice)    || 0;
  const promoPrice   = Number(b.promoPrice)   || 0;
  const addonsTotal  = Number(b.addonsTotal)  || 0;
  const mobilization = Number(b.mobilization) || 0;
  const extensionHrs = Number(b.extensionHours) || 0;
  const extensionAmt = extensionHrs * 2500;
  const downpayment  = Number(b.downpayment)  || 0;
  const promoApplied = Boolean(b.promoApplied);

  const effectiveBase = promoApplied && promoPrice > 0 ? promoPrice : basePrice;
  const total = effectiveBase + addonsTotal + mobilization + extensionAmt;
  const balance = total - downpayment;

  if (total === 0 && downpayment === 0) {
    return (
      <div className="billing-section">
        <div className="billing-section-label">Billing</div>
        <div className="billing-box">
          <p className="billing-note">* Billing details will be finalized by the admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-section">
      <div className="billing-section-label">Billing Details</div>
      <div className="billing-box">
        {basePrice > 0 && (
          <div className="billing-row">
            <span className="billing-label">
              {pkg?.name || 'Package'} — Base Price
              {promoApplied && promoPrice > 0 && (
                <span className="billing-promo-tag">PROMO</span>
              )}
            </span>
            <span className="billing-value">
              {promoApplied && promoPrice > 0 ? (
                <>
                  <span className="billing-strike">{formatCurrency(basePrice)}</span>
                  {formatCurrency(promoPrice)}
                </>
              ) : formatCurrency(basePrice)}
            </span>
          </div>
        )}
        {addonsTotal > 0 && (
          <div className="billing-row">
            <span className="billing-label">Equipment / Add-ons</span>
            <span className="billing-value">{formatCurrency(addonsTotal)}</span>
          </div>
        )}
        {mobilization > 0 && (
          <div className="billing-row">
            <span className="billing-label">Mobilization Fee</span>
            <span className="billing-value">{formatCurrency(mobilization)}</span>
          </div>
        )}
        {extensionHrs > 0 && (
          <div className="billing-row">
            <span className="billing-label">Extension ({extensionHrs} hr{extensionHrs > 1 ? 's' : ''} × ₱2,500)</span>
            <span className="billing-value">{formatCurrency(extensionAmt)}</span>
          </div>
        )}

        {total > 0 && (
          <div className="billing-row total">
            <span className="billing-label">Total Amount</span>
            <span className="billing-value">{formatCurrency(total)}</span>
          </div>
        )}

        {downpayment > 0 && (
          <>
            <div className="billing-row">
              <span className="billing-label">Downpayment Received</span>
              <span className="billing-value green">{formatCurrency(downpayment)}</span>
            </div>
            <div className="billing-row">
              <span className="billing-label">Remaining Balance</span>
              <span className="billing-value">{formatCurrency(balance)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Request Card ─────────────────────────────────────────────────────────────────

function RequestCard({ req, isExpanded, isHighlighted, onToggle, onCancel, onNavigate }) {
  const tabKey = getTabKey(req.status);
  const ev = req.event || {};
  const days = tabKey === 'upcoming' ? daysUntil(ev.date) : null;
  const canCancel = ['pending', 'approved', 'awaitingpayment'].includes(req.status?.toLowerCase());

  // Determine what sections to show in card body
  const showPackage  = req.type === 'book' && req.package;
  const showRentItems = req.type === 'rent' && req.equipment && req.equipment.length > 0;
  const showBilling  = !!req.billing;

  // Banners
  const isAwaiting = req.status?.toLowerCase() === 'awaitingpayment';
  const isApproved = req.status?.toLowerCase() === 'approved';
  const isDenied   = req.status?.toLowerCase() === 'denied';
  const isPending  = req.status?.toLowerCase() === 'pending';
  const isUpcoming = req.status?.toLowerCase() === 'upcoming';

  return (
    <div
      id={`card-${req.id}`}
      className={`request-card ${isHighlighted ? 'highlighted' : ''} ${isExpanded ? 'expanded' : ''}`}
    >
      {/* ── Top Row ── */}
      <div className="card-top" onClick={onToggle}>
        <div className="card-id-group">
          <span className={`card-type-badge ${req.type || 'book'}`}>
            {req.type === 'rent' ? 'RENT' : 'BOOKING'}
          </span>
          <span className="card-id">
            {req.type === 'rent' ? 'Request' : 'Booking'} ID &nbsp;
            <strong>{req.id}</strong>
          </span>
          <span className="card-date-requested">
            Date of Request: <strong>{req.dateRequested}</strong>
          </span>
        </div>
        <div className="card-right">
          <span className={`status-badge ${statusBadgeClass(req.status)}`}>
            <span className="status-dot" />
            {statusBadgeText(req.status)}
          </span>
          {days !== null && (
            <span className={`mr-countdown ${days <= 3 ? 'urgent' : ''}`}>
              {days === 0 ? 'Today!' : days > 0 ? `${days} day${days > 1 ? 's' : ''} away` : 'Past'}
            </span>
          )}
          <span className="card-chevron">▼</span>
        </div>
      </div>

      {/* ── Collapsible Body ── */}
      {isExpanded && (
        <div className="card-body">
          {/* Timeline */}
          <Timeline status={req.status} />
          <hr className="card-divider" />

          {/* Event Details */}
          <div className="event-details">
            <div className="event-info">
              <span className="event-title-main">{ev.title || 'Untitled Event'}</span>
              <div className="event-meta">
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9H21M7 3V5M17 3V5M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z" stroke="#666" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {ev.date} &nbsp;|&nbsp; {ev.timeStart} – {ev.timeEnd}
                </span>
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#666" />
                  </svg>
                  {ev.venue}
                </span>
              </div>
            </div>
            {ev.pax && (
              <div className="event-pax">
                Pax: <strong>{ev.pax}</strong>
              </div>
            )}
          </div>

          {/* Banners */}
          {isPending && (
            <div className="pending-notice">
              <span className="pending-notice-pulse" />
              Your request is under admin review. You will be notified once it has been evaluated.
            </div>
          )}

          {isAwaiting && (
            <div className="awaiting-banner">
              <span className="awaiting-icon">💳</span>
              <div className="awaiting-text">
                <div className="awaiting-label">Awaiting Downpayment</div>
                <div className="awaiting-msg">
                  Please settle your downpayment via GCash or bank transfer and send your receipt through the chat to confirm your booking.
                </div>
              </div>
            </div>
          )}

          {isApproved && !isAwaiting && (
            <div className="awaiting-banner">
              <span className="awaiting-icon">💳</span>
              <div className="awaiting-text">
                <div className="awaiting-label">Awaiting Downpayment</div>
                <div className="awaiting-msg">
                  Please settle your downpayment via GCash or bank transfer and send your receipt through the chat to confirm your booking.
                </div>
              </div>
            </div>
          )}

          {isUpcoming && (
            <div className="upcoming-banner">
              <span className="upcoming-icon">🎉</span>
              <div className="upcoming-text">
                <div className="upcoming-label">Booking Confirmed!</div>
                <div className="upcoming-msg">
                  Your downpayment has been received. We look forward to seeing you on event day!
                </div>
              </div>
            </div>
          )}

          {isDenied && req.denialReason && (
            <div className="denial-banner">
              <span className="denial-icon">❌</span>
              <div className="denial-text">
                <div className="denial-label">Reason for Denial</div>
                <div className="denial-reason">{req.denialReason}</div>
              </div>
            </div>
          )}

          {/* Additional Requirements */}
          {req.additional && (
            <>
              <hr className="card-divider" style={{ marginTop: '16px' }} />
              <div className="additional-req-section">
                <div className="additional-req-label">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-2 8H7v-2h4v2zm4-4H7v-2h8v2z" />
                  </svg>
                  Additional Requirements
                </div>
                <div className="additional-req-text">{req.additional}</div>
              </div>
            </>
          )}

          {/* Package / Rent Items */}
          {showPackage && (
            <>
              <hr className="card-divider" style={{ marginTop: '16px' }} />
              <PackageSection pkg={req.package} />
            </>
          )}

          {showRentItems && (
            <>
              <hr className="card-divider" style={{ marginTop: '16px' }} />
              <RentItemsSection equipment={req.equipment} />
            </>
          )}

          {/* Billing */}
          {(showBilling || showPackage) && (
            <>
              <hr className="card-divider" />
              <BillingSection billing={req.billing} pkg={req.package} />
            </>
          )}

          {/* Footer Actions */}
          <div className="card-footer">
            <button
              className="action-btn chat-btn"
              onClick={() => onNavigate('/chat')}
              id={`chat-btn-${req.id}`}
            >
              💬 Chat with Admin
            </button>
            {tabKey === 'denied' && (
              <button
                className="action-btn new-req-btn"
                onClick={() => onNavigate('/make-request')}
                id={`new-req-btn-${req.id}`}
              >
                Submit New Request
              </button>
            )}
            {canCancel && (
              <button
                className="action-btn cancel-btn danger"
                onClick={() => onCancel(req)}
                id={`cancel-btn-${req.id}`}
              >
                Cancel Request
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

export default function MyRequests() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [requests,    setRequests]    = useState([]);
  const [activeTab,   setActiveTab]   = useState('all');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [expandedId,  setExpandedId]  = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelling,  setCancelling]  = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [searchId,    setSearchId]    = useState(location.state?.searchId || '');
  const highlightRef = useRef(null);

  // ── Data Loading ─────────────────────────────────────────────────────────────

  const loadData = useCallback(() => {
    if (!user?.id) { setLoading(false); setError('Please sign in to view your requests.'); return; }
    setLoading(true);
    fetchRequests(user.id)
      .then((data) => { setRequests(data.requests || []); })
      .catch(() => setError('Unable to load requests.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (location.state?.searchId) {
      setSearchId(location.state.searchId);
      setActiveTab('all');
    }
  }, [location.state?.searchId]);

  useEffect(() => {
    if (searchId && requests.length > 0) {
      const found = requests.find((r) => r.id.toLowerCase() === searchId.toLowerCase());
      if (found) {
        setActiveTab('all');
        setExpandedId(found.id);
      }
    }
  }, [searchId, requests]);

  useEffect(() => {
    if (searchId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchId, expandedId]);

  // ── Filtering ────────────────────────────────────────────────────────────────

  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'all') return true;
    return getTabKey(r.status) === activeTab;
  });

  const countFor = (key) => {
    if (key === 'all') return requests.length;
    return requests.filter((r) => getTabKey(r.status) === key).length;
  };

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

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Filter Tabs ── */}
      <div className="mr-tabs-bar" id="filterTabs">
        {STATUS_TABS.map((tab) => {
          const count = countFor(tab.key);
          return (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              className={`mr-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.key); setExpandedId(null); setSearchId(''); }}
            >
              {tab.label}
              {count > 0 && <span className="mr-tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Search Highlight Banner ── */}
      {searchId && (
        <div className="mr-search-banner">
          <span>📌 Showing: <strong>{searchId}</strong></span>
          <button onClick={() => setSearchId('')}>Clear</button>
        </div>
      )}

      {/* ── Cards ── */}
      <div className="requests-wrapper" id="requestsWrapper">
        {loading && (
          <div className="empty-state">
            <div className="mr-empty-icon">⏳</div>
            <div>Loading your requests…</div>
          </div>
        )}
        {error && (
          <div className="empty-state">
            <div className="mr-empty-icon">⚠️</div>
            <div>{error}</div>
          </div>
        )}

        {!loading && !error && filteredRequests.length === 0 && (
          <div className="empty-state" id="emptyState">
            <div className="mr-empty-icon">
              {activeTab === 'pending'   ? '⏳' :
               activeTab === 'approved'  ? '✅' :
               activeTab === 'upcoming'  ? '📅' :
               activeTab === 'completed' ? '🎉' :
               activeTab === 'denied'    ? '❌' :
               activeTab === 'cancelled' ? '🚫' : '📋'}
            </div>
            <div>
              {activeTab === 'all' ? 'No requests yet.' : `No ${activeTab} requests.`}
            </div>
          </div>
        )}

        {!loading && !error && filteredRequests.map((req) => {
          const isHighlighted = searchId && req.id === searchId;
          const isExpanded    = expandedId === req.id;
          return (
            <div
              key={req.id}
              ref={isHighlighted ? highlightRef : null}
            >
              <RequestCard
                req={req}
                isExpanded={isExpanded}
                isHighlighted={isHighlighted}
                onToggle={() => toggleExpand(req.id)}
                onCancel={openCancelModal}
                onNavigate={navigate}
              />
            </div>
          );
        })}
      </div>

      {/* ── Cancel Confirmation Modal ── */}
      {cancelModal && (
        <div className="mr-modal-overlay" id="cancelModal">
          <div className="mr-modal">
            <div className="mr-modal-icon">⚠️</div>
            <h2 className="mr-modal-title">Cancel this booking?</h2>
            <p className="mr-modal-desc">
              Are you sure you want to cancel your request for{' '}
              <strong>{cancelModal.request.event?.title}</strong>?
              <br />
              This action cannot be undone. The admin will be notified.
            </p>
            {cancelError && <div className="mr-modal-error">{cancelError}</div>}
            <div className="mr-modal-actions">
              <button
                className="mr-modal-back"
                onClick={closeCancelModal}
                disabled={cancelling}
                id="cancelModalBack"
              >
                Keep Booking
              </button>
              <button
                className="mr-modal-confirm"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                id="cancelModalConfirm"
              >
                {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
