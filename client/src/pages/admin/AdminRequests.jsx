import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const initialBookings = {
  pending: [
    {
      id: 'AAA001',
      event: 'Birthday',
      requestDate: 'December 1, 2025',
      client: { username: 'Klay', phone: '09150514260', email: 'moje.carlajoy@marsu.edu.ph' },
      eventDetails: { name: 'Birthday Celebration', date: 'December 6, 2025', time: '10:00AM - 7:00PM', venue: 'Amoingon, Boac', pax: 80 },
      package: null,
      equipment: {},
      addonFee: 0,
      mobilizationFee: 1500,
      promoApplied: false,
      requestType: 'booking',
    },
    {
      id: 'AAA002',
      event: 'Birthday',
      requestDate: 'January 5, 2026',
      client: { username: 'Klay', phone: '09150514260', email: 'moje.carlajoy@marsu.edu.ph' },
      eventDetails: { name: 'Birthday Celebration', date: 'January 10, 2026', time: '11:00AM - 3:00PM', venue: 'Libtangin, Gasan', pax: 100 },
      package: null,
      equipment: {},
      addonFee: 25000,
      mobilizationFee: 2000,
      promoApplied: false,
      requestType: 'booking',
      additionalRequirements: 'Client requested a confetti blaster for the surprise reveal moment, and asked if the LED wall can display a custom slideshow of photos.',
    },
    {
      id: 'AAA003',
      event: 'Outdoor Movie Night',
      requestDate: 'January 8, 2026',
      client: { username: 'Paolo Mendoza', phone: '09231234567', email: 'paolo.mendoza@example.com' },
      eventDetails: { name: 'Outdoor Movie Night', date: 'January 15-17, 2026', time: '9:00AM - 6:00PM', venue: 'Sta. Cruz, Marinduque', pax: 50 },
      package: null,
      equipment: {
        SOUNDS: [
          { name: 'Main Powered Speaker Single 15 inch', qty: 2, unit: 'pcs' },
          { name: 'Wireless Mic', qty: 1, unit: 'pcs' },
        ],
      },
      addonFee: 0,
      mobilizationFee: 0,
      promoApplied: false,
      requestType: 'rent',
      rentDuration: '3 days (Jan 15–17, 2026)',
      additionalRequirements: 'Needs the projector to be weatherproofed since the event is outdoors near the shore.',
    },
  ],
  approved: [
    {
      id: 'AAA004',
      event: 'Concert',
      requestDate: 'September 1, 2025',
      client: { username: 'Mark Reyes', phone: '09181234567', email: 'mark.reyes@example.com' },
      eventDetails: { name: 'Anniversary Concert', date: 'September 12, 2025', time: '6:00AM - 7:00PM', venue: 'Boac Town Plaza', pax: 500 },
      package: 'C',
      equipment: null,
      addonFee: 35000,
      mobilizationFee: 3000,
      promoApplied: true,
      requestType: 'booking',
    },
  ],
  upcoming: [
    {
      id: 'AAA005',
      event: 'Birthday',
      requestDate: 'August 25, 2025',
      client: { username: 'Liza Cruz', phone: '09201234567', email: 'liza.cruz@example.com' },
      eventDetails: { name: 'Debut Celebration', date: 'September 10, 2025', time: '7:00AM - 7:00PM', venue: 'Sta. Cruz, Boac', pax: 150 },
      package: 'B',
      equipment: null,
      addonFee: 5000,
      mobilizationFee: 2000,
      promoApplied: false,
      paidOn: 'August 28, 2025',
      requestType: 'booking',
    },
  ],
  denied: [
    {
      id: 'AAA006',
      event: 'Birthday',
      requestDate: 'August 20, 2025',
      client: { username: 'Joel Santos', phone: '09221234567', email: 'joel.santos@example.com' },
      eventDetails: { name: 'Birthday Party', date: 'September 10, 2025', time: '7:00AM - 7:00PM', venue: 'Mogpog', pax: 60 },
      package: null,
      equipment: {},
      addonFee: 0,
      mobilizationFee: 1500,
      promoApplied: false,
      reason: 'Schedule conflict with another booking.',
      requestType: 'booking',
    },
    {
      id: 'AAA007',
      event: "Valentine's Private Party",
      requestDate: 'February 5, 2026',
      client: { username: 'Trisha Manalo', phone: '09181239876', email: 'trisha.manalo@example.com' },
      eventDetails: { name: "Valentine's Private Party", date: 'February 14, 2026', time: '1:00PM - 9:00PM', venue: 'Boac, Marinduque', pax: 30 },
      package: null,
      equipment: {
        LIGHTS: [
          { name: 'Moving Head Lights', qty: 4, unit: 'pcs' },
          { name: 'Laser Lights', qty: 2, unit: 'pcs' },
        ],
      },
      addonFee: 0,
      mobilizationFee: 0,
      promoApplied: false,
      requestType: 'rent',
      rentDuration: '1 day (Feb 14, 2026)',
      reason: 'Requested items require an authorized operator, which is not included in self-operated rentals. Please coordinate with our team to book a full-service package instead.',
    },
  ],
  cancelled: [
    {
      id: 'AAA008',
      event: 'Concert',
      requestDate: 'December 10, 2025',
      client: { username: 'Ana Reyes', phone: '09171234567', email: 'ana.reyes@example.com' },
      eventDetails: { name: 'New Year Concert', date: 'December 28, 2025', time: '3:00PM - 3:00AM', venue: 'Boac Town Plaza', pax: 400 },
      package: null,
      equipment: null,
      requestType: 'booking',
    },
    {
      id: 'AAA009',
      event: 'Equipment Rental',
      requestDate: 'March 10, 2026',
      client: { username: 'Bea Lopez', phone: '09051239988', email: 'bea.lopez@example.com' },
      eventDetails: { name: 'Family Reunion', date: 'March 20-21, 2026', time: '10:00AM - 4:00PM', venue: 'Gasan, Marinduque', pax: 80 },
      package: null,
      equipment: {
        SOUNDS: [
          { name: 'Main Powered Speaker Single 15 inch', qty: 2, unit: 'pcs' },
          { name: 'Wireless Mic', qty: 1, unit: 'pcs' },
        ],
      },
      addonFee: 0,
      mobilizationFee: 0,
      promoApplied: false,
      requestType: 'rent',
      rentDuration: '2 days (Mar 20–21, 2026)',
    },
  ],
  completed: [
    {
      id: 'AAA010',
      event: 'Wedding',
      requestDate: 'April 20, 2025',
      client: { username: 'Cherry Villanueva', phone: '09261234567', email: 'cherry.villanueva@example.com' },
      eventDetails: { name: 'Villanueva-Santos Wedding Reception', date: 'May 18, 2025', time: '2:00PM - 10:00PM', venue: 'Mogpog Parish Hall', pax: 250 },
      package: 'C',
      equipment: null,
      addonFee: 12000,
      mobilizationFee: 2000,
      promoApplied: true,
      paidOn: 'April 25, 2025',
      requestType: 'booking',
    },
    {
      id: 'AAA011',
      event: 'Equipment Rental',
      requestDate: 'February 25, 2025',
      client: { username: 'Ramon Dizon', phone: '09171112233', email: 'ramon.dizon@example.com' },
      eventDetails: { name: 'School Foundation Day', date: 'March 2-3, 2025', time: '8:00AM - 5:00PM', venue: 'Boac National High School', pax: 300 },
      package: null,
      equipment: {
        LIGHTS: [
          { name: 'Moving Head Lights', qty: 4, unit: 'pcs' },
          { name: 'Laser Lights', qty: 2, unit: 'pcs' },
        ],
      },
      addonFee: 0,
      mobilizationFee: 0,
      promoApplied: false,
      paidOn: 'February 27, 2025',
      requestType: 'rent',
      rentDuration: '2 days (Mar 2–3, 2025)',
    },
  ],
};

