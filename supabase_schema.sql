-- ========================================================
-- พารวย POS - Database Schema สำหรับ Supabase (PostgreSQL)
-- คัดลอกโค้ดทั้งหมดนี้ไปวางในเมนู SQL Editor บน Supabase แล้วกด RUN
-- ========================================================

-- 1. ตารางสินค้า (Products)
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'packaged',
    category_id TEXT,
    cost_price NUMERIC DEFAULT 0,
    sell_price NUMERIC NOT NULL,
    unit TEXT DEFAULT 'ชิ้น',
    is_weighted BOOLEAN DEFAULT FALSE,
    min_stock_alert NUMERIC DEFAULT 5,
    stock NUMERIC DEFAULT 0,
    barcode TEXT,
    image TEXT,
    active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ตารางบิลขาย (Sales)
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    bill_number TEXT NOT NULL,
    subtotal NUMERIC NOT NULL,
    discount NUMERIC DEFAULT 0,
    total NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    cash_received NUMERIC DEFAULT 0,
    change NUMERIC DEFAULT 0,
    cashier_name TEXT DEFAULT 'เจ้าของร้าน',
    items JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ตารางบันทึกการเคลื่อนไหวสต็อก (Stock Movements)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    product_name TEXT,
    type TEXT,
    qty NUMERIC,
    unit TEXT,
    reason TEXT,
    performed_by TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ตารางตั้งค่าร้านค้า (Shop Settings)
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'shop_settings',
    shop_name TEXT DEFAULT 'พารวย',
    shop_tagline TEXT DEFAULT 'ร้านนี้ดี ค้าขาย ร่ำรวย',
    shop_phone TEXT DEFAULT '081-987-6543',
    permanent_qr_image TEXT,
    admin_pin TEXT DEFAULT '1234',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- เปิดสิทธิ์เข้าถึงแบบสาธารณะผ่าน Anon Key (เพื่อให้ทุกเครื่องในร้านอ่าน-เขียนสต็อกได้)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write on settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- เปิดระบบ Realtime สำหรับ products เพื่อให้อีกเครื่องเห็นสต็อกลดลงทันที
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
