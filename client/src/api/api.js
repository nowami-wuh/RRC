const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || body.message || response.statusText || 'Request failed');
    error.status = response.status;
    error.code = body.code;
    error.field = body.field;
    error.details = body;
    throw error;
  }

  return body;
}

export function login(username, password, role = 'customer') {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  });
}

export function signup(username, email, contact, password) {
  return request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, email, contact, password }),
  });
}

export function signupInitiate(username, email, contact, password) {
  return request('/auth/signup-initiate', {
    method: 'POST',
    body: JSON.stringify({ username, email, contact, password }),
  });
}

export function signupVerify(email, code) {
  return request('/auth/signup-verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export function loginWithGoogle(token, username = null, contact = null) {
  return request('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ token, username, contact }),
  });
}


export function checkUsernameAvailability(username) {
  return request(`/auth/username-availability?username=${encodeURIComponent(username)}`);
}

export function fetchEvents() {
  return request('/events');
}

export function fetchRequests(customerId) {
  return request(customerId ? `/requests?customerId=${encodeURIComponent(customerId)}` : '/requests');
}

export function fetchInventory() {
  return request('/requests/inventory');
}

export function createRequest(payload) {
  return request('/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function cancelRequest(requestCode) {
  return request(`/requests/${encodeURIComponent(requestCode)}/cancel`, {
    method: 'PATCH',
  });
}

export function fetchNotifications(customerId) {
  return request(`/requests/notifications?customerId=${encodeURIComponent(customerId)}`);
}

export function markNotificationRead(id) {
  return request(`/requests/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead(customerId) {
  return request('/requests/notifications/read-all', {
    method: 'PATCH',
    body: JSON.stringify({ customerId }),
  });
}


export function fetchPackages() {
  return request('/packages');
}

export function fetchUser(userId) {
  return request(`/user?userId=${encodeURIComponent(userId)}`);
}

export function updateUserProfile(userId, profile) {
  return request('/user/profile', {
    method: 'POST',
    body: JSON.stringify({ userId, ...profile }),
  });
}

export function changeUserPassword(userId, currentPassword, newPassword) {
  return request('/user/password', {
    method: 'POST',
    body: JSON.stringify({ userId, currentPassword: currentPassword || undefined, newPassword }),
  });
}

export function fetchChatMessages(userId) {
  return request(userId ? `/chat/messages?userId=${encodeURIComponent(userId)}` : '/chat/messages');
}

export function markConversationRead(customerId) {
  return request('/admin/inquiries/read', {
    method: 'PATCH',
    body: JSON.stringify({ customerId }),
  });
}

export function deleteConversation(customerId) {
  return request(`/admin/inquiries/${encodeURIComponent(customerId)}`, {
    method: 'DELETE',
  });
}

export function postChatMessage(message) {
  return request('/chat/messages', {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

export function fetchAdminSummary() {
  return request('/admin/summary');
}

export function fetchAdminRequests() {
  return request('/admin/requests');
}

export function updateAdminRequest(requestCode, payload) {
  return request(`/admin/requests/${encodeURIComponent(requestCode)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function updateAdminRequestStatus(requestCode, status) {
  return updateAdminRequest(requestCode, { status });
}

export function fetchAdminInquiries() {
  return request('/admin/inquiries');
}

export function sendAdminInquiryReply(message) {
  return request('/admin/inquiries', {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

export function fetchAdminInventory() {
  return request('/admin/inventory');
}

export function updateAdminInventoryItem(itemCode, payload) {
  return request(`/admin/inventory/${encodeURIComponent(itemCode)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function createAdminInventoryItem(payload) {
  return request('/admin/inventory', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminInventoryItem(itemCode) {
  return request(`/admin/inventory/${encodeURIComponent(itemCode)}`, {
    method: 'DELETE',
  });
}


export function fetchAdminPackages() {
  return request('/admin/packages');
}

export function updateAdminPackage(id, payload) {
  return request(`/admin/packages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminPackage(id) {
  return request(`/admin/packages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function verifyGoogleReset(token) {
  return request('/auth/google-verify-reset', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function resetGooglePassword(token, password) {
  return request('/auth/google-reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export function resetInitiate(email) {
  return request('/auth/reset-initiate', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetVerify(email, code, password) {
  return request('/auth/reset-verify', {
    method: 'POST',
    body: JSON.stringify({ email, code, password }),
  });
}


export function createAdminPackage(payload) {
  return request('/admin/packages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

