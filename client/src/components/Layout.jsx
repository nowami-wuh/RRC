import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../api/api';

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


const navItems = [
  {
    path: '/',
    label: 'Home',
    end: true,
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    path: '/make-request',
    label: 'Make Request',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" />
      </svg>
    ),
  },
  {
    path: '/my-requests',
    label: 'My Requests',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
      </svg>
    ),
  },
  {
    path: '/chat',
    label: 'Chat',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
      </svg>
    ),
  },
  {
    path: '/package-rate',
    label: 'Package Rate',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M20 4.58L12 1 4 4.58v10.84L12 23l8-7.58V4.58zM12 3l6 3.42-6 3.43-6-3.43L12 3zM6 14.28V7.59l5 2.85v6.69l-5-2.85zm12 0l-5 2.85v-6.69l5-2.85v6.69z" />
      </svg>
    ),
  },
  {
    path: '/my-account',
    label: 'My Account',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    ),
  },
  {
    path: '/about',
    label: 'About Us',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    ),
  },
];

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const loadNotifications = () => {
    if (!user?.id) return;
    fetchNotifications(user.id)
      .then((data) => setNotifications(data.notifications || []))
      .catch((err) => console.error('Failed to load notifications:', err));
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000); // refresh every 10 seconds
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNotificationClick = async (n) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(n.id);
        setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, isRead: true } : item));
      } catch (_) {}
    }
    setNotifOpen(false);
    navigate('/my-requests', { state: { searchId: n.requestCode } });
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (_) {}
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/rrc-logo.jpg" alt="RRC Logo" className="sidebar-logo" />
          <h1 className="sidebar-title">
            <span className="title-rrc">RRC</span>
            <span className="title-lights">Lights&Sounds</span>
            <span className="title-booking">BOOKING</span>
          </h1>

          {/* Global Notification Bell */}
          {user && (
            <div className="mr-notif-wrap">
              <button
                id="notifBell"
                className={`mr-notif-bell ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => setNotifOpen((v) => !v)}
                title="Notifications"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="mr-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="mr-notif-panel" id="notifPanel">
                  <div className="mr-notif-panel-header">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <button className="mr-notif-mark-all" onClick={handleMarkAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="mr-notif-list">
                    {notifications.length === 0 ? (
                      <div className="mr-notif-empty">No notifications yet.</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`mr-notif-item ${n.isRead ? 'read' : 'unread'}`}
                          onClick={() => handleNotificationClick(n)}
                        >
                          <div className="mr-notif-msg">{n.message}</div>
                          <div className="mr-notif-time">{timeAgo(n.createdAt)}</div>
                          {!n.isRead && <span className="mr-notif-dot" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              end={item.end}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>

      {/* Click-outside backdrop */}
      {notifOpen && (
        <div
          className="mr-notif-backdrop"
          onClick={() => setNotifOpen(false)}
        />
      )}
    </div>
  );
}
