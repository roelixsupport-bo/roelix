import React from 'react';
import { ProductSchema } from '../components/ProductSchema';
import { Helmet } from 'react-helmet-async';

export const ProductDetail: React.FC = () => {
  // بيانات المنتج (يمكن جلبها من الـ API لاحقاً)
  const product = {
    id: "roelix-101",
    name: "طقم ملاية قطن مصري فاخر - Roelix",
    description: "تسوق أفضل أطقم الملايات القطن المصري 100% الفاخرة من متجر Roelix. جودة عالية وتصميم عصري لراحتك.",
    image: "https://roelix.com/images/product-1.jpg",
    price: 1250,
    currency: "EGP",
    inStock: true
  };

  const pageUrl = typeof window !== 'undefined' ? window.location.href : 'https://roelix.com/';

  return (
    <div className="container mx-auto p-4">
      {/* إعدادات السيو لكل صفحة منتج عبر Helmet */}
      <Helmet>
        <title>{product.name} | متجر Roelix</title>
        <meta name="description" content={product.description} />
        <link rel="canonical" href={pageUrl} />
        
        {/* Open Graph لتويتر وفيسبوك */}
        <meta property="og:title" content={product.name} />
        <meta property="og:description" content={product.description} />
        <meta property="og:image" content={product.image} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="product" />
      </Helmet>

      {/* حقن كود أرشفة المنتج لجوجل (Schema.org) */}
      <ProductSchema product={product} />

      {/* واجهة عرض تفاصيل المنتج للعملاء */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        <div>
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full rounded-lg shadow-md object-cover"
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-4 text-gray-800">{product.name}</h1>
          <p className="text-2xl text-emerald-600 font-semibold mb-4">
            {product.price} {product.currency}
          </p>
          <p className="text-gray-600 mb-6 leading-relaxed">{product.description}</p>
          
          <button className="bg-slate-900 text-white px-8 py-3 rounded-lg font-semibold hover:bg-slate-800 transition shadow-md">
            أضف إلى السلة
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;