const packageEquipment = {
  A: {
    SOUNDS: [
      { name: 'Main Powered Speaker Single 15 inch', qty: 2, unit: 'pcs' },
      { name: 'Allen & Heat ZED10fx 6 ch Audio Mixer', qty: 1, unit: 'pc' },
      { name: 'Wireless Mic', qty: 2, unit: 'pcs' },
    ],
  },
  B: {
    SOUNDS: [
      { name: 'Main Powered Speaker Single 15 inch', qty: 2, unit: 'pcs' },
      { name: 'Sub Powered Speaker', qty: 1, unit: 'pc' },
      { name: '16 ch Digital Audio Mixer', qty: 1, unit: 'set' },
      { name: 'Wireless Mic', qty: 2, unit: 'pcs' },
    ],
    LIGHTS: [
      { name: 'PAR LED Lights', qty: 4, unit: 'pcs' },
      { name: 'Moving Head Lights', qty: 2, unit: 'pcs' },
    ],
  },
  C: {
    SOUNDS: [
      { name: 'Main Powered Speaker Single 15 inch', qty: 4, unit: 'pcs' },
      { name: 'Sub Powered Speaker', qty: 2, unit: 'pcs' },
      { name: '32 ch Digital Audio Mixer', qty: 1, unit: 'set' },
      { name: 'Wireless Mic', qty: 4, unit: 'pcs' },
    ],
    LIGHTS: [
      { name: 'PAR LED Lights', qty: 8, unit: 'pcs' },
      { name: 'Moving Head Lights', qty: 4, unit: 'pcs' },
      { name: 'Laser Lights', qty: 2, unit: 'pcs' },
    ],
  },
  D: {
    SOUNDS: [
      { name: 'Line Array Speaker System', qty: 1, unit: 'set' },
      { name: '32 ch Digital Audio Mixer', qty: 1, unit: 'set' },
      { name: 'Wireless Mic', qty: 6, unit: 'pcs' },
    ],
    LIGHTS: [
      { name: 'PAR LED Lights', qty: 12, unit: 'pcs' },
      { name: 'Moving Head Lights', qty: 6, unit: 'pcs' },
      { name: 'LED Wall 35 panels', qty: 1, unit: 'set' },
    ],
  },
};

