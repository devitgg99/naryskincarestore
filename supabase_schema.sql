-- Enable UUID generation extension
create extension if not exists "uuid-ossp";

-- Table 1: products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name_kh text not null,
  name_en text not null,
  image_url text,
  base_price numeric(10, 2) not null default 0.00,
  created_at timestamp with time zone default now()
);

-- Table 2: suppliers
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_phone text,
  created_at timestamp with time zone default now()
);

-- Table 3: supplier_prices
create table if not exists supplier_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete cascade,
  price numeric(10, 2) not null default 0.00,
  stock_qty integer not null default 0,
  stock_unit text not null default 'pcs',
  updated_at timestamp with time zone default now(),
  unique (product_id, supplier_id)
);

-- Table 4: customers
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  map_url text,
  location_note text,
  created_at timestamp with time zone default now()
);

-- Table 5: orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  delivery_fee numeric(10, 2) not null default 0.00,
  total_amount numeric(10, 2) not null default 0.00,
  status text not null default 'pending', -- pending, delivered, paid
  ordered_at timestamp with time zone default now()
);

-- Table 6: order_items
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id) on delete restrict,
  supplier_id uuid references suppliers(id) on delete set null,
  supplier_price numeric(10, 2) not null default 0.00,
  unit_price numeric(10, 2) not null,
  quantity integer not null,
  subtotal numeric(10, 2) not null
);

-- Indexes for performance
create index if not exists idx_products_name_en on products(name_en);
create index if not exists idx_products_name_kh on products(name_kh);
create index if not exists idx_supplier_prices_product on supplier_prices(product_id);
create index if not exists idx_supplier_prices_supplier on supplier_prices(supplier_id);
create index if not exists idx_orders_customer on orders(customer_id);
create index if not exists idx_order_items_order on order_items(order_id);

-- Table 7: brands
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamp with time zone default now()
);

-- Add brand_id column to products table
alter table products add column if not exists brand_id uuid references brands(id) on delete set null;
create index if not exists idx_products_brand on products(brand_id);

-- Add selling_price column to products table
alter table products add column if not exists selling_price numeric(10, 2);

