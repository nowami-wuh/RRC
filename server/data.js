import bcrypt from 'bcrypt';

const defaultPassword = 'password123';

export const sampleUsers = [
  {
    id: 'RRC-000001',
    username: 'testuser',
    email: 'test@example.com',
    contact: '09171234567',
    passwordHash: bcrypt.hashSync(defaultPassword, 10),
  },
];

export const sampleEvents = {
  '2026-06-06': [
    { time: '10:00AM - 2:00PM', title: 'Birthday Celebration' },
    { time: '4:00PM - 7:00PM', title: 'Wedding Reception' },
  ],
  '2026-06-15': [
    { time: '11:00AM - 4:00PM', title: 'Christmas Party' },
  ],
  '2026-06-23': [
    { time: '7:00AM - 10:00AM', title: 'Birthday Party' },
    { time: '11:00AM - 4:00PM', title: 'Christmas Party' },
    { time: '6:00PM - 10:00PM', title: 'Birthday Party' },
  ],
};

export const sampleRequests = [
  {
    id: 'AAA004',
    type: 'book',
    status: 'awaitingpayment',
    dateRequested: 'June 3, 2026',
    event: { title: 'Birthday Celebration', date: 'June 20, 2026', timeStart: '1:00PM', timeEnd: '5:00PM', venue: 'Libtangin, Gasan', pax: 80 },
    package: { name: 'PACKAGE B' },
  },
  {
    id: 'AAA005',
    type: 'book',
    status: 'pending',
    dateRequested: 'June 5, 2026',
    event: { title: 'Debut Party', date: 'June 28, 2026', timeStart: '5:00PM', timeEnd: '10:00PM', venue: 'Aturan, Sta. Cruz', pax: 150 },
  },
  {
    id: 'AAA003',
    type: 'book',
    status: 'completed',
    dateRequested: 'January 5, 2026',
    event: { title: 'Wedding Ceremony', date: 'January 20, 2026', timeStart: '2:00PM', timeEnd: '7:00PM', venue: 'Capayang, Mogpog', pax: 100 },
    package: { name: 'PACKAGE A' },
  },
];

export const samplePackages = [
  {
    section: 'cosupplier',
    name: 'PACKAGE A',
    subtitle: 'Basic PA',
    occasion: 'Wedding Ceremony Only',
    groups: [
      { category: 'SOUNDS', items: [
        { qty: '2 pcs', name: 'Main Powered Speaker Single 15 inch' },
        { qty: '1 unit', name: '6 channel Analog Audio Mixer' },
        { qty: '2 pcs', name: 'Wireless Microphones' },
      ] },
    ],
    note: 'For indoor/outdoor with less than 100 pax at uniform venue for program ceremony only. 3 staff + 1 driver.',
    price: 4000,
    promo: 3500,
    color: 'blue',
  },
];

export const sampleChatMessages = [
  { type: 'date-separator', date: 'December 16, 2025' },
  { type: 'received', text: 'Sample Message', time: '11:34 PM' },
  { type: 'sent', text: 'Sample Message', time: '11:35 PM' },
  { type: 'date-separator', date: 'December 17, 2025' },
  { type: 'received', text: 'Sample Message', time: '11:35 PM' },
  { type: 'sent', text: 'Sample Message', time: '11:37 PM' },
];

export const appUserProfile = {
  id: 'RRC-000001',
  username: 'Klay',
  phone: '09150514260',
  email: 'moje.carlajoy@marsu.edu.ph',
};
