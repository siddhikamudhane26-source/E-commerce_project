-- Intelligent Commerce PostgreSQL reference
-- Runtime source of truth: lib/db/src/schema/commerce.ts
-- Run this file only against a fresh database or adapt the IF NOT EXISTS
-- clauses to an existing schema. Drizzle remains the application migration
-- source; this file is the college-project SQL reference and demo script.

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  gender VARCHAR(30),
  age INTEGER CHECK (age IS NULL OR age BETWEEN 13 AND 120),
  city VARCHAR(100),
  segment VARCHAR(40) NOT NULL DEFAULT 'New',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  compare_at_price NUMERIC(10, 2),
  image_url TEXT NOT NULL,
  rating NUMERIC(3, 2) NOT NULL DEFAULT 4.5 CHECK (rating BETWEEN 0 AND 5),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  tags TEXT[] NOT NULL DEFAULT '{}',
  badge VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'processing',
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL DEFAULT 'demo',
  status VARCHAR(30) NOT NULL DEFAULT 'paid',
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS customer_activity (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('view', 'like', 'purchase', 'cart', 'search')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  score NUMERIC(6, 3) NOT NULL CHECK (score BETWEEN 0 AND 1),
  reason VARCHAR(180) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlist (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON order_items(product_id);
CREATE INDEX IF NOT EXISTS customer_activity_customer_idx ON customer_activity(customer_id, occurred_at);
CREATE INDEX IF NOT EXISTS customer_activity_product_idx ON customer_activity(product_id, type);

-- Small SQL demonstration fixture. The runtime seed in commerce.ts provides
-- the full 40-product catalog and richer preview data.
INSERT INTO categories (name, slug)
VALUES ('Electronics', 'electronics'), ('Books', 'books')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO customers (name, email, gender, age, city, segment)
VALUES ('Maya Chen', 'maya.chen@example.com', 'Female', 24, 'Bengaluru', 'High value')
ON CONFLICT (email) DO NOTHING;

-- SELECT / WHERE / ORDER BY
SELECT id, name, price
FROM products
WHERE price BETWEEN 20 AND 100
ORDER BY price ASC;

-- INNER JOIN: product catalog with categories
SELECT p.name, c.name AS category, p.price
FROM products AS p
INNER JOIN categories AS c ON c.id = p.category_id
ORDER BY c.name, p.name;

-- LEFT JOIN: include categories with no products
SELECT c.name AS category, COUNT(p.id) AS product_count
FROM categories AS c
LEFT JOIN products AS p ON p.category_id = c.id
GROUP BY c.id, c.name
ORDER BY product_count DESC;

-- Aggregate functions / GROUP BY / HAVING: category revenue
SELECT c.name AS category,
       SUM(oi.quantity * oi.unit_price) AS revenue,
       SUM(oi.quantity) AS units_sold
FROM order_items AS oi
INNER JOIN products AS p ON p.id = oi.product_id
INNER JOIN categories AS c ON c.id = p.category_id
GROUP BY c.id, c.name
HAVING SUM(oi.quantity * oi.unit_price) > 0
ORDER BY revenue DESC;

-- Top-selling products
SELECT p.name, SUM(oi.quantity) AS units_sold
FROM order_items AS oi
INNER JOIN products AS p ON p.id = oi.product_id
GROUP BY p.id, p.name
ORDER BY units_sold DESC
LIMIT 10;

-- Highest-spending customers and a subquery against average order value
SELECT c.name, c.email, SUM(o.total) AS lifetime_value
FROM customers AS c
INNER JOIN orders AS o ON o.customer_id = c.id
GROUP BY c.id, c.name, c.email
HAVING SUM(o.total) > (SELECT COALESCE(AVG(total), 0) FROM orders)
ORDER BY lifetime_value DESC;

-- Average product ratings
SELECT p.name, ROUND(AVG(r.rating)::numeric, 2) AS average_rating,
       COUNT(r.id) AS review_count
FROM products AS p
LEFT JOIN reviews AS r ON r.product_id = p.id
GROUP BY p.id, p.name
ORDER BY average_rating DESC NULLS LAST;

-- Monthly revenue
SELECT to_char(date_trunc('month', placed_at), 'Mon YYYY') AS month,
       SUM(total) AS revenue,
       COUNT(*) AS order_count,
       ROUND(AVG(total), 2) AS average_order_value
FROM orders
GROUP BY date_trunc('month', placed_at)
ORDER BY date_trunc('month', placed_at);

-- Stored procedure: GetCustomerOrders(customer_id)
CREATE OR REPLACE FUNCTION get_customer_orders(target_customer_id INTEGER)
RETURNS TABLE (
  order_id INTEGER,
  placed_at TIMESTAMPTZ,
  status VARCHAR,
  total NUMERIC,
  product_name VARCHAR,
  quantity INTEGER
)
LANGUAGE SQL
AS $$
  SELECT o.id, o.placed_at, o.status, o.total, p.name, oi.quantity
  FROM orders AS o
  INNER JOIN order_items AS oi ON oi.order_id = o.id
  INNER JOIN products AS p ON p.id = oi.product_id
  WHERE o.customer_id = target_customer_id
  ORDER BY o.placed_at DESC;
$$;

-- Trigger 1: reduce stock after an order item is inserted.
CREATE OR REPLACE FUNCTION reduce_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id AND stock >= NEW.quantity;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_reduce_stock ON order_items;
CREATE TRIGGER order_items_reduce_stock
AFTER INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION reduce_product_stock();

-- Trigger 2: calculate the order total from its normalized order items.
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE orders
  SET total = COALESCE((
    SELECT SUM(quantity * unit_price)
    FROM order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  ), 0)
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS order_items_recalculate_total ON order_items;
CREATE TRIGGER order_items_recalculate_total
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION recalculate_order_total();

-- Trigger 3: transparent RFM-style segment refresh after a new order.
CREATE OR REPLACE FUNCTION refresh_customer_segment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE customers
  SET segment = CASE
    WHEN (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id = NEW.customer_id) >= 500
      THEN 'High value'
    WHEN (SELECT COUNT(*) FROM orders WHERE customer_id = NEW.customer_id) > 1
      THEN 'Returning'
    ELSE 'New'
  END
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_refresh_segment ON orders;
CREATE TRIGGER orders_refresh_segment
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION refresh_customer_segment();