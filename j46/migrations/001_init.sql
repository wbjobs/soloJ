CREATE DATABASE IF NOT EXISTS sqlilab;
USE sqlilab;

DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(50) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category_id INT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

INSERT INTO users (username, password, role) VALUES 
('admin', 'admin123', 'admin'),
('user1', 'pass123', 'user'),
('test', 'test123', 'user');

INSERT INTO categories (name) VALUES 
('电子产品'),
('图书'),
('服装'),
('食品');

INSERT INTO products (name, price, category_id, description) VALUES 
('iPhone 15', 6999.00, 1, '最新款智能手机'),
('MacBook Pro', 12999.00, 1, '高性能笔记本电脑'),
('Web安全深度剖析', 89.00, 2, '网络安全学习书籍'),
('SQL注入攻击与防御', 68.00, 2, 'SQL注入技术详解'),
('黑客T恤', 99.00, 3, '极客风格T恤'),
('能量饮料', 8.00, 4, '提神醒脑饮品');
