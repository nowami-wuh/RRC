import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/admin.css';

const navItems = [
  {
    path: '/admin',
    label: 'Home',
    end: true,
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    path: '/admin/requests',
    label: 'Requests',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
      </svg>
    ),
  },
  {
    path: '/admin/inventory',
    label: 'Inventory',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M20 4.58L12 1 4 4.58v10.84L12 23l8-7.58V4.58zM12 3l6 3.42-6 3.43-6-3.43L12 3zM6 14.28V7.59l5 2.85v6.69l-5-2.85zm12 0l-5 2.85v-6.69l5-2.85v6.69z" />
      </svg>
    ),
  },
  {
    path: '/admin/inquiries',
    label: 'Inquiries',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
      </svg>
    ),
  },
  {
    path: '/admin/packages',
    label: 'Packages',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M20.5 8.94l-8.5-4.5a1 1 0 0 0-.92 0l-8.5 4.5A1 1 0 0 0 3 9.82v4.36a1 1 0 0 0 .53.88l8.5 4.5a1 1 0 0 0 .92 0l8.5-4.5a1 1 0 0 0 .53-.88V9.82a1 1 0 0 0-.53-.88zM12 5.03l6.96 3.69L12 12.4 5.04 8.72 12 5.03zm-6 4.55v-2.2l6 3.18v4.73L6 13.58zm8 6.71v-4.73l6-3.18v2.2l-6 3.71z" />
      </svg>
    ),
  },
  {
    path: '/admin/my-account',
    label: 'My Account',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    ),
  },
  {
    path: '/admin/about',
    label: 'About Us',
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    ),
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isChatPage = location.pathname === '/admin/inquiries';

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icons">
              <img src="/light-icon.png" alt="RRC light icon" className="sidebar-light-icon" />
              <img src="/rrc-logo.jpg" alt="RRC Logo" className="sidebar-logo" />
            </div>
            <h1 className="sidebar-title">
              <span className="title-rrc">RRC</span>
              <span className="title-lights">Lights&Sounds</span>
              <span className="title-booking">BOOKING</span>
            </h1>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </aside>
      <main className={`main-content${isChatPage ? ' chat-layout' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
