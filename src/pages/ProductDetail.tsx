import React, { useEffect, useState } from 'react';
import { ProductSchema } from '../components/ProductSchema';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/supabase';
import { useParams } from '@tanstack/react-router';
import { toast } from 'sonner';

export const ProductDetail: React.FC = () => {
  const params = useParams({ strict: false }) as { id?: string };
  const productId = params.id || 'roelix-101';

  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    async function fetchProductData() {
      try {
        setLoading(true);
        // 1. جلب المنتج الأساسي من قاعدة البيانات
        const { data: prodData, error: prodError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (prodError) throw prodError;
        setProduct(prodData);

        // 2. جلب المقاسات والمتغيرات (Variants) الخاصة بهذا المنتج
        const { data: varData, error: varError } = await supabase
          .from('product_variants')
          .select('*')
          .eq('product_id', productId);

        if (!varError && varData && varData.length > 0) {
          setVariants(varData);
          setSelectedVariant(varData[0]); // اختيار أول مقاس افتراضياً
        }
      } catch (err) {
        console.error('Error fetching product details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProductData();
  }, [productId]);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  if (loading) {
    return <div className="py-40 text-center text-muted-foreground">جارٍ تحميل تفاصيل المنتج الفاخر...</div>;
  }

  if (!product) {
    return <div className="py-40 text-center text-muted-foreground">المنتج غير موجود.</div>;
  }

  const productImage = product.images?.[0] || "https://roelix.com/images/product-1.jpg";
  const currentPrice = selectedVariant ? selectedVariant.price : (product.price || 1250);
  const currentComparePrice = selectedVariant ? selectedVariant.compare_at_price : null;
  const currentStock = selectedVariant ? selectedVariant.stock : (product.stock ?? 10);
  const currentSku = selectedVariant ? selectedVariant.sku : `ROELIX-${product.id}`;

  const schemaProduct = {
    id: product.id,
    name: product.name,
    description: product.description || "",
    image: productImage,
    price: currentPrice,
    currency: "EGP",
    inStock: currentStock > 0
  };

  return (
    <div className="container mx-auto px-6 py-12 max-w-7xl" dir="rtl">
      <Helmet>
        <title>{product.name} | ROELIX Atelier</title>
        <meta name="description" content={product.description} />
      </Helmet>

      <ProductSchema product={schemaProduct} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-6">
        {/* صور المنتج */}
        <div>
          <img 
            src={productImage} 
            alt={product.name} 
            className="w-full rounded-lg shadow-lg object-cover h-[500px]"
          />
        </div>

        {/* معلومات المنتج والخيارات */}
        <div className="flex flex-col justify-center">
          <p className="eyebrow text-gold mb-2">ROELIX Luxury Collection</p>
          <h1 className="font-serif text-4xl mb-3 text-[#0B132B]">{product.name}</h1>
          
          {/* الـ SKU */}
          <p className="text-xs text-muted-foreground mb-4">SKU: {currentSku}</p>

          {/* الأسعار */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-3xl font-bold text-red-600">
              LE {currentPrice}
            </span>
            {currentComparePrice && (
              <span className="text-xl text-gray-400 line-through">
                LE {currentComparePrice}
              </span>
            )}
            {currentComparePrice && (
              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-semibold">
                وفر {Math.round(((currentComparePrice - currentPrice) / currentComparePrice) * 100)}%
              </span>
            )}
          </div>

          {/* حالة المخزون */}
          <div className="mb-6 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block animate-pulse"></span>
            <span className="text-sm font-semibold text-emerald-700">
              Available in stock ({currentStock})
            </span>
          </div>

          {/* أزرار اختيار المقاسات / المتغيرات (Variants Selection) */}
          {variants.length > 0 && (
            <div className="mb-6 space-y-4 border-t border-b py-4">
              <div>
                <label className="block text-sm font-semibold text-[#0B132B] mb-2">
                  Size / Option: <span className="font-normal">{selectedVariant?.size_name}</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`px-5 py-2.5 rounded-full border text-sm font-semibold transition ${
                          isSelected 
                            ? 'bg-[#0B132B] text-white border-[#0B132B] shadow-md' 
                            : 'bg-white text-[#0B132B] border-gray-300 hover:border-[#0B132B]'
                        }`}
                      >
                        {v.size_name || v.dimension || 'Standard'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedVariant?.dimension && (
                <div>
                  <label className="block text-sm font-semibold text-[#0B132B] mb-1">
                    Dimension: {selectedVariant.dimension}
                  </label>
                </div>
              )}
            </div>
          )}

          {/* تحديد الكمية وأزرار الشراء */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center border rounded-lg overflow-hidden bg-white">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-4 py-3 hover:bg-gray-100 transition"
              >
                −
              </button>
              <span className="px-4 py-3 font-semibold">{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="px-4 py-3 hover:bg-gray-100 transition"
              >
                +
              </button>
            </div>

            <button 
              onClick={() => toast.success(`تم إضافة ${quantity} من المنتج إلى السلة بنجاح`)}
              className="flex-1 bg-white border-2 border-[#0B132B] text-[#0B132B] py-3.5 rounded-lg font-bold hover:bg-gray-50 transition shadow-sm"
            >
              Add To Cart
            </button>
          </div>

          <button 
            onClick={() => toast.success("جاري الانتقال لإتمام الطلب...")}
            className="w-full bg-[#0B132B] text-[#D4AF37] py-4 rounded-lg font-bold hover:opacity-90 transition shadow-lg mb-8"
          >
            Buy It Now
          </button>

          {/* القوائم المنسدلة للتفاصيل والعناية (Accordions) */}
          <div className="border-t border-b border-gray-200 divide-y divide-gray-200">
            <div className="py-4">
              <button 
                onClick={() => toggleSection('details')} 
                className="flex justify-between items-center w-full font-serif text-lg text-[#0B132B] focus:outline-none"
              >
                <span>Product Details</span>
                <span className="text-xl font-sans">{openSection === 'details' ? '−' : '+'}</span>
              </button>
              {openSection === 'details' && (
                <p className="mt-3 text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                  {product.product_details || "خامة فاخرة مصممة خصيصاً لتلبي معايير الجودة العالمية لـ ROELIX."}
                </p>
              )}
            </div>

            <div className="py-4">
              <button 
                onClick={() => toggleSection('care')} 
                className="flex justify-between items-center w-full font-serif text-lg text-[#0B132B] focus:outline-none"
              >
                <span>Product Care</span>
                <span className="text-xl font-sans">{openSection === 'care' ? '−' : '+'}</span>
              </button>
              {openSection === 'care' && (
                <p className="mt-3 text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                  {product.product_care || "تُتبع تعليمات العناية القياسية للحفاظ على رونق وجودة المنتج."}
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProductDetail;