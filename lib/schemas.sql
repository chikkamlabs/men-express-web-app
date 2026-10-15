-- ==============================================================================
-- MEN EXPRESS - COMPLETE SUPABASE POSTGRESQL PRODUCTION DATABASE SCHEMA
-- ==============================================================================
-- Architecture: Multi-store Clothing Retail & Online E-commerce Management
-- Modules: Online Store, Admin Central, Store POS, Multi-store Inventory, Staff
-- Target Database: Supabase PostgreSQL (PostgreSQL 15+)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- PART 3: ENUM TYPES
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'store');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'deactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE distributor_status AS ENUM ('active', 'deactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE distributor_trans_type AS ENUM ('add', 'subtract');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'card', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE staff_attendance_status AS ENUM ('full', 'half', 'absent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_payment_status AS ENUM ('pending', 'submitted', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_fulfillment_status AS ENUM ('pending', 'payment_success', 'packed', 'shipping', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE bill_status AS ENUM ('draft', 'success');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE expense_by_type AS ENUM ('admin', 'store');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE distribution_status AS ENUM ('pending', 'accepted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE transfer_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- PART 4: TABLE CREATION (Dependency Order)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. USERS (Application User Profiles mapping to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    mobile VARCHAR(15),
    role user_role NOT NULL DEFAULT 'store',
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. STORES (Physical Outlets)
-- ------------------------------------------------------------------------------
-- Defined early so users and staff can establish foreign key references safely.
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id VARCHAR(30) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    email TEXT,
    mobile TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. CATEGORIES (Product Classification)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cat_id VARCHAR(20) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status BOOLEAN NOT NULL DEFAULT true,
    image TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. PRODUCTS (Base Apparel Items: T-shirts, Shirts, Pants)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    prod_id VARCHAR(20) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    fit TEXT,
    collar TEXT,
    fabric TEXT,
    status BOOLEAN NOT NULL DEFAULT true,
    landing_page BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. COLORS (Master Color Palette)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 6. SIZES (Master Size Options: S, M, L, XL, XXL, etc.)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    value VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 7. PRODUCT_COLORS (Association between Product and Colors)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    color_id UUID NOT NULL REFERENCES public.colors(id) ON DELETE RESTRICT,
    front_image UUID NULL,
    status BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_color UNIQUE (product_id, color_id)
);

-- ------------------------------------------------------------------------------
-- 8. PRODUCT_COLOR_IMAGES (Images specific to Product Colorway)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_color_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_color_id UUID NOT NULL REFERENCES public.product_colors(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
    ALTER TABLE public.product_colors
    ADD CONSTRAINT product_colors_front_image_fkey
    FOREIGN KEY (front_image)
    REFERENCES public.product_color_images (id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_product_color_images_order
ON public.product_color_images (product_color_id, display_order);

-- ------------------------------------------------------------------------------
-- 9. PRODUCT_VARIANTS (Sellable SKUs with Barcode, Pricing, Central Stock)
-- ------------------------------------------------------------------------------
-- 'quantity' here explicitly represents the Central Warehouse stock pool.
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_color_id UUID NOT NULL REFERENCES public.product_colors(id) ON DELETE CASCADE,
    size_id UUID NOT NULL REFERENCES public.sizes(id) ON DELETE RESTRICT,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    mrp NUMERIC(12,2) NOT NULL CHECK (mrp >= 0),
    s_p NUMERIC(12,2) NOT NULL CHECK (s_p >= 0 AND s_p <= mrp),
    p_p NUMERIC(12,2) NOT NULL CHECK (p_p >= 0),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactive')),
    online_available BOOLEAN NOT NULL DEFAULT true,
    on_landing_page BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_variant_color_size UNIQUE (product_color_id, size_id)
);

-- ------------------------------------------------------------------------------
-- 10. DISTRIBUTORS (Suppliers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id VARCHAR(20) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    mobile VARCHAR(15),
    email TEXT,
    company TEXT,
    balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status distributor_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 11. DISTRIBUTOR_TRANSACTIONS (Supplier Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.distributor_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
    trans_type distributor_trans_type NOT NULL,
    type payment_method NOT NULL DEFAULT 'cash',
    trans_id VARCHAR(50),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    balance NUMERIC(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 12. PURCHASES (Stock Purchase Invoices from Distributors)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id VARCHAR(30) UNIQUE NOT NULL,
    distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE RESTRICT,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    invoice_number VARCHAR(100),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 13. PURCHASE_ITEMS (Line Items for Purchases)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    mrp NUMERIC(12,2) NOT NULL CHECK (mrp >= 0),
    p_p NUMERIC(12,2) NOT NULL CHECK (p_p >= 0),
    qty INTEGER NOT NULL CHECK (qty > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_purchase_item_variant UNIQUE (purchase_id, product_variant_id)
);

-- ------------------------------------------------------------------------------
-- 14. STAFF (Store Employees - No Auth Credentials)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mobile VARCHAR(15),
    email TEXT,
    salary NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (salary >= 0),
    store_id UUID NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 15. STAFF_ATTENDANCE (Daily Store Staff Attendance)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    attendance staff_attendance_status NOT NULL DEFAULT 'full',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_staff_attendance_daily UNIQUE (staff_id, date)
);

-- ------------------------------------------------------------------------------
-- 16. STAFF_SALARIES (Salary Disbursement History - Strictly Admin Access)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 17. CUSTOMERS (Online & In-store Customers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    mobile VARCHAR(15) UNIQUE NOT NULL,
    email TEXT,
    key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 18. CUSTOMER_ADDRESS (Customer Shipping Addresses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_address (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address_name TEXT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    postal_code VARCHAR(10) NOT NULL,
    state TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    land_mark TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactive')),
    mobile_alt VARCHAR(15),
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 19. ONLINE_ORDERS (E-commerce Web Orders with WhatsApp Verification)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.online_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(30) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    delivery_charges NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (delivery_charges >= 0),
    payable_amount NUMERIC(12,2) NOT NULL CHECK (payable_amount >= 0),
    coupon_code VARCHAR(50),
    referral_code VARCHAR(50),
    payment order_payment_status NOT NULL DEFAULT 'pending',
    transaction_details TEXT,
    status order_fulfillment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 20. ORDER_ITEMS (Online Order Line Items)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
    prod_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    s_p NUMERIC(12,2) NOT NULL CHECK (s_p >= 0),
    row_total NUMERIC(12,2) NOT NULL CHECK (row_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_order_item_variant UNIQUE (order_id, prod_id)
);

-- ------------------------------------------------------------------------------
-- 21. STORE_BILLS (In-store POS Bills)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id VARCHAR(30) UNIQUE NOT NULL,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    final_amount NUMERIC(12,2) NOT NULL CHECK (final_amount >= 0),
    status bill_status NOT NULL DEFAULT 'draft',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 22. BILL_ITEMS (POS Bill Line Items)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.store_bills(id) ON DELETE CASCADE,
    prod_variant UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    qty INTEGER NOT NULL CHECK (qty > 0),
    s_p NUMERIC(12,2) NOT NULL CHECK (s_p >= 0),
    mrp NUMERIC(12,2) NOT NULL CHECK (mrp >= 0),
    row_total NUMERIC(12,2) NOT NULL CHECK (row_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bill_item_variant UNIQUE (bill_id, prod_variant)
);

-- ------------------------------------------------------------------------------
-- 23. BILL_PAYMENTS (POS Bill Payment Split by Method)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.store_bills(id) ON DELETE CASCADE,
    payment_type payment_method NOT NULL DEFAULT 'cash',
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 24. EXPENSES (Store and Admin Expenses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_by expense_by_type NOT NULL DEFAULT 'store',
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    notes TEXT,
    payment_type payment_method NOT NULL DEFAULT 'cash',
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_expense_store_consistency CHECK (
        (expense_by = 'admin' AND store_id IS NULL) OR
        (expense_by = 'store' AND store_id IS NOT NULL)
    )
);

-- ------------------------------------------------------------------------------
-- 25. STORE_DISTRIBUTION (Admin-to-Store Stock Distribution Header)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_distribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
    distribution_id VARCHAR(30) UNIQUE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status distribution_status NOT NULL DEFAULT 'pending',
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 26. DISTRIBUTION_ITEMS (Items in Stock Distribution)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.distribution_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    s_distribution_id UUID NOT NULL REFERENCES public.store_distribution(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    qty INTEGER NOT NULL CHECK (qty > 0),
    barcode VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_distribution_item_variant UNIQUE (s_distribution_id, product_variant_id)
);

-- ------------------------------------------------------------------------------
-- 27. STORE_PRODUCTS (Physical Store Inventory Tracking)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    product_variant UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    barcode VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_store_product_variant UNIQUE (store_id, product_variant)
);

-- ------------------------------------------------------------------------------
-- 28. STORE_TRANSFERS (Store-to-Store Stock Transfers Header)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id VARCHAR(30) UNIQUE NOT NULL,
    from_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
    to_store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status transfer_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_different_stores CHECK (from_store_id <> to_store_id)
);

-- ------------------------------------------------------------------------------
-- 29. STORE_TRANSFER_ITEMS (Items in Store-to-Store Transfer)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_transfer_id UUID NOT NULL REFERENCES public.store_transfers(id) ON DELETE CASCADE,
    product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    qty INTEGER NOT NULL CHECK (qty > 0),
    accepted_qty INTEGER NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0 AND accepted_qty <= qty),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_transfer_item_variant UNIQUE (store_transfer_id, product_variant_id)
);

-- ==============================================================================
-- PART 5: INDEXES
-- ==============================================================================

-- Foreign Key & Filter Indexes for Performance & RLS Lookups
CREATE INDEX IF NOT EXISTS idx_users_role_status ON public.users(role, status);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_prod_id ON public.products(prod_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);

CREATE INDEX IF NOT EXISTS idx_product_colors_product ON public.product_colors(product_id);
CREATE INDEX IF NOT EXISTS idx_product_colors_color ON public.product_colors(color_id);

CREATE INDEX IF NOT EXISTS idx_product_color_images_lookup ON public.product_color_images(product_id, product_color_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON public.product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_product_variants_catalog ON public.product_variants(status, online_available, on_landing_page);

CREATE INDEX IF NOT EXISTS idx_distributor_tx_distributor ON public.distributor_transactions(distributor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_distributor ON public.purchases(distributor_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_lookup ON public.purchase_items(purchase_id, product_variant_id);

CREATE INDEX IF NOT EXISTS idx_staff_store ON public.staff(store_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_lookup ON public.staff_attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_salaries_lookup ON public.staff_salaries(staff_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON public.customers(mobile);
CREATE INDEX IF NOT EXISTS idx_customers_key ON public.customers(key);
CREATE INDEX IF NOT EXISTS idx_customer_address_customer ON public.customer_address(customer_id);

CREATE INDEX IF NOT EXISTS idx_online_orders_customer ON public.online_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON public.online_orders(status, payment);
CREATE INDEX IF NOT EXISTS idx_online_orders_date ON public.online_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_lookup ON public.order_items(order_id, prod_id);

CREATE INDEX IF NOT EXISTS idx_store_bills_store_date ON public.store_bills(store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_store_bills_customer ON public.store_bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_store_bills_staff ON public.store_bills(staff_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_lookup ON public.bill_items(bill_id, prod_variant);
CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON public.bill_payments(bill_id);

CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON public.expenses(store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_by ON public.expenses(expense_by);

CREATE INDEX IF NOT EXISTS idx_store_distribution_store ON public.store_distribution(store_id, status);
CREATE INDEX IF NOT EXISTS idx_distribution_items_lookup ON public.distribution_items(s_distribution_id, product_variant_id);

CREATE INDEX IF NOT EXISTS idx_store_products_lookup ON public.store_products(store_id, product_variant);
CREATE INDEX IF NOT EXISTS idx_store_products_barcode ON public.store_products(barcode);

CREATE INDEX IF NOT EXISTS idx_store_transfers_from_store ON public.store_transfers(from_store_id, status);
CREATE INDEX IF NOT EXISTS idx_store_transfers_to_store ON public.store_transfers(to_store_id, status);
CREATE INDEX IF NOT EXISTS idx_store_transfer_items_lookup ON public.store_transfer_items(store_transfer_id, product_variant_id);

-- ==============================================================================
-- PART 7 & 8: HELPER & SECURITY FUNCTIONS & TRIGGERS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. Generic updated_at Trigger Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply updated_at trigger across timestamped tables
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND column_name = 'updated_at'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;', tbl);
        EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', tbl);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- B. Security Definer Authorization Helper Functions
-- ------------------------------------------------------------------------------
-- 1. Check if current authenticated user is an active Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role = 'admin'
          AND status = 'active'
    );
$$;

-- 2. Retrieve store_id assigned to current authenticated user
CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT s.id
    FROM public.stores s
    JOIN public.users u ON u.id = s.id
    WHERE u.id = auth.uid()
      AND u.role = 'store'
      AND u.status = 'active';
$$;

-- 3. Check if current user is assigned to a specific store
CREATE OR REPLACE FUNCTION public.check_store_access(target_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT (public.is_admin() OR (public.get_user_store_id() = target_store_id));
$$;

-- ------------------------------------------------------------------------------
-- C. Business Integrity Triggers
-- ------------------------------------------------------------------------------

-- 1. Sync Supabase Auth User with public.users profile
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.users (id, name, email, mobile, role, status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        NEW.raw_user_meta_data->>'mobile',
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'store'::user_role),
        'active'::user_status
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. Enforce Variant Product & Color Consistency
-- Ensures product_variants.product_id matches product_colors.product_id
CREATE OR REPLACE FUNCTION public.validate_variant_product_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_color_product_id UUID;
BEGIN
    SELECT product_id INTO v_color_product_id
    FROM public.product_colors
    WHERE id = NEW.product_color_id;

    IF v_color_product_id IS NULL OR v_color_product_id <> NEW.product_id THEN
        RAISE EXCEPTION 'Product variant product_id (%) does not match product_colors product_id (%)',
            NEW.product_id, v_color_product_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_variant_hierarchy ON public.product_variants;
CREATE TRIGGER trg_validate_variant_hierarchy
    BEFORE INSERT OR UPDATE ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION public.validate_variant_product_hierarchy();

-- 3. Enforce Staff Belongs to Store for Bills
CREATE OR REPLACE FUNCTION public.validate_bill_staff_store()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_staff_store_id UUID;
BEGIN
    SELECT store_id INTO v_staff_store_id
    FROM public.staff
    WHERE id = NEW.staff_id;

    IF v_staff_store_id IS NULL OR v_staff_store_id <> NEW.store_id THEN
        RAISE EXCEPTION 'Staff member (%) does not belong to store (%)',
            NEW.staff_id, NEW.store_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_bill_staff_store ON public.store_bills;
CREATE TRIGGER trg_validate_bill_staff_store
    BEFORE INSERT OR UPDATE ON public.store_bills
    FOR EACH ROW EXECUTE FUNCTION public.validate_bill_staff_store();

-- 4. Enforce Staff Belongs to Originating Store for Transfers
CREATE OR REPLACE FUNCTION public.validate_transfer_staff_store()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_staff_store_id UUID;
BEGIN
    IF NEW.staff_id IS NOT NULL THEN
        SELECT store_id INTO v_staff_store_id
        FROM public.staff
        WHERE id = NEW.staff_id;

        IF v_staff_store_id IS NULL OR v_staff_store_id <> NEW.from_store_id THEN
            RAISE EXCEPTION 'Staff member (%) initiating transfer does not belong to origin store (%)',
                NEW.staff_id, NEW.from_store_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_transfer_staff_store ON public.store_transfers;
CREATE TRIGGER trg_validate_transfer_staff_store
    BEFORE INSERT OR UPDATE ON public.store_transfers
    FOR EACH ROW EXECUTE FUNCTION public.validate_transfer_staff_store();

-- ==============================================================================
-- PART 8: TRANSACTIONAL BUSINESS FUNCTIONS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Accept Admin-to-Store Stock Distribution
-- Moves stock from in-transit distribution into store_products inventory.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_distribution(p_distribution_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_dist RECORD;
    v_item RECORD;
BEGIN
    -- Verify distribution exists and lock record
    SELECT * INTO v_dist
    FROM public.store_distribution
    WHERE id = p_distribution_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Distribution record not found.';
    END IF;

    IF v_dist.status = 'accepted' THEN
        RAISE EXCEPTION 'Distribution has already been accepted.';
    END IF;

    -- Authorization check: Admin or the receiving store user
    IF NOT (public.is_admin() OR public.get_user_store_id() = v_dist.store_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only the assigned store or an admin can accept this distribution.';
    END IF;

    -- Process each distributed item atomically
    FOR v_item IN
        SELECT product_variant_id, qty, barcode
        FROM public.distribution_items
        WHERE s_distribution_id = p_distribution_id
    LOOP
        INSERT INTO public.store_products (store_id, product_variant, quantity, barcode)
        VALUES (v_dist.store_id, v_item.product_variant_id, v_item.qty, v_item.barcode)
        ON CONFLICT (store_id, product_variant)
        DO UPDATE SET 
            quantity = public.store_products.quantity + EXCLUDED.quantity,
            updated_at = now();
    END LOOP;

    -- Mark distribution as accepted
    UPDATE public.store_distribution
    SET status = 'accepted',
        accepted_at = now(),
        accepted_by = auth.uid(),
        updated_at = now()
    WHERE id = p_distribution_id;

    RETURN jsonb_build_object(
        'success', true,
        'distribution_id', v_dist.distribution_id,
        'store_id', v_dist.store_id,
        'message', 'Stock successfully added to store inventory.'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Initiate Store-to-Store Stock Transfer
-- Atomically deducts stock from origin store and creates pending transfer.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.initiate_store_transfer(
    p_from_store_id UUID,
    p_to_store_id UUID,
    p_transfer_number VARCHAR,
    p_items JSONB, -- Array of { "product_variant_id": "uuid", "qty": int }
    p_notes TEXT DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_transfer_id UUID;
    v_item JSONB;
    v_variant_id UUID;
    v_qty INTEGER;
    v_available_qty INTEGER;
BEGIN
    IF p_from_store_id = p_to_store_id THEN
        RAISE EXCEPTION 'Origin and destination stores must be different.';
    END IF;

    -- Authorization check
    IF NOT (public.is_admin() OR public.get_user_store_id() = p_from_store_id) THEN
        RAISE EXCEPTION 'Unauthorized: You can only initiate transfers from your assigned store.';
    END IF;

    -- Create transfer record
    INSERT INTO public.store_transfers (
        transfer_id, from_store_id, to_store_id, status, notes, staff_id
    ) VALUES (
        p_transfer_number, p_from_store_id, p_to_store_id, 'pending', p_notes, p_staff_id
    ) RETURNING id INTO v_transfer_id;

    -- Process each item: Lock row, check stock, deduct from sending store
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_variant_id := (v_item->>'product_variant_id')::UUID;
        v_qty := (v_item->>'qty')::INTEGER;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'Transfer item quantity must be greater than zero.';
        END IF;

        -- Check available stock at sending store with row lock
        SELECT quantity INTO v_available_qty
        FROM public.store_products
        WHERE store_id = p_from_store_id AND product_variant = v_variant_id
        FOR UPDATE;

        IF v_available_qty IS NULL OR v_available_qty < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock in origin store for product variant %. Available: %, Requested: %',
                v_variant_id, COALESCE(v_available_qty, 0), v_qty;
        END IF;

        -- Deduct from sending store
        UPDATE public.store_products
        SET quantity = quantity - v_qty,
            updated_at = now()
        WHERE store_id = p_from_store_id AND product_variant = v_variant_id;

        -- Record line item
        INSERT INTO public.store_transfer_items (
            store_transfer_id, product_variant_id, qty, accepted_qty
        ) VALUES (
            v_transfer_id, v_variant_id, v_qty, 0
        );
    END LOOP;

    RETURN v_transfer_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Accept Store-to-Store Stock Transfer
-- Atomically adds accepted stock to destination store; reconciles any unaccepted items.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_store_transfer(
    p_transfer_id UUID,
    p_accepted_items JSONB -- Array of { "product_variant_id": "uuid", "accepted_qty": int }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_transfer RECORD;
    v_item JSONB;
    v_variant_id UUID;
    v_acc_qty INTEGER;
    v_sent_qty INTEGER;
    v_diff INTEGER;
    v_barcode VARCHAR(100);
BEGIN
    SELECT * INTO v_transfer
    FROM public.store_transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Store transfer record not found.';
    END IF;

    IF v_transfer.status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending transfers can be accepted (Current status: %).', v_transfer.status;
    END IF;

    -- Authorization check: Admin or receiving store user
    IF NOT (public.is_admin() OR public.get_user_store_id() = v_transfer.to_store_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only the receiving store or admin can accept this transfer.';
    END IF;

    -- Process accepted items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_accepted_items)
    LOOP
        v_variant_id := (v_item->>'product_variant_id')::UUID;
        v_acc_qty := (v_item->>'accepted_qty')::INTEGER;

        SELECT qty INTO v_sent_qty
        FROM public.store_transfer_items
        WHERE store_transfer_id = p_transfer_id AND product_variant_id = v_variant_id;

        IF v_sent_qty IS NULL THEN
            RAISE EXCEPTION 'Variant % is not part of this transfer.', v_variant_id;
        END IF;

        IF v_acc_qty < 0 OR v_acc_qty > v_sent_qty THEN
            RAISE EXCEPTION 'Accepted quantity (%) must be between 0 and sent quantity (%) for variant %.',
                v_acc_qty, v_sent_qty, v_variant_id;
        END IF;

        -- Retrieve barcode from variant
        SELECT barcode INTO v_barcode FROM public.product_variants WHERE id = v_variant_id;

        -- Update transfer item accepted_qty
        UPDATE public.store_transfer_items
        SET accepted_qty = v_acc_qty
        WHERE store_transfer_id = p_transfer_id AND product_variant_id = v_variant_id;

        -- Add accepted quantity to receiving store
        IF v_acc_qty > 0 THEN
            INSERT INTO public.store_products (store_id, product_variant, quantity, barcode)
            VALUES (v_transfer.to_store_id, v_variant_id, v_acc_qty, v_barcode)
            ON CONFLICT (store_id, product_variant)
            DO UPDATE SET 
                quantity = public.store_products.quantity + EXCLUDED.quantity,
                updated_at = now();
        END IF;

        -- Return unaccepted difference back to origin store
        v_diff := v_sent_qty - v_acc_qty;
        IF v_diff > 0 THEN
            UPDATE public.store_products
            SET quantity = quantity + v_diff,
                updated_at = now()
            WHERE store_id = v_transfer.from_store_id AND product_variant = v_variant_id;
        END IF;
    END LOOP;

    -- Mark transfer accepted
    UPDATE public.store_transfers
    SET status = 'accepted',
        resolved_at = now(),
        resolved_by = auth.uid(),
        updated_at = now()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object(
        'success', true,
        'transfer_id', v_transfer.transfer_id,
        'message', 'Transfer successfully accepted and reconciled.'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Reject Store-to-Store Stock Transfer
-- Restores all deducted inventory back to the origin store.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_store_transfer(
    p_transfer_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_transfer RECORD;
    v_item RECORD;
BEGIN
    SELECT * INTO v_transfer
    FROM public.store_transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Store transfer record not found.';
    END IF;

    IF v_transfer.status <> 'pending' THEN
        RAISE EXCEPTION 'Only pending transfers can be rejected.';
    END IF;

    -- Authorization check
    IF NOT (public.is_admin() OR public.get_user_store_id() = v_transfer.to_store_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only the receiving store or admin can reject this transfer.';
    END IF;

    -- Return all sent quantities to origin store
    FOR v_item IN
        SELECT product_variant_id, qty
        FROM public.store_transfer_items
        WHERE store_transfer_id = p_transfer_id
    LOOP
        UPDATE public.store_products
        SET quantity = quantity + v_item.qty,
            updated_at = now()
        WHERE store_id = v_transfer.from_store_id AND product_variant = v_item.product_variant_id;
    END LOOP;

    -- Mark transfer rejected
    UPDATE public.store_transfers
    SET status = 'rejected',
        notes = COALESCE(notes || E'\nRejection note: ' || p_notes, 'Rejection note: ' || p_notes),
        resolved_at = now(),
        resolved_by = auth.uid(),
        updated_at = now()
    WHERE id = p_transfer_id;

    RETURN jsonb_build_object(
        'success', true,
        'transfer_id', v_transfer.transfer_id,
        'message', 'Transfer rejected; inventory restored to origin store.'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Finalize POS Store Bill
-- Validates stock, locks records, deducts store inventory, and marks bill 'success'.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_store_bill(p_bill_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_bill RECORD;
    v_item RECORD;
    v_stock INTEGER;
    v_total_paid NUMERIC(12,2);
BEGIN
    SELECT * INTO v_bill
    FROM public.store_bills
    WHERE id = p_bill_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bill not found.';
    END IF;

    IF v_bill.status = 'success' THEN
        RAISE EXCEPTION 'Bill has already been finalized.';
    END IF;

    -- Authorization check
    IF NOT (public.is_admin() OR public.get_user_store_id() = v_bill.store_id) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to finalize bills for this store.';
    END IF;

    -- Validate payment totals match final_amount
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.bill_payments
    WHERE bill_id = p_bill_id;

    IF v_total_paid < v_bill.final_amount THEN
        RAISE EXCEPTION 'Total payment received (%) is less than bill final amount (%).',
            v_total_paid, v_bill.final_amount;
    END IF;

    -- Validate and deduct store inventory for all items
    FOR v_item IN
        SELECT prod_variant, qty
        FROM public.bill_items
        WHERE bill_id = p_bill_id
    LOOP
        SELECT quantity INTO v_stock
        FROM public.store_products
        WHERE store_id = v_bill.store_id AND product_variant = v_item.prod_variant
        FOR UPDATE;

        IF v_stock IS NULL OR v_stock < v_item.qty THEN
            RAISE EXCEPTION 'Insufficient stock in store for variant %. Available: %, Required: %',
                v_item.prod_variant, COALESCE(v_stock, 0), v_item.qty;
        END IF;

        UPDATE public.store_products
        SET quantity = quantity - v_item.qty,
            updated_at = now()
        WHERE store_id = v_bill.store_id AND product_variant = v_item.prod_variant;
    END LOOP;

    -- Reward customer loyalty points if linked (1 point per 100 spent)
    IF v_bill.customer_id IS NOT NULL AND v_bill.final_amount >= 100 THEN
        UPDATE public.customers
        SET points = points + FLOOR(v_bill.final_amount / 100)::INTEGER,
            updated_at = now()
        WHERE id = v_bill.customer_id;
    END IF;

    -- Mark bill success
    UPDATE public.store_bills
    SET status = 'success',
        updated_at = now()
    WHERE id = p_bill_id;

    RETURN jsonb_build_object(
        'success', true,
        'bill_id', v_bill.bill_id,
        'final_amount', v_bill.final_amount,
        'message', 'Bill successfully finalized and store stock deducted.'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Create Online Order (Secure Server/Public Checkout Entrypoint)
-- Validates prices against database, checks & reserves Central stock, creates order.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_online_order(
    p_customer_name TEXT,
    p_customer_mobile VARCHAR(15),
    p_customer_email TEXT,
    p_address_name TEXT,
    p_postal_code VARCHAR(10),
    p_state TEXT,
    p_city TEXT,
    p_address TEXT,
    p_landmark TEXT,
    p_items JSONB, -- Array of { "variant_id": "uuid", "quantity": int }
    p_coupon_code VARCHAR(50) DEFAULT NULL,
    p_referral_code VARCHAR(50) DEFAULT NULL,
    p_delivery_charges NUMERIC(12,2) DEFAULT 0.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_customer_id UUID;
    v_order_id UUID;
    v_order_num VARCHAR(30);
    v_item JSONB;
    v_var_id UUID;
    v_var_qty INTEGER;
    v_var_sp NUMERIC(12,2);
    v_var_stock INTEGER;
    v_subtotal NUMERIC(12,2) := 0.00;
    v_discount NUMERIC(12,2) := 0.00;
    v_final_payable NUMERIC(12,2);
    v_row_total NUMERIC(12,2);
BEGIN
    -- 1. Upsert customer record
    INSERT INTO public.customers (name, mobile, email)
    VALUES (p_customer_name, p_customer_mobile, p_customer_email)
    ON CONFLICT (mobile) DO UPDATE
    SET name = EXCLUDED.name,
        email = COALESCE(EXCLUDED.email, public.customers.email),
        updated_at = now()
    RETURNING id INTO v_customer_id;

    -- 2. Insert delivery address
    INSERT INTO public.customer_address (
        customer_id, address_name, postal_code, state, city, address, land_mark
    ) VALUES (
        v_customer_id, p_address_name, p_postal_code, p_state, p_city, p_address, p_landmark
    );

    -- 3. Calculate subtotal & lock Central stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_var_id := (v_item->>'variant_id')::UUID;
        v_var_qty := (v_item->>'quantity')::INTEGER;

        IF v_var_qty <= 0 THEN
            RAISE EXCEPTION 'Item quantity must be greater than zero.';
        END IF;

        SELECT s_p, quantity INTO v_var_sp, v_var_stock
        FROM public.product_variants
        WHERE id = v_var_id AND status = 'active' AND online_available = true
        FOR UPDATE;

        IF v_var_sp IS NULL THEN
            RAISE EXCEPTION 'Variant % is not available for online purchase.', v_var_id;
        END IF;

        IF v_var_stock < v_var_qty THEN
            RAISE EXCEPTION 'Insufficient central stock for variant %. Available: %, Requested: %',
                v_var_id, v_var_stock, v_var_qty;
        END IF;

        v_subtotal := v_subtotal + (v_var_sp * v_var_qty);
    END LOOP;

    -- Simple coupon mock logic or placeholder discount
    IF p_coupon_code = 'WELCOME10' THEN
        v_discount := ROUND(v_subtotal * 0.10, 2);
    END IF;

    v_final_payable := v_subtotal - v_discount + p_delivery_charges;
    v_order_num := 'ORD-' || to_char(now(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

    -- 4. Create online order
    INSERT INTO public.online_orders (
        order_id, customer_id, amount, discount, delivery_charges, payable_amount,
        coupon_code, referral_code, payment, status
    ) VALUES (
        v_order_num, v_customer_id, v_subtotal, v_discount, p_delivery_charges, v_final_payable,
        p_coupon_code, p_referral_code, 'pending'::order_payment_status, 'pending'::order_fulfillment_status
    ) RETURNING id INTO v_order_id;

    -- 5. Insert order items & deduct central inventory
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_var_id := (v_item->>'variant_id')::UUID;
        v_var_qty := (v_item->>'quantity')::INTEGER;

        SELECT s_p INTO v_var_sp FROM public.product_variants WHERE id = v_var_id;
        v_row_total := v_var_sp * v_var_qty;

        INSERT INTO public.order_items (order_id, prod_id, quantity, s_p, row_total)
        VALUES (v_order_id, v_var_id, v_var_qty, v_var_sp, v_row_total);

        -- Deduct from central stock
        UPDATE public.product_variants
        SET quantity = quantity - v_var_qty,
            updated_at = now()
        WHERE id = v_var_id;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_num,
        'payable_amount', v_final_payable,
        'whatsapp_instructions', 'Please share this order number and payment screenshot on WhatsApp to complete verification.'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Verify Online WhatsApp Payment (Admin Action)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_online_payment(
    p_order_id UUID,
    p_verified BOOLEAN,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only an admin can verify payments.';
    END IF;

    SELECT * INTO v_order
    FROM public.online_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found.';
    END IF;

    IF p_verified THEN
        UPDATE public.online_orders
        SET payment = 'verified'::order_payment_status,
            status = 'payment_success'::order_fulfillment_status,
            transaction_details = COALESCE(transaction_details || E'\n' || p_notes, p_notes),
            updated_at = now()
        WHERE id = p_order_id;
    ELSE
        -- Restore central stock if rejected/cancelled
        FOR v_item IN
            SELECT prod_id, quantity FROM public.order_items WHERE order_id = p_order_id
        LOOP
            UPDATE public.product_variants
            SET quantity = quantity + v_item.quantity,
                updated_at = now()
            WHERE id = v_item.prod_id;
        END LOOP;

        UPDATE public.online_orders
        SET payment = 'rejected'::order_payment_status,
            status = 'cancelled'::order_fulfillment_status,
            transaction_details = COALESCE(transaction_details || E'\nRejected: ' || p_notes, 'Rejected: ' || p_notes),
            updated_at = now()
        WHERE id = p_order_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'payment_status', CASE WHEN p_verified THEN 'verified' ELSE 'rejected' END
    );
END;
$$;

-- ==============================================================================
-- PART 6: ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all 29 tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_color_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_address ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_transfer_items ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. USERS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_full_users" ON public.users
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "user_view_own_record" ON public.users
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- ------------------------------------------------------------------------------
-- 2. CATEGORIES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_categories" ON public.categories
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "public_read_active_categories" ON public.categories
    FOR SELECT TO public
    USING (status = true);

-- ------------------------------------------------------------------------------
-- 3. PRODUCTS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_products" ON public.products
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "public_read_active_products" ON public.products
    FOR SELECT TO public
    USING (
        status = true AND EXISTS (
            SELECT 1 FROM public.categories c 
            WHERE c.id = products.category_id AND c.status = true
        )
    );

-- ------------------------------------------------------------------------------
-- 4. COLORS & SIZES MASTER POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_colors" ON public.colors
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "public_read_colors" ON public.colors
    FOR SELECT TO public
    USING (true);

CREATE POLICY "admin_manage_sizes" ON public.sizes
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "public_read_sizes" ON public.sizes
    FOR SELECT TO public
    USING (true);

-- ------------------------------------------------------------------------------
-- 5. PRODUCT COLORS & IMAGES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_product_colors" ON public.product_colors
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "public_read_product_colors" ON public.product_colors
    FOR SELECT TO public
    USING (
        status = true AND EXISTS (
            SELECT 1 FROM public.products p 
            WHERE p.id = product_colors.product_id AND p.status = true
        )
    );

CREATE POLICY "admin_manage_product_color_images" ON public.product_color_images
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "public_read_product_color_images" ON public.product_color_images
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.product_colors pc
            JOIN public.products p ON p.id = pc.product_id
            WHERE pc.id = product_color_images.product_color_id 
              AND pc.status = true AND p.status = true
        )
    );

-- ------------------------------------------------------------------------------
-- 6. PRODUCT VARIANTS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_product_variants" ON public.product_variants
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_read_active_variants" ON public.product_variants
    FOR SELECT TO authenticated
    USING (status = 'active');

CREATE POLICY "public_read_online_variants" ON public.product_variants
    FOR SELECT TO public
    USING (status = 'active' AND online_available = true);

-- ------------------------------------------------------------------------------
-- 7. STORES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_stores" ON public.stores
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_view_assigned_store" ON public.stores
    FOR SELECT TO authenticated
    USING (id = public.get_user_store_id());

-- ------------------------------------------------------------------------------
-- 8. DISTRIBUTORS & PURCHASES (Strictly Admin Access)
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_distributors" ON public.distributors
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "admin_manage_distributor_tx" ON public.distributor_transactions
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "admin_manage_purchases" ON public.purchases
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "admin_manage_purchase_items" ON public.purchase_items
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 9. STAFF POLICIES (Store users cannot view/edit salary)
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_staff" ON public.staff
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Store user can view/manage staff only for their assigned store
CREATE POLICY "store_manage_assigned_staff" ON public.staff
    FOR ALL TO authenticated
    USING (store_id = public.get_user_store_id())
    WITH CHECK (store_id = public.get_user_store_id());

-- Note on salary protection: Revoke column SELECT/UPDATE on salary from store role:
REVOKE UPDATE (salary) ON public.staff FROM authenticated;

-- ------------------------------------------------------------------------------
-- 10. STAFF ATTENDANCE POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_staff_attendance" ON public.staff_attendance
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_manage_staff_attendance" ON public.staff_attendance
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff s 
            WHERE s.id = staff_attendance.staff_id 
              AND s.store_id = public.get_user_store_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.staff s 
            WHERE s.id = staff_attendance.staff_id 
              AND s.store_id = public.get_user_store_id()
        )
    );

-- ------------------------------------------------------------------------------
-- 11. STAFF SALARIES (Strictly Admin Access)
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_staff_salaries" ON public.staff_salaries
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 12. CUSTOMERS & CUSTOMER ADDRESSES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_manage_customers" ON public.customers;
CREATE POLICY "admin_manage_customers" ON public.customers
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "store_access_customers_for_pos" ON public.customers;
CREATE POLICY "store_access_customers_for_pos" ON public.customers
    FOR SELECT TO authenticated
    USING (public.get_user_store_id() IS NOT NULL);

DROP POLICY IF EXISTS "store_insert_customers_for_pos" ON public.customers;
CREATE POLICY "store_insert_customers_for_pos" ON public.customers
    FOR INSERT TO authenticated
    WITH CHECK (public.get_user_store_id() IS NOT NULL);

DROP POLICY IF EXISTS "store_update_customers_for_pos" ON public.customers;
CREATE POLICY "store_update_customers_for_pos" ON public.customers
    FOR UPDATE TO authenticated
    USING (public.get_user_store_id() IS NOT NULL)
    WITH CHECK (public.get_user_store_id() IS NOT NULL);

-- Public / Web Store Customer Policies (Search, register & update during checkout)
DROP POLICY IF EXISTS "public_select_customers" ON public.customers;
CREATE POLICY "public_select_customers" ON public.customers
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "public_insert_customers" ON public.customers;
CREATE POLICY "public_insert_customers" ON public.customers
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_customers" ON public.customers;
CREATE POLICY "public_update_customers" ON public.customers
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

-- Customer Addresses
DROP POLICY IF EXISTS "admin_manage_customer_address" ON public.customer_address;
CREATE POLICY "admin_manage_customer_address" ON public.customer_address
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public_select_customer_address" ON public.customer_address;
CREATE POLICY "public_select_customer_address" ON public.customer_address
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "public_insert_customer_address" ON public.customer_address;
CREATE POLICY "public_insert_customer_address" ON public.customer_address
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_customer_address" ON public.customer_address;
CREATE POLICY "public_update_customer_address" ON public.customer_address
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 13. ONLINE ORDERS & ITEMS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_manage_online_orders" ON public.online_orders;
CREATE POLICY "admin_manage_online_orders" ON public.online_orders
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public_insert_online_orders" ON public.online_orders;
CREATE POLICY "public_insert_online_orders" ON public.online_orders
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_online_orders" ON public.online_orders;
CREATE POLICY "public_select_online_orders" ON public.online_orders
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "admin_manage_order_items" ON public.order_items;
CREATE POLICY "admin_manage_order_items" ON public.order_items
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public_insert_order_items" ON public.order_items;
CREATE POLICY "public_insert_order_items" ON public.order_items
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_order_items" ON public.order_items;
CREATE POLICY "public_select_order_items" ON public.order_items
    FOR SELECT TO public
    USING (true);

-- ------------------------------------------------------------------------------
-- 14. STORE BILLS, BILL ITEMS, BILL PAYMENTS (Store-Isolated Access)
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_store_bills" ON public.store_bills
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_select_own_bills" ON public.store_bills
    FOR SELECT TO authenticated
    USING (store_id = public.get_user_store_id());

CREATE POLICY "store_insert_own_bills" ON public.store_bills
    FOR INSERT TO authenticated
    WITH CHECK (store_id = public.get_user_store_id());

CREATE POLICY "store_update_own_draft_bills" ON public.store_bills
    FOR UPDATE TO authenticated
    USING (store_id = public.get_user_store_id() AND status = 'draft')
    WITH CHECK (store_id = public.get_user_store_id());

-- Bill items
CREATE POLICY "admin_manage_bill_items" ON public.bill_items
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_access_own_bill_items" ON public.bill_items
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.store_bills b 
            WHERE b.id = bill_items.bill_id AND b.store_id = public.get_user_store_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.store_bills b 
            WHERE b.id = bill_items.bill_id AND b.store_id = public.get_user_store_id()
        )
    );

-- Bill payments
CREATE POLICY "admin_manage_bill_payments" ON public.bill_payments
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_access_own_bill_payments" ON public.bill_payments
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.store_bills b 
            WHERE b.id = bill_payments.bill_id AND b.store_id = public.get_user_store_id()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.store_bills b 
            WHERE b.id = bill_payments.bill_id AND b.store_id = public.get_user_store_id()
        )
    );

-- ------------------------------------------------------------------------------
-- 15. EXPENSES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_expenses" ON public.expenses
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_view_own_expenses" ON public.expenses
    FOR SELECT TO authenticated
    USING (expense_by = 'store' AND store_id = public.get_user_store_id());

CREATE POLICY "store_insert_own_expenses" ON public.expenses
    FOR INSERT TO authenticated
    WITH CHECK (
        expense_by = 'store' AND 
        store_id = public.get_user_store_id()
    );

-- ------------------------------------------------------------------------------
-- 16. STORE DISTRIBUTION & DISTRIBUTION ITEMS
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_store_distribution" ON public.store_distribution
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_view_own_distribution" ON public.store_distribution
    FOR SELECT TO authenticated
    USING (store_id = public.get_user_store_id());

CREATE POLICY "admin_manage_distribution_items" ON public.distribution_items
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_view_own_distribution_items" ON public.distribution_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.store_distribution sd 
            WHERE sd.id = distribution_items.s_distribution_id 
              AND sd.store_id = public.get_user_store_id()
        )
    );

-- ------------------------------------------------------------------------------
-- 17. STORE PRODUCTS (Physical Inventory)
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_store_products" ON public.store_products
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_view_own_inventory" ON public.store_products
    FOR SELECT TO authenticated
    USING (store_id = public.get_user_store_id());

-- ------------------------------------------------------------------------------
-- 18. STORE TRANSFERS & TRANSFER ITEMS
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_manage_store_transfers" ON public.store_transfers
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_view_involved_transfers" ON public.store_transfers
    FOR SELECT TO authenticated
    USING (
        from_store_id = public.get_user_store_id() OR 
        to_store_id = public.get_user_store_id()
    );

CREATE POLICY "admin_manage_transfer_items" ON public.store_transfer_items
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "store_view_involved_transfer_items" ON public.store_transfer_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.store_transfers st 
            WHERE st.id = store_transfer_items.store_transfer_id 
              AND (st.from_store_id = public.get_user_store_id() OR st.to_store_id = public.get_user_store_id())
        )
    );

-- ==============================================================================
-- PART 9: SECURE STORE STAFF VIEW (Without Salary Exposure)
-- ==============================================================================
CREATE OR REPLACE VIEW public.store_staff_view
WITH (security_invoker = true)
AS
SELECT 
    id,
    name,
    mobile,
    email,
    store_id,
    status,
    created_at,
    updated_at
FROM public.staff;

GRANT SELECT ON public.store_staff_view TO authenticated;

-- ==============================================================================
-- PART 10: SUPABASE STORAGE BUCKETS & RLS POLICIES
-- ==============================================================================

-- 1. Create product_color_images_bucket bucket if it does not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_color_images_bucket', 'product_color_images_bucket', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Clean up existing policies for product_color_images_bucket to prevent duplicates
DROP POLICY IF EXISTS "Allow public read from product_color_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated insert to product_color_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to product_color_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from product_color_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload to product_color_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon update to product_color_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon delete from product_color_images_bucket" ON storage.objects;

-- 3. Storage Policies for storage.objects on product_color_images_bucket

-- Allow public read access to product images
CREATE POLICY "Allow public read from product_color_images_bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product_color_images_bucket');

-- Allow authenticated users to upload images
CREATE POLICY "Allow authenticated insert to product_color_images_bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product_color_images_bucket');

-- Allow authenticated users to update images
CREATE POLICY "Allow authenticated update to product_color_images_bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product_color_images_bucket')
WITH CHECK (bucket_id = 'product_color_images_bucket');

-- Allow authenticated users to delete images
CREATE POLICY "Allow authenticated delete from product_color_images_bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product_color_images_bucket');

-- Allow anon upload/delete for dev/client-side access
CREATE POLICY "Allow anon upload to product_color_images_bucket"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'product_color_images_bucket');

CREATE POLICY "Allow anon update to product_color_images_bucket"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'product_color_images_bucket')
WITH CHECK (bucket_id = 'product_color_images_bucket');

CREATE POLICY "Allow anon delete from product_color_images_bucket"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'product_color_images_bucket');

-- ------------------------------------------------------------------------------
-- 2. Create category_images_bucket bucket if it does not exist
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('category_images_bucket', 'category_images_bucket', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Clean up existing policies for category_images_bucket to prevent duplicates
DROP POLICY IF EXISTS "Allow public read from category_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated insert to category_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to category_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from category_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload to category_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon update to category_images_bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon delete from category_images_bucket" ON storage.objects;

-- Storage Policies for storage.objects on category_images_bucket

-- Allow public read access to category images
CREATE POLICY "Allow public read from category_images_bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'category_images_bucket');

-- Allow authenticated users to upload category images
CREATE POLICY "Allow authenticated insert to category_images_bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'category_images_bucket');

-- Allow authenticated users to update category images
CREATE POLICY "Allow authenticated update to category_images_bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'category_images_bucket')
WITH CHECK (bucket_id = 'category_images_bucket');

-- Allow authenticated users to delete category images
CREATE POLICY "Allow authenticated delete from category_images_bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'category_images_bucket');

-- Allow anon upload/update/delete for dev/client-side access
CREATE POLICY "Allow anon upload to category_images_bucket"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'category_images_bucket');

CREATE POLICY "Allow anon update to category_images_bucket"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'category_images_bucket')
WITH CHECK (bucket_id = 'category_images_bucket');

CREATE POLICY "Allow anon delete from category_images_bucket"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'category_images_bucket');

