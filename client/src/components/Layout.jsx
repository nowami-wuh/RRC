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
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
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
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22Z" fill="currentColor" />
        <path d="M15 12C15 12.5523 15.4477 13 16 13C16.5523 13 17 12.5523 17 12C17 11.4477 16.5523 11 16 11C15.4477 11 15 11.4477 15 12Z" fill="#000000" />
        <path d="M11 12C11 12.5523 11.4477 13 12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12Z" fill="#000000" />
        <path d="M7 12C7 12.5523 7.44772 13 8 13C8.55228 13 9 12.5523 9 12C9 11.4477 8.55228 11 8 11C7.44772 11 7 11.4477 7 12Z" fill="#000000" />
      </svg>
    ),
  },
  {
    path: '/package-rate',
    label: 'Package Rate',
    icon: (
      <svg className="nav-icon" viewBox="0 0 36 36">
        <path d="M14.18,13.8V16h9.45a5.26,5.26,0,0,0,.08-.89,4.72,4.72,0,0,0-.2-1.31Z" />
        <path d="M14.18,19.7h5.19a4.28,4.28,0,0,0,3.5-1.9H14.18Z" />
        <path d="M19.37,10.51H14.18V12h8.37A4.21,4.21,0,0,0,19.37,10.51Z" />
        <path d="M17.67,2a16,16,0,1,0,16,16A16,16,0,0,0,17.67,2Zm10.5,15.8H25.7a6.87,6.87,0,0,1-6.33,4.4H14.18v6.54a1.25,1.25,0,1,1-2.5,0V17.8H8.76a.9.9,0,1,1,0-1.8h2.92V13.8H8.76a.9.9,0,1,1,0-1.8h2.92V9.26A1.25,1.25,0,0,1,12.93,8h6.44a6.84,6.84,0,0,1,6.15,4h2.65a.9.9,0,0,1,0,1.8H26.09a6.91,6.91,0,0,1,.12,1.3,6.8,6.8,0,0,1-.06.9h2a.9.9,0,0,1,0,1.8Z" />
      </svg>
    ),
  },
  {
    path: '/my-account',
    label: 'Account',
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
      <aside className={`sidebar${notifOpen ? ' notifications-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icons">
              <img src="/rrc-logo.jpg" alt="RRC Logo" className="sidebar-logo" />
            </div>
            <h1 className="sidebar-title">
              <span className="title-rrc">RRC</span>
              <span className="title-lights">Lights &amp; Sounds</span>
              <span className="title-booking">BOOKING</span>
            </h1>
          </div>

          {/* Header Actions (Bell on Desktop & Mobile, Logout on Mobile) */}
          <div className="sidebar-header-actions">
            {user && (
              <div className="mr-notif-wrap">
                <button
                  id="notifBellHeader"
                  className={`sidebar-icon-btn mr-notif-bell ${notifOpen ? 'active' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
                  onClick={() => setNotifOpen((v) => !v)}
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <svg className="mr-notif-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="mr-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
                </button>

                {notifOpen && (
                  <div className="mr-notif-panel" id="notifPanelHeader">
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

            {/* Mobile-only logout icon button */}
            <button
              className="logout-btn sidebar-icon-btn mobile-logout-btn"
              title="Logout"
              aria-label="Logout"
              onClick={handleLogout}
            >
              <svg className="logout-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
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
        <div className="sidebar-bottom-actions">
          {/* Desktop Logout Button */}
          <button className="logout-btn desktop-logout-btn" onClick={handleLogout} aria-label="Logout">
            <svg className="logout-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="logout-btn-label">Logout</span>
          </button>
        </div>
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
