import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteAdminRequest, fetchAdminInventory, fetchAdminPackages, fetchAdminRequests, updateAdminRequest } from '../../api/api';
import { formatDisplayDate, formatTime12Hour, timeToMinutes } from '../../utils/dateTime';

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

const defaultMobilizationFees = {
  boac: 1500,
  gasan: 2000,
  mogpog: 2000,
  'sta cruz': 3500,
  buenavista: 3000,
  torrijos: 5000,
};

const inventoryStock = {
  'Main Powered Speaker Single 15 inch': { unit: 'pcs', available: 5 },
  'Sub Powered Speaker': { unit: 'pc', available: 2 },
  'Allen & Heat ZED10fx 6ch Audio Mixer': { unit: 'pc', available: 1, operatorRequired: true },
  'Allen & Heat ZED10fx 6 ch Audio Mixer': { unit: 'pc', available: 1, operatorRequired: true },
  '16ch Digital Audio Mixer': { unit: 'set', available: 1 },
  '16 ch Digital Audio Mixer': { unit: 'set', available: 1 },
  '32ch Digital Audio Mixer': { unit: 'set', available: 1 },
  '32 ch Digital Audio Mixer': { unit: 'set', available: 1 },
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

const createEmptyBookings = () => Object.fromEntries(
  statusTabs.map(({ key }) => [key, []]),
);

const statusLabels = {
  pending: 'PENDING',
  approved: 'AWAITING PAYMENT',
  upcoming: 'UPCOMING',
  completed: 'COMPLETED',
  denied: 'DENIED',
  cancelled: 'CANCELLED',
};

function getStatusCategory(status) {
  const normalizedStatus = String(status || 'pending').toLowerCase();
  return normalizedStatus === 'awaitingpayment' ? 'approved' : normalizedStatus;
}

const statusPositions = { pending: '0%', approved: '16.666%', upcoming: '33.333%', completed: '50%', denied: '66.666%', cancelled: '83.333%' };
const statusIndexes = { pending: 0, approved: 1, upcoming: 2, completed: 3, denied: 4, cancelled: 5 };

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeEquipmentGroups(equipment) {
  if (Array.isArray(equipment)) {
    return equipment.length > 0 ? { RENTAL: cloneData(equipment) } : {};
  }
  return equipment && typeof equipment === 'object' ? cloneData(equipment) : {};
}

function parseDateOnly(value) {
  const text = String(value || '').trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function getBookingDateRange(booking) {
  const start = parseDateOnly(booking?.eventDetails?.startDate || booking?.eventDetails?.date);
  const end = parseDateOnly(booking?.eventDetails?.endDate || booking?.eventDetails?.startDate || booking?.eventDetails?.date);
  return start && end ? { start: start <= end ? start : end, end: start <= end ? end : start } : null;
}

function bookingDatesOverlap(firstBooking, secondBooking) {
  const firstRange = getBookingDateRange(firstBooking);
  const secondRange = getBookingDateRange(secondBooking);
  return Boolean(firstRange && secondRange && firstRange.start <= secondRange.end && secondRange.start <= firstRange.end);
}

function peso(value) {
  return `Php ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getDurationSettings(pricingPackages) {
  const durationItem = pricingPackages.find((item) =>
    String(item.name || '').trim().toLowerCase() === 'booking duration',
  );
  const extensionItem = pricingPackages.find((item) =>
    String(item.name || '').trim().toLowerCase() === 'booking duration extension',
  );
  const baseHoursMatch = String(durationItem?.subtitle || '').match(/[\d.]+/);
  const rateMatch = String(extensionItem?.subtitle || '').replace(/,/g, '').match(/[\d.]+/);
  const graceMatch = String(extensionItem?.subtitle || '').match(/after\s+(\d+(?:\.\d+)?)\s*minutes?/i);
  return {
    baseMinutes: Math.round((Number(baseHoursMatch?.[0]) || 4) * 60),
    baseHours: Number(baseHoursMatch?.[0]) || 4,
    baseFee: Number(durationItem?.price) > 0 ? Number(durationItem.price) : 4000,
    extensionRate: Number(rateMatch?.[0]) || 2500,
    graceMinutes: Number(graceMatch?.[1]) || 30,
  };
}

function getDurationExtension(booking, pricingPackages) {
  if (booking.requestType !== 'booking') return { eventHours: 0, baseFee: 0, hours: 0, fee: 0 };
  const start = timeToMinutes(booking.eventDetails?.timeStart);
  const end = timeToMinutes(booking.eventDetails?.timeEnd);
  if (start === null || end === null) return { eventHours: 0, baseFee: 0, hours: 0, fee: 0 };

  const { baseMinutes, baseFee, extensionRate, graceMinutes } = getDurationSettings(pricingPackages);
  const durationMinutes = (end >= start ? end : end + 24 * 60) - start;
  const excessMinutes = durationMinutes - baseMinutes;
  const hours = excessMinutes > graceMinutes ? Math.ceil((excessMinutes - graceMinutes) / 60) : 0;
  return {
    eventHours: durationMinutes / 60,
    baseFee,
    hours,
    fee: hours * extensionRate,
    rate: extensionRate,
  };
}

function formatEventSchedule(event) {
  const date = event?.date || '';
  const startTime = event?.timeStart || '';
  const endTime = event?.timeEnd || '';
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const isOvernight = startMinutes !== null && endMinutes !== null && endMinutes < startMinutes;
  const formattedStartTime = formatTime12Hour(startTime);
  const formattedEndTime = formatTime12Hour(endTime);

  return {
    date: event?.endDate && event.endDate !== date
      ? `${formatDisplayDate(date)} - ${formatDisplayDate(event.endDate)}`
      : formatDisplayDate(date),
    time: startTime && endTime
      ? `${formattedStartTime} - ${formattedEndTime}${isOvernight ? ' (Next day)' : ''}`
      : formattedStartTime || formattedEndTime || 'All Day',
  };
}

export default function AdminRequests() {
  const navigate = useNavigate();
  const location = useLocation();
  const [bookings, setBookings] = useState(createEmptyBookings);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsLoadError, setRequestsLoadError] = useState('');
  const [pricingPackages, setPricingPackages] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [currentStatus, setCurrentStatus] = useState('pending');
  const statusTabsRef = useRef(null);
  const statusProgressRef = useRef(null);
  const statusTabRefs = useRef({});
  const statusScrollAnimationRef = useRef(null);
  const [sortOption, setSortOption] = useState('newest');
  const [detailState, setDetailState] = useState(null);
  const [cancelingRequestId, setCancelingRequestId] = useState(null);
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
  const longPressTimersRef = useRef(new Map());

  // Populate the page from persisted requests; never expose sample bookings as actionable data.
  useEffect(() => {
    Promise.all([
      fetchAdminRequests(),
      fetchAdminPackages(),
      fetchAdminInventory().catch(() => ({ items: [] })),
    ])
      .then(([data, packageData, inventoryData]) => {
        setPricingPackages(packageData.packages || []);
        setInventoryItems(inventoryData.items || []);
        const apiRequests = data.requests || [];
        const next = createEmptyBookings();
        apiRequests.forEach((req) => {
          const category = getStatusCategory(req.status);
          if (!next[category]) next[category] = [];

          const eventSchedule = formatEventSchedule(req.event);
          const requestId = String(req.id || '').trim();
          const formattedReq = {
            id: requestId,
            event: req.event?.title || 'Event',
            requestDate: req.createdAt ? formatDisplayDate(req.createdAt) : '',
            createdAt: req.createdAt || '',
            customerId: req.customerId || null,  // real public_id — used for chat navigation
            client: {
              username: req.customerName || req.customerId || 'Customer',
              phone: req.customerPhone || '',
              email: req.customerEmail || '',
            },
            eventDetails: {
              name: req.event?.title || 'Event',
              date: eventSchedule.date,
              startDate: req.event?.date || '',
              endDate: req.event?.endDate || req.event?.date || '',
              time: eventSchedule.time,
              timeStart: req.event?.timeStart || '',
              timeEnd: req.event?.timeEnd || '',
              venue: req.event?.venue || '',
              pax: req.event?.pax ?? null,
              deliveryMethod: req.event?.deliveryMethod || 'pickup',
            },
            package: req.package?.name?.replace('PACKAGE ', '') || null,
            equipment: req.equipment || {},
            billing: req.billing || {},
            payment: req.payment || null,
            denialReason: req.denialReason || '',
            addonFee: req.billing?.addonFee || 0,
            mobilizationFee: req.billing?.mobilizationFee || 0,
            promoApplied: false,
            requestType: req.type === 'book' ? 'booking' : 'rent',
            additionalRequirements: req.additional || null,
          };

          next[category].unshift(formattedReq);
        });
        setBookings(next);
      })
      .catch((error) => {
        setRequestsLoadError(error.message || 'Unable to load requests.');
      })
      .finally(() => setRequestsLoading(false));
  }, []);

  // Listen for searchId from location state (navigated from calendar or inquiry)
  useEffect(() => {
    const searchId = String(location.state?.searchId || '').trim();
    if (searchId) {
      for (const statusKey of Object.keys(bookings)) {
        const found = bookings[statusKey].find((b) => String(b.id).trim() === searchId);
        if (found) {
          setCurrentStatus(statusKey);
          openDetail(found.id);
          break;
        }
      }
    }
  }, [location.state?.searchId, bookings]);

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
    const getTimestamp = (value) => {
      const timestamp = new Date(value || '').getTime();
      return Number.isNaN(timestamp) ? 0 : timestamp;
    };
    const getEventTimestamp = (value) => {
      const firstDate = String(value || '').replace(
        /^([A-Za-z]+\s+\d{1,2})\s*[-–]\s*\d{1,2}(,\s*\d{4})$/,
        '$1$2',
      );
      return getTimestamp(firstDate);
    };
    return [...list].sort((a, b) => {
      if (sortOption === 'booking-first' || sortOption === 'rent-first') {
        const preferredType = sortOption === 'rent-first' ? 'rent' : 'booking';
        return (a.requestType === preferredType ? 0 : 1) - (b.requestType === preferredType ? 0 : 1);
      }
      if (sortOption === 'event-oldest' || sortOption === 'event-newest') {
        const difference = getEventTimestamp(a.eventDetails?.date) - getEventTimestamp(b.eventDetails?.date);
        return sortOption === 'event-oldest' ? difference : -difference;
      }
      const difference = getTimestamp(a.createdAt || a.requestDate) - getTimestamp(b.createdAt || b.requestDate);
      return sortOption === 'oldest' ? difference : -difference;
    });
  }, [bookings, currentStatus, sortOption]);

  useEffect(() => {
    const tabs = statusTabsRef.current;
    const tab = statusTabRefs.current[currentStatus];
    const progressTrack = statusProgressRef.current;
    if (!tabs || !tab || !progressTrack) return;

    const maxScrollLeft = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
    const progressRect = progressTrack.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const segmentWidth = progressRect.width / statusTabs.length;
    const visibleCenter = progressRect.left + segmentWidth * (statusIndexes[currentStatus] + 0.5);
    const tabCenter = tabRect.left + tabRect.width / 2;
    const centeredScrollLeft = tabs.scrollLeft + tabCenter - visibleCenter;
    const targetScrollLeft = currentStatus === 'pending'
      ? 0
      : currentStatus === 'cancelled'
        ? maxScrollLeft
        : Math.max(0, Math.min(centeredScrollLeft, maxScrollLeft));

    if (statusScrollAnimationRef.current) {
      cancelAnimationFrame(statusScrollAnimationRef.current);
    }

    const startScrollLeft = tabs.scrollLeft;
    const distance = targetScrollLeft - startScrollLeft;
    const duration = 360;
    const startTime = performance.now();

    const animateScroll = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const easedProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      tabs.scrollLeft = startScrollLeft + distance * easedProgress;

      if (progress < 1) {
        statusScrollAnimationRef.current = requestAnimationFrame(animateScroll);
      } else {
        statusScrollAnimationRef.current = null;
      }
    };

    statusScrollAnimationRef.current = requestAnimationFrame(animateScroll);

    return () => {
      if (statusScrollAnimationRef.current) {
        cancelAnimationFrame(statusScrollAnimationRef.current);
        statusScrollAnimationRef.current = null;
      }
    };
  }, [currentStatus]);

  const setStatus = (status) => {
    setCurrentStatus(status);
    setActiveSection(status === 'pending' ? 'approval' : 'billing');
    setPkgDropdownOpen(false);
  };

  const openDetail = (id) => {
    const result = findBooking(id);
    if (!result) return;
    const booking = result.booking;
    const isRent = booking.requestType === 'rent';
    const hasSavedEquipment = booking.equipment && Object.keys(booking.equipment).length > 0;
    let nextEquipment = {};

    if (isRent) {
      nextEquipment = normalizeEquipmentGroups(booking.equipment);
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

  const moveBooking = async (id, newStatus, extra = {}) => {
    const result = findBooking(id);
    if (!result) return;

    const apiPayload = { status: newStatus };
    if (extra.package !== undefined) apiPayload.package = extra.package;
    if (extra.equipment !== undefined) apiPayload.equipment = extra.equipment;
    if (extra.billing !== undefined) apiPayload.billing = extra.billing;
    if (extra.reason !== undefined) apiPayload.denialReason = extra.reason;
    let persistedStatus = getStatusCategory(newStatus);
    let persistedExtra = extra;
    try {
      const response = await updateAdminRequest(id, apiPayload);
      const persistedRequest = response.request || {};
      persistedStatus = getStatusCategory(persistedRequest.status || newStatus);
      persistedExtra = {
        ...extra,
        ...(persistedRequest.denialReason !== undefined
          ? { denialReason: persistedRequest.denialReason || '' }
          : {}),
      };
    } catch (error) {
      showToastMessage(error.message || `Unable to update booking ${id}.`, true);
      return;
    }

    setBookings((prev) => {
      const next = cloneData(prev);
      for (const statusKey of Object.keys(next)) {
        const idx = next[statusKey].findIndex((booking) => booking.id === id);
        if (idx >= 0) {
          const booking = next[statusKey].splice(idx, 1)[0];
          const updated = { ...booking, status: persistedStatus, ...persistedExtra };
          if (next[persistedStatus]) next[persistedStatus].unshift(updated);
          break;
        }
      }
      return next;
    });

    setDetailState(null);
    setCurrentEquipment({});
    setCurrentStatus(persistedStatus);
    setActiveSection(persistedStatus === 'pending' ? 'approval' : 'billing');
    showToastMessage(`Booking ${id} moved to ${persistedStatus}.`);
  };

  const cancelRequest = async (id) => {
    const result = findBooking(id);
    if (!result || !['approved', 'upcoming'].includes(result.status)) return;

    setCancelingRequestId(id);
    try {
      await updateAdminRequest(id, { status: 'cancelled' });
      setBookings((prev) => {
        const next = cloneData(prev);
        for (const statusKey of Object.keys(next)) {
          const index = next[statusKey].findIndex((booking) => booking.id === id);
          if (index >= 0) {
            const [booking] = next[statusKey].splice(index, 1);
            next.cancelled.unshift(booking);
            break;
          }
        }
        return next;
      });
      setCurrentStatus('cancelled');
      setCurrentEquipment({});
      showToastMessage(`Request ${id} cancelled.`);
    } catch (error) {
      showToastMessage(error.message || `Unable to cancel request ${id}.`, true);
    } finally {
      setCancelingRequestId(null);
    }
  };

  const confirmCancelRequest = (booking) => {
    openConfirm(
      'Cancel Request',
      `Cancel request ${booking.id}? The client will be notified and this request will move to Cancelled.`,
      () => cancelRequest(booking.id),
    );
  };

  const deleteRequest = async (id) => {
    const result = findBooking(id);
    if (!result) return;

    setCancelingRequestId(id);
    try {
      await deleteAdminRequest(id);
      setBookings((prev) => {
        const next = cloneData(prev);
        for (const statusKey of Object.keys(next)) {
          next[statusKey] = next[statusKey].filter((booking) => booking.id !== id);
        }
        return next;
      });
      if (detailState?.bookingId === id) {
        setDetailState(null);
        setCurrentEquipment({});
      }
      showToastMessage(`Request ${id} deleted.`);
    } catch (error) {
      showToastMessage(error.message || `Unable to delete request ${id}.`, true);
    } finally {
      setCancelingRequestId(null);
    }
  };

  const confirmDeleteRequest = (booking) => {
    openConfirm(
      'Delete Request',
      `Delete request ${booking.id}? This permanently removes the request and cannot be undone.`,
      () => deleteRequest(booking.id),
    );
  };

  const startRequestLongPress = (event, booking) => {
    if (event.pointerType === 'mouse' || event.target.closest('button')) return;
    const timer = window.setTimeout(() => {
      longPressTimersRef.current.delete(booking.id);
      confirmDeleteRequest(booking);
    }, 700);
    longPressTimersRef.current.set(booking.id, timer);
  };

  const clearRequestLongPress = (booking) => {
    const timer = longPressTimersRef.current.get(booking.id);
    if (timer) window.clearTimeout(timer);
    longPressTimersRef.current.delete(booking.id);
  };

  const selectPackage = (pkg) => {
    if (!selectedBooking || selectedBooking.status !== 'pending') return;
    const packageItems = getPackageEquipment(pkg);
    const existingExtras = Object.fromEntries(
      Object.entries(currentEquipment)
        .filter(([category]) => !Object.prototype.hasOwnProperty.call(packageItems, category))
        .map(([category, items]) => [category, cloneData(items)]),
    );
    const nextEquipment = { ...packageItems, ...existingExtras };
    updateBooking(selectedBooking.booking.id, (booking) => ({
      ...booking,
      package: pkg,
      equipment: cloneData(nextEquipment),
    }));
    setCurrentEquipment(nextEquipment);
    setPkgDropdownOpen(false);
  };

  const adjustEquipmentQty = (cat, idx, delta) => {
    if (!selectedBooking || selectedBooking.status !== 'pending') return;
    setCurrentEquipment((prev) => {
      const next = cloneData(prev);
      const item = next[cat]?.[idx];
      if (!item) return prev;
      if (isPackageEquipment(cat, item)) return prev;
      if (delta === 1 && getAvailableEquipmentQty(item.name) === 0) return prev;
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
      if (isPackageEquipment(cat, next[cat]?.[idx])) return prev;
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
      setAddEquipError('Please select a configured add-on.');
      return;
    }

    if (!qty || qty < 1) {
      setAddEquipError('Quantity must be at least 1.');
      return;
    }

    const configuredAddon = getAddOnCatalog().find((item) => item.name === name);
    if (!configuredAddon) {
      setAddEquipError('Please select a configured add-on.');
      return;
    }

    const available = getAvailableEquipmentQty(name);
    if (available !== null && qty > available) {
      setAddEquipError(`Only ${available} ${available === 1 ? 'unit is' : 'units are'} available for ${name}.`);
      return;
    }

    const nextEquipment = cloneData(currentEquipment);
    const cat = 'ADD-ONS';
    if (!nextEquipment[cat]) nextEquipment[cat] = [];
    const existing = nextEquipment[cat].find((item) => item.name === name);
    if (existing) {
      existing.qty += qty;
    } else {
      nextEquipment[cat].push({
        name,
        qty,
        unit: 'item',
        price: configuredAddon.price,
        promoPrice: configuredAddon.promo,
      });
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

    const packageGroups = Object.entries(currentEquipment).map(([category, items]) => ({
      category,
      items: cloneData(items),
    }));

    openConfirm(
      'Approve Booking',
      `Approve booking ${selectedBooking.booking.id}? The client will be notified to settle the downpayment, and this will move to Approved (awaiting payment).`,
      () => {
        moveBooking(selectedBooking.booking.id, 'approved', {
          package: {
            name: `PACKAGE ${selectedBooking.booking.package}`,
            groups: packageGroups,
            packageCost: billingBreakdown.equipAmt,
          },
          equipment: cloneData(currentEquipment),
          billing: {
            basePrice: billingBreakdown.equipAmt,
            equipmentAmount: isRentBooking ? billingBreakdown.equipAmt : undefined,
            promoPrice: billingBreakdown.promoPrice,
            addonsTotal: billingBreakdown.addonFee,
            addonFee: billingBreakdown.addonFee,
            mobilization: billingBreakdown.mobFee,
            mobilizationFee: billingBreakdown.mobFee,
            deliveryFee: billingBreakdown.deliveryFee,
            durationExtensionHours: billingBreakdown.durationExtensionHours,
            durationExtensionFee: billingBreakdown.durationExtensionFee,
            durationBaseFee: billingBreakdown.durationBaseFee,
            durationBaseHours: billingBreakdown.durationBaseHours,
            bookingDurationHours: billingBreakdown.bookingDurationHours,
            extensionHours: billingBreakdown.durationExtensionHours,
            extensionFee: billingBreakdown.durationExtensionFee,
            extensionRate: billingBreakdown.durationExtensionHours > 0
              ? billingBreakdown.durationExtensionFee / billingBreakdown.durationExtensionHours
              : 0,
            total: billingBreakdown.total,
            downpaymentAmount: billingBreakdown.total * 0.2,
            promoApplied: Boolean(selectedBooking.booking.promoApplied),
          },
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
    const bookingId = selectedBooking.booking.id;
    const total = Number(selectedBooking.booking.billing?.total || billingBreakdown.total || 0);
    const equipment = cloneData(selectedBooking.booking.equipment || currentEquipment);
    openConfirm(
      'Mark as Paid',
      `Confirm that the downpayment for booking ${bookingId} has been received via chat? This will move the booking to Upcoming.`,
      () => {
        const paidOn = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
        moveBooking(bookingId, 'upcoming', {
          paidOn,
          equipment,
          billing: {
            downpaymentStatus: 'paid',
            downpaymentPaid: true,
            downpayment: total * 0.2,
            downpaymentAmount: total * 0.2,
            downpaymentRecordedAt: new Date().toISOString(),
            paymentMethod: 'chat_receipt',
          },
        });
      }
    );
  };

  const markEventAsPaid = () => {
    if (!selectedBooking || selectedBooking.status !== 'upcoming') return;
    openConfirm(
      'Mark Event Fully Paid',
      `Confirm that the full event amount for booking ${selectedBooking.booking.id} has been paid? This records the remaining balance as paid.`,
      async () => {
        const total = billingBreakdown.total;
        const currentBilling = selectedBooking.booking.billing || {};
        await updateAdminRequest(selectedBooking.booking.id, {
          billing: {
            ...currentBilling,
            total,
            totalPaid: total,
            remainingBalance: 0,
            paymentStatus: 'paid',
            fullyPaid: true,
            fullyPaidAt: new Date().toISOString(),
            finalPaymentMethod: 'cash',
          },
        }).then(() => {
          updateBooking(selectedBooking.booking.id, (booking) => ({
            ...booking,
            billing: {
              ...(booking.billing || {}),
              total,
              totalPaid: total,
              remainingBalance: 0,
              paymentStatus: 'paid',
              fullyPaid: true,
              fullyPaidAt: new Date().toISOString(),
              finalPaymentMethod: 'cash',
            },
          }));
          showToastMessage(`Booking ${selectedBooking.booking.id} is fully paid.`);
        }).catch((error) => {
          showToastMessage(error.message || 'Unable to record full payment.', true);
        });
      },
    );
  };

  const getRentEquipmentAmount = (booking) => {
    const savedAmount = Number(booking.billing?.equipmentAmount ?? booking.billing?.basePrice);
    if (Number.isFinite(savedAmount) && savedAmount > 0) return savedAmount;

    const catalog = getAddOnCatalog();
    return Object.values(currentEquipment).flat().reduce((total, item) => {
      const configuredItem = catalog.find((catalogItem) =>
        String(catalogItem.name).trim().toLowerCase() === String(item.name).trim().toLowerCase(),
      );
      const unitPrice = Number(item.price ?? configuredItem?.price) || 0;
      const promoPrice = Number(item.promoPrice ?? configuredItem?.promo) || 0;
      const selectedPrice = booking.promoApplied && promoPrice > 0 ? promoPrice : unitPrice;
      return total + selectedPrice * (Number(item.qty) || 1);
    }, 0);
  };

  const calcEquipmentAmount = () => {
    if (selectedBooking?.booking.requestType === 'rent') {
      return getRentEquipmentAmount(selectedBooking.booking);
    }
    const packageCode = selectedBooking?.booking.package;
    const configuredPackage = pricingPackages.find((pkg) =>
      String(pkg.name || '').trim().toUpperCase() === `PACKAGE ${packageCode}`,
    );
    return Number(configuredPackage?.price) || packageBaseCost[packageCode] || 0;
  };

  const getPackageEquipment = (pkg) => {
    const configuredPackage = pricingPackages.find((item) =>
      String(item.name || '').trim().toUpperCase() === `PACKAGE ${pkg}`,
    );
    if (!configuredPackage?.groups) return cloneData(packageEquipment[pkg] || {});

    return Object.fromEntries(configuredPackage.groups.map((group) => [
      group.category,
      (group.items || []).map((item) => {
        const parts = String(item.qty || '1 pc').split(' ');
        return { name: item.name, qty: Number(parts[0]) || 1, unit: parts.slice(1).join(' ') || 'pc' };
      }),
    ]));
  };

  const isPackageEquipment = (category, item) => {
    if (selectedBooking?.booking.requestType === 'rent' || !selectedBooking?.booking.package || !item) {
      return false;
    }

    return (getPackageEquipment(selectedBooking.booking.package)[category] || [])
      .some((packageItem) => packageItem.name === item.name);
  };

  const getAddOnCatalog = () => pricingPackages
    .filter((item) => ['equipment', 'effects'].includes(String(item.section || '').toLowerCase()))
    .map((item) => ({
      name: item.name,
      price: Number(item.price) || 0,
      promo: Number(item.promo) || 0,
    }));

  const getInventoryItem = (name) => {
    const normalizedName = String(name || '').trim().toLowerCase();
    const liveItem = inventoryItems.find((item) => String(item.name || '').trim().toLowerCase() === normalizedName);
    if (liveItem) return liveItem;
    return inventoryStock[name] || Object.entries(inventoryStock).find(([inventoryName]) =>
      inventoryName.trim().toLowerCase() === normalizedName,
    )?.[1] || null;
  };

  const getCurrentEquipmentQty = (name) => Object.values(currentEquipment).flat().reduce((total, item) => (
    String(item.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase()
      ? total + (Number(item.qty) || 0)
      : total
  ), 0);

  const getReservedEquipmentQty = (name) => Object.entries(bookings).reduce((total, [status, statusBookings]) => {
    if (['denied', 'cancelled'].includes(String(status).toLowerCase())) return total;

    return total + statusBookings.reduce((statusTotal, booking) => statusTotal + Object.values(booking.equipment || {}).flat().reduce((bookingTotal, item) => (
      String(item.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase()
        ? bookingTotal + (Number(item.qty) || 0)
        : bookingTotal
    ), 0), 0);
  }, 0);

  const getConfirmedEquipmentQtyForDate = (name) => Object.entries(bookings).reduce((total, [status, statusBookings]) => {
    const isConfirmed = ['approved', 'upcoming', 'confirmed', 'paid'].includes(status);
    if (!isConfirmed) return total;

    return total + statusBookings.reduce((statusTotal, booking) => {
      if (booking.id === selectedBooking?.booking.id || !bookingDatesOverlap(booking, selectedBooking?.booking)) {
        return statusTotal;
      }
      return statusTotal + Object.values(booking.equipment || {}).flat().reduce((bookingTotal, item) => (
        String(item.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase()
          ? bookingTotal + (Number(item.qty) || 0)
          : bookingTotal
      ), 0);
    }, 0);
  }, 0);

  const getAvailableEquipmentQty = (name) => {
    const inventoryItem = getInventoryItem(name);
    if (!inventoryItem) return null;
    const stock = Number(inventoryItem.stock ?? inventoryItem.available);
    if (!Number.isFinite(stock)) return null;

    const totalInventory = stock + getReservedEquipmentQty(name);
    const confirmedForDate = getConfirmedEquipmentQtyForDate(name);
    return Math.max(0, totalInventory - confirmedForDate - getCurrentEquipmentQty(name));
  };

  const getAddOnFee = (booking) => {
    const catalog = getAddOnCatalog();
    const selectedAddOns = Object.entries(currentEquipment).flatMap(([category, items]) => items
      .filter((item) => booking.requestType === 'rent'
        ? category === 'ADD-ONS'
        : category === 'ADD-ONS' || catalog.some((addon) =>
          String(addon.name).trim().toLowerCase() === String(item.name).trim().toLowerCase(),
        )));

    const pricedAddOns = selectedAddOns.filter((item) => {
      const configuredAddon = catalog.find((addon) =>
        String(addon.name).trim().toLowerCase() === String(item.name).trim().toLowerCase(),
      );
      return configuredAddon || Number(item.price) > 0 || Number(item.promoPrice) > 0;
    });
    if (pricedAddOns.length === 0) return null;

    return pricedAddOns.reduce((total, item) => {
      const configuredAddon = catalog.find((addon) =>
        String(addon.name).trim().toLowerCase() === String(item.name).trim().toLowerCase(),
      );
      const regularPrice = Number(item.price ?? configuredAddon?.price) || 0;
      const promoPrice = Number(item.promoPrice ?? configuredAddon?.promo) || 0;
      const unitPrice = booking.promoApplied && promoPrice > 0 ? promoPrice : regularPrice;
      return total + unitPrice * (Number(item.qty) || 1);
    }, 0);
  };

  const getMobilizationFee = (booking) => {
    const venue = String(booking.eventDetails?.venue || '').toLowerCase();
    const city = Object.keys(defaultMobilizationFees).find((name) =>
      venue.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').includes(name),
    );
    const configuredMisc = pricingPackages.find((item) => {
      const name = String(item.name || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ');
      return name.startsWith('mobilization fee') && city && name.includes(city);
    });
    if (configuredMisc) return Number(String(configuredMisc.subtitle).replace(/[^0-9.]/g, '')) || 0;
    return city ? defaultMobilizationFees[city] : Number(booking.mobilizationFee) || 0;
  };

  const getDeliveryFee = (booking) => {
    if (booking.requestType !== 'rent' || booking.eventDetails?.deliveryMethod !== 'delivery') return 0;
    return Number(booking.billing?.deliveryFee ?? booking.deliveryFee) || 0;
  };

  const billingBreakdown = (() => {
    if (!selectedBooking) return {
      equipAmt: 0,
      mobFee: 0,
      deliveryFee: 0,
      addonFee: 0,
      durationBaseFee: 0,
      durationBaseHours: 4,
      durationExtensionFee: 0,
      durationExtensionHours: 0,
      bookingDurationHours: 0,
      total: 0,
    };
    const booking = selectedBooking.booking;
    let equipAmt = calcEquipmentAmount();
    const configuredPackage = pricingPackages.find((pkg) =>
      String(pkg.name || '').trim().toUpperCase() === `PACKAGE ${booking.package}`,
    );
    const promoPrice = Number(configuredPackage?.promo) || 0;
    if (booking.promoApplied && promoPrice > 0) equipAmt = promoPrice;
    const mobFee = booking.requestType === 'booking' ? getMobilizationFee(booking) : 0;
    const deliveryFee = getDeliveryFee(booking);
    const selectedAddonFee = getAddOnFee(booking);
    const addonFee = selectedAddonFee === null
      ? Number(booking.billing?.addonsTotal ?? booking.billing?.addonFee ?? booking.addonFee) || 0
      : selectedAddonFee;
    const durationExtension = getDurationExtension(booking, pricingPackages);
    const durationSettings = getDurationSettings(pricingPackages);
    const total = equipAmt + mobFee + deliveryFee + addonFee + durationExtension.baseFee + durationExtension.fee;
    return {
      equipAmt,
      promoPrice,
      mobFee,
      deliveryFee,
      addonFee,
      durationBaseFee: durationExtension.baseFee,
      durationBaseHours: durationSettings.baseHours,
      durationExtensionFee: durationExtension.fee,
      durationExtensionHours: durationExtension.hours,
      bookingDurationHours: durationExtension.eventHours,
      total,
    };
  })();

  const isEditable = selectedBooking?.status === 'pending';
  const isRentBooking = selectedBooking?.booking.requestType === 'rent';
  const categories = Object.keys(currentEquipment);
  const anyOperatorRequired = categories.some((cat) => currentEquipment[cat].some((item) => getInventoryItem(item.name)?.requiresAuth || getInventoryItem(item.name)?.operatorRequired));

  return (
    <section className="requests-admin-page">
      <div className="main-content">
        <div id="listView" style={{ display: selectedBooking ? 'none' : 'block' }}>
          <div className="status-bar">
            <div className={`status-tabs status-${currentStatus}`} ref={statusTabsRef}>
              {statusTabs.map((tab) => (
                <button
                  key={tab.key}
                  ref={(element) => { statusTabRefs.current[tab.key] = element; }}
                  className={`status-tab ${currentStatus === tab.key ? 'active' : ''}`}
                  onClick={() => setStatus(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="progress-track" ref={statusProgressRef}>
              <div className="progress-fill" id="progressFill" style={{ left: statusPositions[currentStatus] }} />
            </div>
          </div>

          <div className="list-area">
            <div className="sort-row">
              <label htmlFor="request-sort">Sort by</label>
              <select
                id="request-sort"
                className="sort-select"
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value)}
              >
                <option value="newest">Newest request</option>
                <option value="oldest">Oldest request</option>
                <option value="event-newest">Latest event date</option>
                <option value="event-oldest">Earliest event date</option>
                <option value="booking-first">Booking requests first</option>
                <option value="rent-first">Rent requests first</option>
              </select>
            </div>
            <div className="booking-list">
              {requestsLoading ? (
                <p className="empty-msg">Loading requests…</p>
              ) : requestsLoadError ? (
                <p className="empty-msg">{requestsLoadError}</p>
              ) : visibleList.length === 0 ? (
                <p className="empty-msg">No bookings in this category.</p>
              ) : (
                visibleList.map((booking) => (
                  <div
                    key={booking.id}
                    className="booking-card"
                    onDoubleClick={(event) => {
                      if (!event.target.closest('button')) confirmDeleteRequest(booking);
                    }}
                    onPointerDown={(event) => startRequestLongPress(event, booking)}
                    onPointerUp={() => clearRequestLongPress(booking)}
                    onPointerCancel={() => clearRequestLongPress(booking)}
                    onPointerLeave={() => clearRequestLongPress(booking)}
                    onContextMenu={(event) => event.preventDefault()}
                  >
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
                      // Use the real customerPublicId (stored on the booking as customerId)
                      // so AdminInquiries can match the existing conversation thread.
                      const customerId = selectedBooking?.booking.customerId;
                      if (client && customerId) {
                        navigate('/admin/inquiries', {
                          state: {
                            selectCustomerId: customerId,
                            selectCustomerName: client.username,
                          },
                        });
                      } else if (client) {
                        // Fallback for legacy/seed data that has no real customerId
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
                  {isRentBooking && (
                    <p>
                      {selectedBooking.booking.eventDetails.deliveryMethod === 'delivery'
                        ? `Delivery: ${selectedBooking.booking.eventDetails.venue || 'Address not provided'}`
                        : 'Fulfillment: Customer pickup'}
                    </p>
                  )}
                  {!isRentBooking && <p>{selectedBooking ? `Venue: ${selectedBooking.booking.eventDetails.venue}` : '—'}</p>}
                  {!isRentBooking && <p>{selectedBooking ? `Pax: ${selectedBooking.booking.eventDetails.pax}` : '—'}</p>}
                  {selectedBooking?.booking.rentDuration && <p>{selectedBooking.booking.rentDuration}</p>}
                  <p id="dRequirements" style={{ display: selectedBooking?.booking.additionalRequirements ? 'block' : 'none' }}>
                    {selectedBooking?.booking.additionalRequirements ? `Additional Requirements: ${selectedBooking.booking.additionalRequirements}` : '—'}
                  </p>
                </div>
              </div>
            </div>

            {(selectedBooking?.status === 'approved'
              || (selectedBooking?.booking.payment?.status === 'submitted' && selectedBooking?.status !== 'upcoming')) && (
              <div className="status-banner awaiting-payment">
                <div className="banner-text">
                  {selectedBooking.booking.payment?.status === 'submitted' ? (
                    <>
                      <strong>Downpayment Receipt Submitted.</strong> The customer sent an invoice for booking <strong>{selectedBooking.booking.id}</strong>. Review it before marking the downpayment as paid.
                      {selectedBooking.booking.payment.receiptImage && (
                        <img className="payment-receipt-link" src={selectedBooking.booking.payment.receiptImage} alt="Customer downpayment invoice" />
                      )}
                    </>
                  ) : (
                    <>
                      <strong>Awaiting Downpayment.</strong> Package and billing have been set. The customer can send an invoice image for review.
                    </>
                  )}
                </div>
                <div className="payment-review-actions">
                  <button
                    className="btn-view-receipt"
                    onClick={() => navigate('/admin/inquiries', {
                      state: {
                        selectCustomerId: String(selectedBooking.booking.customerId || ''),
                        selectMessageId: selectedBooking.booking.payment?.receiptMessageId || null,
                        selectRequestCode: selectedBooking.booking.id,
                        openReceipt: true,
                      },
                    })}
                  >
                    View Receipt
                  </button>
                  {selectedBooking.status === 'approved' && (
                    <button className="btn-mark-paid" onClick={markAsPaid}>Mark Downpayment Paid</button>
                  )}
                </div>
              </div>
            )}

            {selectedBooking?.status === 'upcoming' && (
              <div className="status-banner upcoming-banner">
                <div className="banner-text">
                  <strong>{selectedBooking.booking.billing?.fullyPaid ? 'Fully Paid & Confirmed.' : 'Downpayment Paid & Confirmed.'}</strong>{' '}
                  {selectedBooking.booking.billing?.fullyPaid
                    ? 'The full event amount has been recorded as paid.'
                    : 'This event is scheduled and awaiting its date.'}
                </div>
              </div>
            )}

            {selectedBooking?.status === 'denied' && (
              <div className="status-banner denied-banner">
                <div className="banner-text">
                  <strong>Reason for denial:</strong> <span>{selectedBooking.booking.denialReason || selectedBooking.booking.reason || 'No reason provided.'}</span>
                </div>
              </div>
            )}

            {selectedBooking?.status === 'cancelled' && (
              <div className="status-banner cancelled-banner">
                <div className="banner-text">
                  This booking was cancelled. Chat with the client for more information.
                </div>
                <button
                  className="btn-chat-small"
                  onClick={() => {
                    const customerId = selectedBooking?.booking.customerId;
                    const client = selectedBooking?.booking.client;
                    if (customerId) {
                      navigate('/admin/inquiries', {
                        state: {
                          selectCustomerId: customerId,
                          selectCustomerName: client?.username,
                        },
                      });
                    } else {
                      showToastMessage('No client info to open chat.', true);
                    }
                  }}
                >
                  Chat with Client
                </button>
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
                          {currentEquipment[cat].map((item, idx) => {
                            const packageItem = isPackageEquipment(cat, item);
                            const rowEditable = isEditable && !packageItem;
                            return (
                              <div key={`${cat}-${idx}`} className={`equip-row ${rowEditable ? 'removable' : ''}`}>
                                {rowEditable && (
                                  <button className="equip-remove-x" onClick={() => removeEquipmentItem(cat, idx)} title="Remove">&times;</button>
                                )}
                                <span>{item.name}</span>
                                {rowEditable ? (
                                  <span className="qty-stepper">
                                    <button className="qty-btn" onClick={() => adjustEquipmentQty(cat, idx, -1)}>−</button>
                                    <span className="qty-val">{item.qty}</span>
                                    <button
                                      className="qty-btn"
                                      onClick={() => adjustEquipmentQty(cat, idx, 1)}
                                      disabled={getAvailableEquipmentQty(item.name) === 0}
                                      title={getAvailableEquipmentQty(item.name) === 0 ? 'No more inventory available' : 'Add one'}
                                    >+</button>
                                  </span>
                                ) : (
                                  <span className="equip-qty-static">{item.qty}</span>
                                )}
                                <span className="equip-unit">{item.unit}</span>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="equip-divider" />
                  {isEditable && (
                    <>
                      <button type="button" className="add-equip-btn" onClick={openAddEquipmentModal}>
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
                    {isRentBooking && selectedBooking.status === 'pending' ? (
                      <input
                        type="number"
                        min="0"
                        className="billing-fee-input"
                        value={billingBreakdown.equipAmt}
                        onChange={(event) => {
                          const equipmentAmount = Math.max(0, Number(event.target.value) || 0);
                          updateBooking(selectedBooking.booking.id, (booking) => ({
                            ...booking,
                            billing: {
                              ...(booking.billing || {}),
                              equipmentAmount,
                              basePrice: equipmentAmount,
                            },
                          }));
                        }}
                      />
                    ) : (
                      <span className="billing-val">{peso(billingBreakdown.equipAmt)}</span>
                    )}
                  </div>
                  {(!isRentBooking || selectedBooking.booking.eventDetails.deliveryMethod === 'delivery') && (
                  <div className="billing-row">
                    <span className="billing-label">{isRentBooking ? 'Delivery Fee' : 'Mobilization Fee'}</span>
                    {isRentBooking && selectedBooking.booking.eventDetails.deliveryMethod === 'delivery' && selectedBooking.status === 'pending' ? (
                      <input
                        type="number"
                        min="0"
                        className="billing-fee-input"
                        value={billingBreakdown.deliveryFee}
                        onChange={(event) => {
                          const deliveryFee = Math.max(0, Number(event.target.value) || 0);
                          updateBooking(selectedBooking.booking.id, (booking) => ({
                            ...booking,
                            billing: { ...(booking.billing || {}), deliveryFee },
                          }));
                        }}
                      />
                    ) : (
                      <span className="billing-val">{peso(isRentBooking ? billingBreakdown.deliveryFee : billingBreakdown.mobFee)}</span>
                    )}
                  </div>
                  )}
                  <div className="billing-row">
                    <span className="billing-label">Add-On Fee</span>
                    <span className="billing-val">{peso(billingBreakdown.addonFee)}</span>
                  </div>
                  {!isRentBooking && (
                    <div className="billing-row">
                      <span className="billing-label">
                        Booking Duration (up to {billingBreakdown.durationBaseHours} hours)
                      </span>
                      <span className="billing-val">{peso(billingBreakdown.durationBaseFee)}</span>
                    </div>
                  )}
                  {billingBreakdown.durationExtensionFee > 0 && (
                    <div className="billing-row">
                      <span className="billing-label">
                        Duration Extension ({billingBreakdown.durationExtensionHours} hour{billingBreakdown.durationExtensionHours === 1 ? '' : 's'})
                      </span>
                      <span className="billing-val">{peso(billingBreakdown.durationExtensionFee)}</span>
                    </div>
                  )}
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
                    {selectedBooking.status === 'upcoming' && !selectedBooking.booking.billing?.fullyPaid && (
                      <button className="btn-mark-paid" onClick={markEventAsPaid}>Mark Event Fully Paid</button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedBooking && ['approved', 'upcoming'].includes(selectedBooking.status) && (
              <div className="detail-card-actions">
                <button
                  className="btn-cancel-request"
                  onClick={() => confirmCancelRequest(selectedBooking.booking)}
                  disabled={cancelingRequestId === selectedBooking.booking.id}
                >
                  {cancelingRequestId === selectedBooking.booking.id ? 'Cancelling…' : 'Cancel Request'}
                </button>
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
              <button type="button" className="modal-close" onClick={closeAddEquipmentModal}>&times;</button>
            </div>
            <div className="modal-body">
              <label className="m-label">Equipment</label>
              <select
                className="m-input"
                value={newEquipSelection}
                onChange={(event) => {
                  setNewEquipSelection(event.target.value);
                  setAddEquipError('');
                }}
              >
                <option value="">Select a configured add-on…</option>
                {getAddOnCatalog().map((addon) => {
                  const available = getAvailableEquipmentQty(addon.name);
                  return (
                    <option key={`addon-${addon.name}`} value={addon.name}>
                      {addon.name} - Php {addon.price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      {available !== null ? ` (${available} available)` : ''}
                    </option>
                  );
                })}
              </select>
              <p className="m-hint">
                {newEquipSelection && getAddOnCatalog().some((addon) => addon.name === newEquipSelection)
                  ? `Configured add-on price will be included in the estimated bill.${getAvailableEquipmentQty(newEquipSelection) !== null
                    ? ` ${getAvailableEquipmentQty(newEquipSelection)} available based on inventory.`
                    : ''}`
                  : ''}
              </p>

              <label className="m-label" style={{ marginTop: '14px' }}>Quantity</label>
              <input
                type="number"
                className="m-input"
                min="1"
                max={newEquipSelection && getAvailableEquipmentQty(newEquipSelection) !== null
                  ? getAvailableEquipmentQty(newEquipSelection)
                  : undefined}
                value={newEquipQty}
                onChange={(event) => setNewEquipQty(Number(event.target.value))}
              />

              <p className="m-error">{addEquipError}</p>

              <div className="m-actions">
                <button type="button" className="m-btn-cancel" onClick={closeAddEquipmentModal}>Cancel</button>
                <button type="button" className="m-btn-save" onClick={handleAddEquipment}>Add</button>
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
