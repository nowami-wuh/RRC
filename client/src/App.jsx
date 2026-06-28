import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import LoginSignup from './pages/LoginSignup';
import HomePage from './pages/HomePage';
import MakeRequest from './pages/MakeRequest';
import MyRequests from './pages/MyRequests';
import ChatPage from './pages/ChatPage';
import PackageRate from './pages/PackageRate';
import MyAccount from './pages/MyAccount';
import AboutPage from './pages/AboutPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRequests from './pages/admin/AdminRequests';
import AdminInquiries from './pages/admin/AdminInquiries';
import AdminInventory from './pages/admin/AdminInventory';
import AdminPackages from './pages/admin/AdminPackages';

function RoleGuard({ role, children }) {
  const { user } = useAuth();
  const loginPath = role === 'admin' ? '/admin/login' : '/login';
  const homePath = role === 'admin' ? '/admin' : '/';

  if (!user) {
    return <Navigate to={loginPath} replace />;
  }

  if (user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  }

  return children;
}

function LoginRedirect() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to={location.pathname.startsWith('/admin') ? '/admin/login' : '/login'} replace />;
  }

  return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginSignup />} />
      <Route path="/admin/login" element={<LoginSignup />} />
      <Route path="/" element={<RoleGuard role="customer"><Layout /></RoleGuard>}>
        <Route index element={<HomePage />} />
        <Route path="make-request" element={<MakeRequest />} />
        <Route path="my-requests" element={<MyRequests />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="package-rate" element={<PackageRate />} />
        <Route path="my-account" element={<MyAccount />} />
        <Route path="about" element={<AboutPage />} />
      </Route>
      <Route path="/admin" element={<RoleGuard role="admin"><AdminLayout /></RoleGuard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="inquiries" element={<AdminInquiries />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="packages" element={<AdminPackages />} />
        <Route path="my-account" element={<MyAccount />} />
        <Route path="about" element={<AboutPage />} />
      </Route>
      <Route path="*" element={<LoginRedirect />} />
    </Routes>
  );
}
