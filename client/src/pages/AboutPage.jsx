import '../styles/about.css';

export default function AboutPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">About Us</h1>
      </header>
      <div className="brand-banner">
        <div className="brand-logo-area">
          <div className="brand-icons">
            <img src="/light-icon.png" alt="Lights Icon" className="light-icon" />
            <img src="/rrc-logo.jpg" alt="RRC Logo" className="rrc-logo" />
          </div>
          <div className="brand-name-block">
            <div className="brand-name-rrc">RRC</div>
            <div className="brand-name-ls">Lights & Sounds</div>
            <div className="brand-badge">BOOKING</div>
          </div>
        </div>
        <div className="brand-cta">
          <div className="cta-item">Book, Schedule, Inquire</div>
        </div>
      </div>
      <div className="about-content">
        <div className="about-text-card">
          <p className="about-description">
            <b>RRC Professional Lights and Sounds</b> is a service provider that caters to events such as weddings, concerts, corporate occasions, and private gatherings, providing services such as lights and sounds equipment rentals, as well as stage and truss setup, among others.
          </p>
        </div>
        <div className="contact-card">
          <h3 className="contact-title">Contact Us</h3>
          <div className="contact-divider" />
          <div className="contact-list">
            <div className="contact-item"><div className="contact-icon facebook" /><span className="contact-text">RRC Professional Lights & Sounds</span></div>
            <div className="contact-item"><div className="contact-icon email" /><span className="contact-text">ricson_duenas@yahoo.com</span></div>
            <div className="contact-item"><div className="contact-icon phone" /><span className="contact-text">0955-075-4117 / (042)332-1417</span></div>
            <div className="contact-item"><div className="contact-icon location" /><span className="contact-text">Laylay, Boac, Marinduque</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
