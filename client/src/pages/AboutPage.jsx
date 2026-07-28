import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAboutInfo, updateAboutInfo } from '../api/api';
import '../styles/about.css';

export default function AboutPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || (typeof user?.id === 'string' && user.id.startsWith('ADMIN-'));

  const [aboutData, setAboutData] = useState({
    description: 'RRC Professional Lights and Sounds is a service provider that caters to events such as weddings, concerts, corporate occasions, and private gatherings, providing services such as lights and sounds equipment rentals, as well as stage and truss setup, among others.',
    facebook: 'RRC Professional Lights & Sounds',
    email: 'ricson_duenas@yahoo.com',
    phone: '0955-075-4117 / (042)332-1417',
    location: 'Laylay, Boac, Marinduque',
  });

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(aboutData);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchAboutInfo()
      .then((res) => {
        if (res?.about) {
          setAboutData(res.about);
          setFormData(res.about);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleEditToggle = () => {
    setFormData(aboutData);
    setIsEditing((prev) => !prev);
    setMsg({ text: '', type: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateAboutInfo(formData);
      if (res?.about) {
        setAboutData(res.about);
      } else {
        setAboutData(formData);
      }
      setIsEditing(false);
      setMsg({ text: 'About Us information updated successfully!', type: 'success' });
      setTimeout(() => setMsg({ text: '', type: '' }), 4000);
    } catch (err) {
      setMsg({ text: err.message || 'Failed to update About Us information.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="about-page-container">
      {isAdmin && (
        <div className="about-admin-bar">
          <button type="button" className="about-edit-btn" onClick={handleEditToggle}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
            </svg>
            {isEditing ? 'Cancel Editing' : 'Edit Info'}
          </button>
        </div>
      )}

      {msg.text && (
        <div className={`about-toast ${msg.type}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="event-item" style={{ margin: '30px 40px' }}>Loading About Us info...</div>
      ) : isEditing ? (
        <div className="about-content">
          <form className="about-edit-form" onSubmit={handleSave}>
            <h3 className="about-edit-title">Edit About Us Information</h3>

            <div className="edit-field-group">
              <label className="edit-label">Description / Bio</label>
              <textarea
                className="edit-textarea"
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="edit-grid">
              <div className="edit-field-group">
                <label className="edit-label">Facebook Name / Page</label>
                <input
                  type="text"
                  className="edit-input"
                  value={formData.facebook}
                  onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                  required
                />
              </div>

              <div className="edit-field-group">
                <label className="edit-label">Email Address</label>
                <input
                  type="email"
                  className="edit-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="edit-field-group">
                <label className="edit-label">Phone Number(s)</label>
                <input
                  type="text"
                  className="edit-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div className="edit-field-group">
                <label className="edit-label">Location / Address</label>
                <input
                  type="text"
                  className="edit-input"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="edit-form-actions">
              <button type="button" className="edit-btn-cancel" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="edit-btn-save" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="about-content">
          <div className="about-text-card">
            <p className="about-description">
              {aboutData.description}
            </p>
          </div>
          <div className="contact-card">
            <h3 className="contact-title">Contact Us</h3>
            <div className="contact-divider" />
            <div className="contact-list">
              <div className="contact-item">
                <div className="contact-icon facebook">
                  <svg viewBox="0 0 24 24">
                    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.12 8.44 9.88v-6.99H7.9v-2.89h2.54V9.8c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.89h-2.33v6.99C18.34 21.12 22 16.99 22 12z"/>
                  </svg>
                </div>
                <span className="contact-text">{aboutData.facebook}</span>
              </div>
              <div className="contact-item">
                <div className="contact-icon email">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                </div>
                <span className="contact-text">{aboutData.email}</span>
              </div>
              <div className="contact-item">
                <div className="contact-icon phone">
                  <svg viewBox="0 0 24 24">
                    <path d="M6.62 10.79a15.149 15.149 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                </div>
                <span className="contact-text">{aboutData.phone}</span>
              </div>
              <div className="contact-item">
                <div className="contact-icon location">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
                <span className="contact-text">{aboutData.location}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
