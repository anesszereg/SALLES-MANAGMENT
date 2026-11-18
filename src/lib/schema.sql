-- Lune Benif ERP — PostgreSQL schema (compatible with Supabase; gen_random_uuid is builtin in PG13+)

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  type text not null check (type in ('manufactured','assembled','resale','raw_material')),
  description text,
  image_url text,
  selling_price numeric(18,2) not null default 0,
  stock numeric(18,2) not null default 0,
  min_stock numeric(18,2) not null default 0,
  avg_cost numeric(18,2) not null default 0, -- weighted average cost
  created_at timestamptz not null default now()
);
create index if not exists idx_products_type on products(type);
create index if not exists idx_products_category on products(category_id);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  movement_type text not null, -- purchase_in, sale_out, production_in, production_out, return_in, return_out, adjustment, damaged
  quantity numeric(18,2) not null, -- signed: + in, - out
  unit_cost numeric(18,2) not null default 0,
  reference_type text, -- purchase_invoice, sales_invoice, production_batch, sales_return, adjustment
  reference_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sm_product on stock_movements(product_id);
create index if not exists idx_sm_ref on stock_movements(reference_type, reference_id);

create table if not exists inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  quantity numeric(18,2) not null, -- signed
  reason text not null, -- correction, damaged, loss, count
  note text,
  created_at timestamptz not null default now()
);

-- Suppliers & purchases
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  supplier_id uuid references suppliers(id),
  purchase_date date not null default current_date,
  category text not null default 'raw_materials', -- raw_materials, accessories, ready_made, resale, other
  subtotal numeric(18,2) not null default 0,
  extra_costs numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  payment_method text,
  notes text,
  status text not null default 'confirmed', -- confirmed, cancelled
  created_at timestamptz not null default now()
);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references purchase_invoices(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(18,2) not null,
  unit_price numeric(18,2) not null,
  total numeric(18,2) not null
);
create index if not exists idx_pi_invoice on purchase_items(invoice_id);

create table if not exists supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  invoice_id uuid references purchase_invoices(id),
  amount numeric(18,2) not null,
  payment_method text,
  payment_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- Customers & sales
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sales_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid references customers(id),
  sale_date date not null default current_date,
  subtotal numeric(18,2) not null default 0,
  discount numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  cogs numeric(18,2) not null default 0,
  payment_method text,
  notes text,
  status text not null default 'confirmed', -- confirmed, cancelled
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references sales_invoices(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(18,2) not null,
  unit_price numeric(18,2) not null,
  unit_cost numeric(18,2) not null default 0,
  total numeric(18,2) not null
);
create index if not exists idx_si_invoice on sale_items(invoice_id);

create table if not exists customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  invoice_id uuid references sales_invoices(id),
  amount numeric(18,2) not null,
  payment_method text,
  payment_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sales_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  sales_invoice_id uuid not null references sales_invoices(id),
  return_date date not null default current_date,
  total numeric(18,2) not null default 0,
  cogs numeric(18,2) not null default 0,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists sales_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references sales_returns(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(18,2) not null,
  unit_price numeric(18,2) not null,
  unit_cost numeric(18,2) not null default 0
);

-- Production
create table if not exists production_recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists production_recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references production_recipes(id) on delete cascade,
  material_id uuid not null references products(id),
  quantity numeric(18,2) not null
);

create table if not exists production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique,
  product_id uuid not null references products(id),
  recipe_id uuid references production_recipes(id),
  quantity_planned numeric(18,2) not null,
  quantity_completed numeric(18,2) not null default 0,
  material_cost numeric(18,2) not null default 0,
  labor_cost numeric(18,2) not null default 0,
  transport_cost numeric(18,2) not null default 0,
  other_cost numeric(18,2) not null default 0,
  total_cost numeric(18,2) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  status text not null default 'in_progress', -- in_progress, completed, cancelled
  start_date date not null default current_date,
  completion_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists production_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references production_batches(id) on delete cascade,
  material_id uuid not null references products(id),
  quantity numeric(18,2) not null,
  unit_cost numeric(18,2) not null default 0,
  total numeric(18,2) not null default 0
);

-- Expenses
create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category_id uuid references expense_categories(id),
  amount numeric(18,2) not null,
  description text,
  payment_method text,
  created_at timestamptz not null default now()
);

-- Financial transactions (actual cash/bank movements)
create table if not exists financial_transactions (
  id uuid primary key default gen_random_uuid(),
  tx_type text not null, -- customer_payment, supplier_payment, expense, other_in, other_out
  direction text not null check (direction in ('in','out')),
  amount numeric(18,2) not null,
  account text not null default 'cash',
  reference_type text,
  reference_id uuid,
  tx_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ft_date on financial_transactions(tx_date);

-- System
create table if not exists business_settings (
  key text primary key,
  value text
);

create table if not exists document_sequences (
  prefix text primary key,
  next_number integer not null default 1
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity text,
  entity_id uuid,
  detail text,
  created_at timestamptz not null default now()
);

insert into document_sequences(prefix,next_number) values
  ('PUR',1),('SAL',1),('RET',1),('PAY',1),('SPAY',1),('PRD',1),('ADJ',1)
on conflict do nothing;

insert into expense_categories(name) values
  ('Rent'),('Electricity'),('Water'),('Salaries'),('Transportation'),
  ('Maintenance'),('Marketing'),('Packaging'),('Administrative'),('Other')
on conflict do nothing;