const packageBaseCost = { A: 4000, B: 8000, C: 15000, D: 28000 };

const inventoryStock = {
  'Main Powered Speaker Single 15 inch': { unit: 'pcs', available: 5 },
  'Sub Powered Speaker': { unit: 'pc', available: 2 },
  'Allen & Heat ZED10fx 6ch Audio Mixer': { unit: 'pc', available: 1, operatorRequired: true },
  '16ch Digital Audio Mixer': { unit: 'set', available: 1 },
  '32ch Digital Audio Mixer': { unit: 'set', available: 1 },
  'Wireless Mic': { unit: 'pcs', available: 4 },
  'PAR LED Lights': { unit: 'pcs', available: 8 },
  'Moving Head Lights': { unit: 'pcs', available: 4 },
  'Laser Lights': { unit: 'pcs', available: 2 },
  'Lighting Controller': { unit: 'set', available: 1 },
  'LED Wall 35 panels': { unit: 'set', available: 1, operatorRequired: true },
  'Fog Machine': { unit: 'unit', available: 2 },
  'Smoke Machine': { unit: 'unit', available: 1 },
};

const statusTabs = [
  { key: 'pending', label: 'PENDING' },
  { key: 'approved', label: 'APPROVED' },
  { key: 'upcoming', label: 'UPCOMING' },
  { key: 'completed', label: 'COMPLETED' },
  { key: 'denied', label: 'DENIED' },
  { key: 'cancelled', label: 'CANCELLED' },
];

const statusLabels = {
  pending: 'PENDING',
  approved: 'AWAITING PAYMENT',
  upcoming: 'UPCOMING',
  completed: 'COMPLETED',
  denied: 'DENIED',
  cancelled: 'CANCELLED',
};

