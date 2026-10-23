import React from 'react';
import { ProductSchema } from '../components/ProductSchema';

export const ProductDetail: React.FC = () => {
  // بيانات تجريبية للمنتج (تستبدل لاحقاً ببيانات الـ API أو الـ State)
  const product = {
    id: "roelix-101",
    name: "طقم ملاية قطن مصري فاخر",
    description: "طقم ملاية قطن مصري 100% عالي الجودة متوفر حصرياً لدى متجر Roelix.",
    image: "https://roelix.com/images/product-1.jpg",
    price: 1250,
    inStock: true
  };

  return (
    <div className="container mx-auto p-4">
      {/* حقن كود الـ Schema لصفحة المنتج */}
      <ProductSchema product={product} />

      {/* تفاصيل المنتج المعروضة للعميل */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full rounded-lg shadow-md"
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
          <p className="text-2xl text-emerald-600 font-semibold mb-4">
            {product.price} ج.م
          </p>
          <p className="text-gray-600 mb-6">{product.description}</p>
          
          <button className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition">
            أضف إلى السلة
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;