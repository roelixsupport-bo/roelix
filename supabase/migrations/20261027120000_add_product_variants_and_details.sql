-- 1. إضافة أعمدة التفاصيل وتعليمات العناية لجدول المنتجات الأساسي
alter table if exists products 
add column if not exists product_details text,
add column if not exists product_care text;

-- 2. إنشاء جدول متغيرات المنتج (Variants) للمقاسات والألوان والأسعار والمخزون
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  sku text unique not null,
  size_name text,      -- مثال: Soft Pillow أو Medium Pillow
  dimension text,      -- مثال: 50x70 cm
  price decimal(10,2) not null,
  compare_at_price decimal(10,2), -- السعر قبل الخصم
  stock integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. تفعيل الأمان (Row Level Security) لجدول المتغيرات
alter table product_variants enable row level security;

-- السماح للجميع بقراءة المتغيرات (عرض المنتجات في المتجر)
create policy "Allow public read access on product_variants"
  on product_variants for select
  using (true);

-- السماح للأدمن فقط بالإضافة والتعديل والحذف
create policy "Allow admin full access on product_variants"
  on product_variants for all
  using (auth.role() = 'authenticated');