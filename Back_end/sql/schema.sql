CREATE DATABASE IF NOT EXISTS postosdb;
USE postosdb;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  address VARCHAR(300),
  latitude DOUBLE,
  longitude DOUBLE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  station_id INT NOT NULL,
  fuel_type VARCHAR(50) DEFAULT 'gasolina',
  price DECIMAL(8,3),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

CREATE TABLE pending_prices (
    pending_id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    user_id INT NOT NULL,
    fuel_type ENUM('Gasolina', 'Etanol', 'Diesel', 'GNV') NOT NULL,
    price DECIMAL(5,2) NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE trust_scores (
    user_id INT PRIMARY KEY,
    score DECIMAL(3,2) DEFAULT 1.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE price_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    station_id INT NOT NULL,
    fuel_type ENUM('Gasolina', 'Etanol', 'Diesel', 'GNV') NOT NULL,
    price DECIMAL(5,2) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
);