const statusPositions = { pending: '0%', approved: '16.666%', upcoming: '33.333%', completed: '50%', denied: '66.666%', cancelled: '83.333%' };

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function peso(value) {
  return `Php ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminRequests() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState(initialBookings);
  const [currentStatus, setCurrentStatus] = useState('pending');
  const [sortAsc, setSortAsc] = useState(false);
  const [detailState, setDetailState] = useState(null);
  const [activeSection, setActiveSection] = useState('approval');
  const [pkgDropdownOpen, setPkgDropdownOpen] = useState(false);
  const [currentEquipment, setCurrentEquipment] = useState({});
  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  const [showAddEquipModal, setShowAddEquipModal] = useState(false);
  const [newEquipSelection, setNewEquipSelection] = useState('');
  const [newEquipQty, setNewEquipQty] = useState(1);
  const [addEquipError, setAddEquipError] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', action: null });
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState('');

  const showToastMessage = (message, isError = false) => {
    setToast({ show: true, message, isError });
    window.setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const findBooking = (id) => {
    for (const status of Object.keys(bookings)) {
      const found = bookings[status].find((booking) => booking.id === id);
      if (found) return { booking: found, status };
    }
    return null;
  };

  const selectedBooking = useMemo(() => {
    if (!detailState) return null;
    const result = findBooking(detailState.bookingId);
    return result ? { booking: result.booking, status: result.status } : null;
  }, [bookings, detailState]);

  const visibleList = useMemo(() => {
    const list = bookings[currentStatus] || [];
    return sortAsc ? [...list].reverse() : list;
  }, [bookings, currentStatus, sortAsc]);

  const setStatus = (status) => {
    setCurrentStatus(status);
    setActiveSection(status === 'pending' ? 'approval' : 'billing');
    setPkgDropdownOpen(false);
  };

  const toggleSort = () => {
    setSortAsc((prev) => !prev);
  };

  const openDetail = (id) => {
    const result = findBooking(id);
    if (!result) return;
    const booking = result.booking;
    const isRent = booking.requestType === 'rent';
    const hasSavedEquipment = booking.equipment && Object.keys(booking.equipment).length > 0;
    let nextEquipment = {};

    if (isRent) {
      nextEquipment = cloneData(booking.equipment || {});
    } else if (hasSavedEquipment) {
      nextEquipment = cloneData(booking.equipment);
    } else if (booking.package && packageEquipment[booking.package]) {
      nextEquipment = cloneData(packageEquipment[booking.package]);
    }

    setDetailState({ bookingId: id, status: result.status });
    setCurrentEquipment(nextEquipment);
    setActiveSection(result.status === 'pending' ? 'approval' : 'billing');
    setPkgDropdownOpen(false);
    setRejectReason('');
    setRejectReasonError('');
  };

  const updateBooking = (id, updater) => {
    setBookings((prev) => {
      const next = cloneData(prev);
      for (const statusKey of Object.keys(next)) {
        const idx = next[statusKey].findIndex((booking) => booking.id === id);
        if (idx >= 0) {
          next[statusKey][idx] = updater(next[statusKey][idx], statusKey);
          break;
        }
      }
      return next;
    });
  };

  const moveBooking = (id, newStatus, extra = {}) => {
    const result = findBooking(id);
    if (!result) return;

    setBookings((prev) => {
      const next = cloneData(prev);
      for (const statusKey of Object.keys(next)) {
        const idx = next[statusKey].findIndex((booking) => booking.id === id);
        if (idx >= 0) {
          const booking = next[statusKey].splice(idx, 1)[0];
          const updated = { ...booking, ...extra };
          next[newStatus].unshift(updated);
          break;
        }
      }
      return next;
    });

    setDetailState(null);
    setCurrentEquipment({});
    setCurrentStatus(newStatus);
    setActiveSection(newStatus === 'pending' ? 'approval' : 'billing');
    showToastMessage(`Booking ${id} moved to ${newStatus}.`);
  };

  const selectPackage = (pkg) => {
    if (!selectedBooking || selectedBooking.status !== 'pending') return;
    updateBooking(selectedBooking.booking.id, (booking) => ({ ...booking, package: pkg }));
    setCurrentEquipment(cloneData(packageEquipment[pkg] || {}));
    setPkgDropdownOpen(false);
  };

  const adjustEquipmentQty = (cat, idx, delta) => {
    if (!selectedBooking || selectedBooking.status !== 'pending') return;
    setCurrentEquipment((prev) => {
      const next = cloneData(prev);
      const item = next[cat]?.[idx];
      if (!item) return prev;
      if (delta === 1) item.qty += 1;
      if (delta === -1 && item.qty > 1) item.qty -= 1;
      const updatedEquipment = cloneData(next);
      updateBooking(selectedBooking.booking.id, (booking) => ({ ...booking, equipment: updatedEquipment }));
      return next;
    });
  };

  const removeEquipmentItem = (cat, idx) => {
    if (!selectedBooking || selectedBooking.status !== 'pending') return;
    setCurrentEquipment((prev) => {
      const next = cloneData(prev);
      next[cat].splice(idx, 1);
      if (next[cat].length === 0) delete next[cat];
      const updatedEquipment = cloneData(next);
      updateBooking(selectedBooking.booking.id, (booking) => ({ ...booking, equipment: updatedEquipment }));
      return next;
    });
  };

  const openAddEquipmentModal = () => {
    setNewEquipSelection('');
    setNewEquipQty(1);
    setAddEquipError('');
    setShowAddEquipModal(true);
  };

  const closeAddEquipmentModal = () => {
    setShowAddEquipModal(false);
  };

  const handleAddEquipment = () => {
    if (!selectedBooking || selectedBooking.status !== 'pending') return;

    const name = newEquipSelection;
    const qty = Number(newEquipQty);

    if (!name) {
      setAddEquipError('Please select an equipment item from inventory.');
      return;
    }

    if (!qty || qty < 1) {
      setAddEquipError('Quantity must be at least 1.');
      return;
    }

    const stockItem = inventoryStock[name];
    if (!stockItem || qty > stockItem.available) {
      setAddEquipError(`Only ${stockItem?.available ?? 0} ${stockItem?.unit ?? 'unit'} of "${name}" available in inventory.`);
      return;
    }

    const nextEquipment = cloneData(currentEquipment);
    const cat = 'ADD-ONS';
    if (!nextEquipment[cat]) nextEquipment[cat] = [];
    const existing = nextEquipment[cat].find((item) => item.name === name);
    if (existing) {
      existing.qty += qty;
    } else {
      nextEquipment[cat].push({ name, qty, unit: stockItem.unit });
    }

    setCurrentEquipment(nextEquipment);
    updateBooking(selectedBooking.booking.id, (booking) => ({ ...booking, equipment: cloneData(nextEquipment) }));
    setShowAddEquipModal(false);
    showToastMessage('Equipment added.');
  };

  const togglePromo = () => {
    if (!selectedBooking) return;
    updateBooking(selectedBooking.booking.id, (booking) => ({ ...booking, promoApplied: !booking.promoApplied }));
  };

  const openConfirm = (title, message, action) => {
    setConfirmModal({ open: true, title, message, action });
  };

  const closeConfirm = () => {
    setConfirmModal({ open: false, title: '', message: '', action: null });
  };

  const approveBooking = () => {
    if (!selectedBooking) return;
    const hasEquipment = Object.keys(currentEquipment).length > 0;

    if (!hasEquipment) {
      showToastMessage('Please add at least one equipment item before approving.', true);
      return;
    }

    openConfirm(
      'Approve Booking',
      `Approve booking ${selectedBooking.booking.id}? The client will be notified to settle the downpayment, and this will move to Approved (awaiting payment).`,
      () => {
        moveBooking(selectedBooking.booking.id, 'approved', {
          equipment: cloneData(currentEquipment),
        });
      }
    );
  };

  const rejectBooking = () => {
    setRejectReason('');
    setRejectReasonError('');
    setRejectModalOpen(true);
  };

  const confirmReject = () => {
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectReasonError('Please provide a reason for denial — this is shown to the client.');
      return;
    }
    setRejectModalOpen(false);
    moveBooking(selectedBooking.booking.id, 'denied', { reason, equipment: cloneData(currentEquipment) });
  };

  const markAsPaid = () => {
    if (!selectedBooking) return;
    openConfirm(
      'Mark as Paid',
      `Confirm that the downpayment for booking ${selectedBooking.booking.id} has been received via chat? This will move the booking to Upcoming.`,
      () => {
        const paidOn = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
        moveBooking(selectedBooking.booking.id, 'upcoming', { paidOn, equipment: cloneData(currentEquipment) });
      }
    );
  };

  const calcEquipmentAmount = () => {
    if (selectedBooking?.booking.package && packageBaseCost[selectedBooking.booking.package]) {
      return packageBaseCost[selectedBooking.booking.package];
    }
    return 0;
  };

  const billingBreakdown = (() => {
    if (!selectedBooking) return { equipAmt: 0, mobFee: 0, addonFee: 0, total: 0 };
    const booking = selectedBooking.booking;
    let equipAmt = calcEquipmentAmount();
    if (booking.promoApplied) equipAmt = Math.round(equipAmt * 0.9);
    const mobFee = booking.mobilizationFee || 0;
    const addonFee = booking.addonFee || 0;
    const total = equipAmt + mobFee + addonFee;
    return { equipAmt, mobFee, addonFee, total };
  })();

  const isEditable = selectedBooking?.status === 'pending';
  const isRentBooking = selectedBooking?.booking.requestType === 'rent';
  const categories = Object.keys(currentEquipment);
  const anyOperatorRequired = categories.some((cat) => currentEquipment[cat].some((item) => inventoryStock[item.name]?.operatorRequired));

  return (
    <section className="requests-admin-page">
      <div className="main-content">
        <div id="listView" style={{ display: selectedBooking ? 'none' : 'block' }}>
          <div className="status-bar">
            <div className="status-tabs">
              {statusTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`status-tab ${currentStatus === tab.key ? 'active' : ''}`}
                  onClick={() => setStatus(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="progress-track">
              <div className="progress-fill" id="progressFill" style={{ left: statusPositions[currentStatus] }} />
            </div>
          </div>

          <div className="list-area">
            <div className="sort-row">
              <button className="sort-btn" onClick={toggleSort}>
                <svg className="sort-icon" id="sortIcon" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ transform: sortAsc ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  <path d="M11 4h2v12l4-4 1.41 1.41L12 19.83l-6.41-6.42L7 12l4 4V4z" />
                </svg>
                <span>Sort</span>
              </button>
            </div>
            <div className="booking-list">
              {visibleList.length === 0 ? (
                <p className="empty-msg">No bookings in this category.</p>
              ) : (
                visibleList.map((booking) => (
                  <div key={booking.id} className="booking-card">
                    <div className="bc-top">
                      <div>
                        <span className="bc-id-label">{booking.requestType === 'rent' ? 'REQUEST ID' : 'BOOKING ID'}</span>
                        <span className="bc-id-value">{booking.id}</span>
                        <span className={`type-badge ${booking.requestType === 'rent' ? 'rent' : 'booking'}`}>
                          {booking.requestType === 'rent' ? 'RENT' : 'BOOKING'}
                        </span>
                      </div>
                      <button className="bc-view-link" onClick={() => openDetail(booking.id)}>
                        View Details
                      </button>
                    </div>
                    <div className="bc-cols">
                      <span>EVENT</span>
                      <span>EVENT DATE</span>
                      <span>EVENT TIME</span>
                    </div>
                    <div className="bc-vals">
                      <span>{booking.eventDetails.name}</span>
                      <span>{booking.eventDetails.date}</span>
                      <span>{booking.eventDetails.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div id="detailView" style={{ display: selectedBooking ? 'flex' : 'none' }}>
          <div className="detail-card">
            <div className="detail-meta">
              <div className="meta-row">
                <span className="meta-label">{selectedBooking?.booking.requestType === 'rent' ? 'Request ID' : 'Booking ID'}</span>
                <span className="meta-value bold">{selectedBooking?.booking.id || '—'}</span>
              </div>
              <div className="meta-divider" />
              <div className="meta-row">
                <span className="meta-label">Request Status</span>
                <span className={`status-badge ${selectedBooking && selectedBooking.status !== 'pending' ? selectedBooking.status : ''}`}>
                  {selectedBooking ? statusLabels[selectedBooking.status] || selectedBooking.status.toUpperCase() : 'PENDING'}
                </span>
              </div>
              <div className="meta-divider" />
              <div className="meta-row">
                <span className="meta-label">Date of Request</span>
                <span className="meta-value bold">{selectedBooking?.booking.requestDate || '—'}</span>
              </div>
            </div>

            <div className="details-grid">
              <div className="details-box dashed">
                <h3 className="details-box-title">CLIENT DETAILS</h3>
                <div className="details-box-body">
                  <p>{selectedBooking ? `Username: ${selectedBooking.booking.client.username}` : '—'}</p>
                  <p>{selectedBooking ? `Contact Number: ${selectedBooking.booking.client.phone}` : '—'}</p>
                  <p>{selectedBooking ? `Email: ${selectedBooking.booking.client.email}` : '—'}</p>
                  <button
                    className="chat-btn"
                    onClick={() => {
                      const client = selectedBooking?.booking.client;
                      if (client) {
                        navigate('/admin/inquiries', {
                          state: {
                            selectCustomerId: client.email || client.username,
                            selectCustomerName: client.username,
                          },
                        });
                      } else {
                        showToastMessage('No client details available.', true);
                      }
                    }}
                  >
                    Direct to Chat
                  </button>
                </div>
              </div>
              <div className="details-box dashed">
                <h3 className="details-box-title">
                  EVENT DETAILS <span className={`request-type-tag ${isRentBooking ? 'rent' : ''}`}>{isRentBooking ? 'RENT' : 'BOOKING'}</span>
                </h3>
                <div className="details-box-body">
                  <p>{selectedBooking ? `Event: ${selectedBooking.booking.eventDetails.name}` : '—'}</p>
                  <p>{selectedBooking ? `Date: ${selectedBooking.booking.eventDetails.date}` : '—'}</p>
                  <p>{selectedBooking ? `Time: ${selectedBooking.booking.eventDetails.time}` : '—'}</p>
                  <p>{selectedBooking ? `Venue: ${selectedBooking.booking.eventDetails.venue}` : '—'}</p>
                  <p>{selectedBooking ? `Pax: ${selectedBooking.booking.eventDetails.pax}` : '—'}</p>
                  {selectedBooking?.booking.rentDuration && <p>{selectedBooking.booking.rentDuration}</p>}
                  <p id="dRequirements" style={{ display: selectedBooking?.booking.additionalRequirements ? 'block' : 'none' }}>
                    {selectedBooking?.booking.additionalRequirements ? `Additional Requirements: ${selectedBooking.booking.additionalRequirements}` : '—'}
                  </p>
                </div>
              </div>
            </div>

            {selectedBooking?.status === 'approved' && (
              <div className="status-banner awaiting-payment">
                <div className="banner-text">
                  <strong>Awaiting Downpayment.</strong> Package and billing have been set. Confirm with the client via chat once payment is received.
                </div>
                <button className="btn-mark-paid" onClick={markAsPaid}>Mark as Paid</button>
              </div>
            )}

            {selectedBooking?.status === 'upcoming' && (
              <div className="status-banner upcoming-banner">
                <div className="banner-text">
                  <strong>Paid &amp; Confirmed.</strong> This event is scheduled and awaiting its date.
                </div>
              </div>
            )}

            {selectedBooking?.status === 'denied' && (
              <div className="status-banner denied-banner">
                <div className="banner-text">
                  <strong>Reason for denial:</strong> <span>{selectedBooking.booking.reason || 'No reason provided.'}</span>
                </div>
              </div>
            )}

            {selectedBooking?.status === 'cancelled' && (
              <div className="status-banner cancelled-banner">
                <div className="banner-text">
                  <strong>This booking was cancelled by the client.</strong> No reason was given in-app — chat with the client to find out why.
                </div>
                <button className="btn-chat-small" onClick={() => showToastMessage('Opening chat with client...')}>Chat with Client</button>
              </div>
            )}

            {selectedBooking && ['pending', 'approved', 'upcoming', 'completed'].includes(selectedBooking.status) && (
              <div className="section-tabs">
                <button className={`section-tab ${activeSection === 'approval' ? 'active' : ''}`} onClick={() => setActiveSection('approval')}>
                  Equipment Details
                </button>
                <button className={`section-tab ${activeSection === 'billing' ? 'active' : ''}`} onClick={() => setActiveSection('billing')}>
                  Estimated Bill
                </button>
              </div>
            )}

            {selectedBooking && activeSection === 'approval' && ['pending', 'approved', 'upcoming', 'completed'].includes(selectedBooking.status) && (
              <div className="section-content" id="approvalSection">
                {!isRentBooking && (
                  <div className="pkg-dropdown-wrap">
                    <button className={`pkg-dropdown-btn ${pkgDropdownOpen ? 'open' : ''}`} onClick={() => setPkgDropdownOpen((prev) => !prev)}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" id="pkgArrow"><path d="M8 5v14l11-7z" /></svg>
                      <span>{selectedBooking.booking.package ? `Package ${selectedBooking.booking.package}` : 'Select Package'}</span>
                    </button>
                    <div className={`pkg-dropdown-menu ${pkgDropdownOpen ? 'open' : ''}`}>
                      {['A', 'B', 'C', 'D'].map((pkg) => (
                        <div key={pkg} className={`pkg-option ${selectedBooking.booking.package === pkg ? 'selected' : ''}`} onClick={() => selectPackage(pkg)}>
                          Package {pkg}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="equip-table">
                  <div className="equip-header">
                    <span className="col-name">Equipment Type</span>
                    <span className="col-qty">Quantity</span>
                    <span className="col-unit">Unit</span>
                  </div>
                  <div id="equipRows">
                    {categories.length === 0 ? (
                      <p style={{ padding: '14px 4px', color: '#999', fontSize: '13px', fontStyle: 'italic' }}>No equipment yet. Select a package or add items manually.</p>
                    ) : (
                      categories.map((cat) => (
                        <div key={cat}>
                          <div className="equip-category-label">{cat}</div>
                          <hr className="equip-category-divider" />
                          {currentEquipment[cat].map((item, idx) => (
                            <div key={`${cat}-${idx}`} className={`equip-row ${isEditable ? 'removable' : ''}`}>
                              {isEditable && (
                                <button className="equip-remove-x" onClick={() => removeEquipmentItem(cat, idx)} title="Remove">&times;</button>
                              )}
                              <span>{item.name}</span>
                              {isEditable ? (
                                <span className="qty-stepper">
                                  <button className="qty-btn" onClick={() => adjustEquipmentQty(cat, idx, -1)}>−</button>
                                  <span className="qty-val">{item.qty}</span>
                                  <button className="qty-btn" onClick={() => adjustEquipmentQty(cat, idx, 1)}>+</button>
                                </span>
                              ) : (
                                <span className="equip-qty-static">{item.qty}</span>
                              )}
                              <span className="equip-unit">{item.unit}</span>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="equip-divider" />
                  {isEditable && (
                    <>
                      <button className="add-equip-btn" onClick={openAddEquipmentModal}>
                        <em>Add Equipments</em> <span>+</span>
                      </button>
                      {isRentBooking && anyOperatorRequired && <p className="operator-note">* This item requires an authorized operator. Our team will coordinate with the client.</p>}
                    </>
                  )}
                </div>

                <div className="approval-actions">
                  <button className="btn-next" onClick={() => setActiveSection('billing')}>Next</button>
                </div>
              </div>
            )}

            {selectedBooking && activeSection === 'billing' && ['pending', 'approved', 'upcoming', 'completed'].includes(selectedBooking.status) && (
              <div className="section-content" id="billingSection">
                <div className="billing-table">
                  <div className="billing-row">
                    <span className="billing-label">Equipment Amount</span>
                    <span className="billing-val">{peso(billingBreakdown.equipAmt)}</span>
                  </div>
                  <div className="billing-row">
                    <span className="billing-label">Mobilization Fee</span>
                    <span className="billing-val">{peso(billingBreakdown.mobFee)}</span>
                  </div>
                  <div className="billing-row">
                    <span className="billing-label">Add-On Fee</span>
                    <span className="billing-val">{peso(billingBreakdown.addonFee)}</span>
                  </div>
                  <div className="billing-divider" />
                  <div className="billing-row total-row">
                    <span className="billing-label">Total Amount Due</span>
                    <span className="billing-val">{peso(billingBreakdown.total)}</span>
                  </div>
                </div>
                <div className="billing-actions">
                  {selectedBooking.status === 'pending' && (
                    <button className={`btn-promo ${selectedBooking.booking.promoApplied ? 'applied' : ''}`} onClick={togglePromo}>
                      {selectedBooking.booking.promoApplied ? 'Promo Applied ✓' : 'Apply Promo'}
                    </button>
                  )}
                  <div className="final-btns">
                    {selectedBooking.status === 'pending' && (
                      <>
                        <button className="btn-reject" onClick={rejectBooking}>Reject</button>
                        <button className="btn-approve" onClick={approveBooking}>Approve</button>
                      </>
                    )}
                    {selectedBooking.status === 'approved' && (
                      <button className="btn-mark-paid" onClick={markAsPaid}>Mark as Paid</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button className="back-btn" onClick={() => { setDetailState(null); setCurrentEquipment({}); }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
            Back to Requests
          </button>
        </div>
      </div>

      {showAddEquipModal && (
        <div className="modal-overlay active">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add Equipment</h2>
              <button className="modal-close" onClick={closeAddEquipmentModal}>&times;</button>
            </div>
            <div className="modal-body">
              <label className="m-label">Equipment</label>
              <select className="m-input" value={newEquipSelection} onChange={(event) => setNewEquipSelection(event.target.value)}>
                <option value="">Select from inventory…</option>
                {Object.keys(inventoryStock).sort().map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <p className="m-hint">{newEquipSelection ? `${inventoryStock[newEquipSelection].available} ${inventoryStock[newEquipSelection].unit} available in inventory` : ''}</p>

              <label className="m-label" style={{ marginTop: '14px' }}>Quantity</label>
              <input type="number" className="m-input" min="1" value={newEquipQty} onChange={(event) => setNewEquipQty(Number(event.target.value))} />

              <p className="m-error">{addEquipError}</p>

              <div className="m-actions">
                <button className="m-btn-cancel" onClick={closeAddEquipmentModal}>Cancel</button>
                <button className="m-btn-save" onClick={handleAddEquipment}>Add</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectModalOpen && (
        <div className="modal-overlay active">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Deny Booking</h2>
              <button className="modal-close" onClick={() => setRejectModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="confirm-msg">Deny booking {selectedBooking?.booking.id}? This will notify the client and cannot be undone.</p>
              <label className="m-label" style={{ marginTop: '14px' }}>
                Reason for Denial <span style={{ color: '#999', fontWeight: 400 }}>(shown to client)</span>
              </label>
              <textarea className="m-input m-textarea" rows="3" placeholder="e.g. Requested date is already fully booked." value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
              <p className="m-error">{rejectReasonError}</p>
              <div className="m-actions">
                <button className="m-btn-cancel" onClick={() => setRejectModalOpen(false)}>Cancel</button>
                <button className="m-btn-reject-confirm" onClick={confirmReject}>Deny Booking</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal.open && (
        <div className="modal-overlay active">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{confirmModal.title}</h2>
              <button className="modal-close" onClick={closeConfirm}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="confirm-msg">{confirmModal.message}</p>
              <div className="m-actions" style={{ marginTop: '24px' }}>
                <button className="m-btn-cancel" onClick={closeConfirm}>Cancel</button>
                <button className="m-btn-save" onClick={() => { if (confirmModal.action) confirmModal.action(); closeConfirm(); }}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'is-error' : ''}`}>{toast.message}</div>
    </section>
  );
}
