CREATE DATABASE IF NOT EXISTS rrc_lights_sounds;
USE rrc_lights_sounds;

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  public_id VARCHAR(40) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50) NOT NULL,
  avatar LONGTEXT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  avatar LONGTEXT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_date DATE NOT NULL UNIQUE,
  events_json LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section VARCHAR(50) NOT NULL,
  name VARCHAR(120) NOT NULL,
  subtitle VARCHAR(120) NOT NULL,
  occasion VARCHAR(255) NOT NULL,
  note TEXT NOT NULL,
  price INT NOT NULL,
  promo INT NOT NULL,
  color VARCHAR(50) NOT NULL,
  groups_json LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(40) NOT NULL UNIQUE,
  customer_public_id VARCHAR(40) NOT NULL,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  event_json LONGTEXT NOT NULL,
  package_json LONGTEXT NULL,
  equipment_json LONGTEXT NULL,
  additional_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_requests_customer (customer_public_id),
  INDEX idx_requests_status (status)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_role VARCHAR(20) NOT NULL,
  sender_name VARCHAR(150) NOT NULL,
  text LONGTEXT NULL,
  image LONGTEXT NULL,
  time_label VARCHAR(40) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(40) NOT NULL UNIQUE,
  category VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  requires_auth TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO events (event_date, events_json) VALUES
('2026-06-06', '[{"time":"10:00AM - 2:00PM","title":"Birthday Celebration"},{"time":"4:00PM - 7:00PM","title":"Wedding Reception"}]'),
('2026-06-15', '[{"time":"11:00AM - 4:00PM","title":"Christmas Party"}]'),
('2026-06-23', '[{"time":"7:00AM - 10:00AM","title":"Birthday Party"},{"time":"11:00AM - 4:00PM","title":"Christmas Party"},{"time":"6:00PM - 10:00PM","title":"Birthday Party"}]');

INSERT IGNORE INTO packages (section, name, subtitle, occasion, note, price, promo, color, groups_json) VALUES
('cosupplier', 'PACKAGE A', 'Basic PA', 'Wedding Ceremony Only', 'For indoor/outdoor with less than 100 pax at uniform venue for program ceremony only. 3 staff + 1 driver.', 4000, 3500, 'blue', '[{"category":"SOUNDS","items":[{"qty":"2 pcs","name":"Main Powered Speaker Single 15 inch"},{"qty":"1 unit","name":"6 channel Analog Audio Mixer"},{"qty":"2 pcs","name":"Wireless Microphones"}]}]');

INSERT IGNORE INTO requests (request_code, customer_public_id, type, status, event_json, package_json, equipment_json, additional_notes) VALUES
('AAA004', 'RRC-000001', 'book', 'awaitingpayment', '{"title":"Birthday Celebration","date":"June 20, 2026","timeStart":"1:00PM","timeEnd":"5:00PM","venue":"Libtangin, Gasan","pax":80}', '{"name":"PACKAGE B"}', '[]', 'Bring extra extension cords.'),
('AAA005', 'RRC-000001', 'book', 'pending', '{"title":"Debut Party","date":"June 28, 2026","timeStart":"5:00PM","timeEnd":"10:00PM","venue":"Aturan, Sta. Cruz","pax":150}', NULL, '[]', NULL),
('AAA003', 'RRC-000001', 'book', 'completed', '{"title":"Wedding Ceremony","date":"January 20, 2026","timeStart":"2:00PM","timeEnd":"7:00PM","venue":"Capayang, Mogpog","pax":100}', '{"name":"PACKAGE A"}', '[]', NULL);

INSERT IGNORE INTO chat_messages (sender_role, sender_name, text, image, time_label) VALUES
('customer', 'Sample User', 'Sample Message', NULL, '11:34 PM'),
('admin', 'RRC Admin', 'Sample Message', NULL, '11:35 PM');

INSERT IGNORE INTO inventory_items (item_code, category, name, stock, requires_auth, notes) VALUES
('INV-001', 'Audio', 'Mixer (Presonus SL32)', 2, 0, NULL),
('INV-002', 'Audio', 'Sub Speaker (VRX Sub Single 18)', 2, 1, NULL),
('INV-003', 'Lights', 'Moving Heads (Phantom Mini Beam230)', 2, 1, NULL),
('INV-004', 'Lights', 'Dimmer (Lumos Parled RGBWAU)', 2, 0, NULL);