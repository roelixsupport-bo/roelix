import React, { useEffect, useState } from 'react';
import { ProductSchema } from '../components/ProductSchema';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/supabase';
import { useParams } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Heart, Minus, Plus } from 'lucide-react';

export const ProductDetail: React.FC = () => {
  const params = useParams({ strict: false }) as { id?: string };
  const productId = params.id || 'roelix-101';

  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProductDetails() {
      try {
        setLoading(true);
        // 1. جلب بيانات المنتج الأساسية (تشمل السعر، الوصف، التفاصيل، وتعليمات العناية)
        const { data: prodData, error: prodError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (prodError) throw prodError;
        setProduct(prodData);

        // 2. جلب المقاسات والمتغيرات (Variants) للمنتج إن وجدت
        const { data: varData, error: varError } = await supabase
          .from('product_variants')
          .select('*')
          .eq('product_id', productId);

        if (!varError && varData && varData.length > 0) {
          setVariants(varData);
          setSelectedVariant(varData[0]);
        }
      } catch (err) {
        console.error('Error loading product:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProductDetails();
  }, [productId]);

  const toggleAccordion = (section: string) => {
    setActiveAccordion(activeAccordion === section ? null : section);
  };

  if (loading) {
    return <div className="py-40 text-center text-muted-foreground">جارٍ تحميل تفاصيل المنتج الفاخر...</div>;
  }

  if (!product) {
    return <div className="py-40 text-center text-muted-foreground">عذراً، هذا المنتج غير موجود.</div>;
  }

  // الاعتماد على السعر الأساسي للمنتج أو السعر المتغير إذا وجد
  const displayPrice = selectedVariant?.price ? selectedVariant.price : (product.price || 0);
  const productImage = product.images?.[0] || "https://roelix.com/images/product-1.jpg";
  const productStock = selectedVariant?.stock ?? product.stock ?? 10;

  const schemaProduct = {
    id: product.id,
    name: product.name,
    description: product.description || "",
    image: productImage,
    price: displayPrice,
    currency: "EGP",
    inStock: productStock > 0
  };

  return (
    <div className="container mx-auto px-6 py-12 max-w-7xl" dir="ltr">
      <Helmet>
        <title>{product.name} | ROELIX Luxury Atelier</title>
        <meta name="description" content={product.description} />
      </Helmet>

      <ProductSchema product={schemaProduct} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-6">
        {/* معرض الصور */}
        <div>
          <img 
            src={productImage} 
            alt={product.name} 
            className="w-full rounded-lg shadow-md object-cover h-[550px]"
          />
        </div>

        {/* تفاصيل المنتج وخيارات الشراء تماماً كالمتاجر العالمية */}
        <div className="flex flex-col justify-start">
          
          {/* السعر البارز في الأعلى */}
          <div className="mb-4">
            <span className="text-3xl font-serif font-bold text-[#0B132B]">
              EGP {displayPrice.toLocaleString()}
            </span>
          </div>

          {/* وصف المنتج */}
          <p className="text-gray-700 text-sm leading-relaxed mb-6">
            {product.description || "Enjoy hotel-quality comfort with our luxury collection, crafted with premium materials for soft, lasting support."}
          </p>

          {/* تفاصيل المنتج الإضافية (إن وجدت من لوحة التحكم) */}
          {product.product_details && (
            <div className="mb-6 text-xs text-gray-600 bg-gray-50 p-3 rounded border border-gray-100 leading-relaxed">
              {product.product_details}
            </div>
          )}

          {/* اختيار اللون (Colour) */}
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-wider uppercase text-gray-900 mb-2">
              Colour — <span className="font-normal text-gray-600">White</span>
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full border-2 border-[#D4AF37] p-0.5 flex items-center justify-center cursor-pointer">
                <div className="w-full h-full rounded-full bg-white shadow-inner"></div>
              </div>
            </div>
          </div>

          {/* المقاسات / المتغيرات (Size) */}
          {variants.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-wider uppercase text-gray-900 mb-2">
                Size / Option
              </p>
              <div className="flex flex-wrap gap-3">
                {variants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`px-6 py-3 rounded text-sm font-semibold transition border ${
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
          )}

          {/* حالة المخزون */}
          <div className="mb-6 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
            <span className="text-sm font-medium text-emerald-700">
              In stock — ships within 24 hours ({productStock} available)
            </span>
          </div>

          {/* تحديد الكمية وزر إضافة للسلة */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border border-gray-300 rounded overflow-hidden bg-white">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-4 py-3.5 hover:bg-gray-100 text-gray-600 transition"
              >
                <Minus size={16} />
              </button>
              <span className="px-5 py-3.5 font-semibold text-gray-900">{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="px-4 py-3.5 hover:bg-gray-100 text-gray-600 transition"
              >
                <Plus size={16} />
              </button>
            </div>

            <button 
              onClick={() => toast.success(`Added ${quantity} item(s) to your bag`)}
              className="flex-1 bg-[#0B132B] text-white py-4 rounded font-bold tracking-wider hover:opacity-95 transition shadow-md uppercase text-sm"
            >
              Add To Bag
            </button>

            <button 
              onClick={() => toast.success("Added to wishlist")}
              className="p-4 border border-gray-300 rounded hover:border-[#0B132B] transition text-gray-700"
            >
              <Heart size={20} />
            </button>
          </div>

          {/* القوائم المنسدلة (Care Instructions & Product Details) تماماً مثل الصورة */}
          <div className="border-t border-b border-gray-200 divide-y divide-gray-200 mt-4">
            
            {/* Care Instructions */}
            <div className="py-4">
              <button 
                onClick={() => toggleAccordion('care')} 
                className="flex justify-between items-center w-full font-serif text-base text-[#0B132B] focus:outline-none"
              >
                <span className="font-semibold">Care Instructions</span>
                <span className="text-xl font-sans">{activeAccordion === 'care' ? '−' : '+'}</span>
              </button>
              {activeAccordion === 'care' && (
                <p className="mt-3 text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                  {product.product_care || "Machine wash cold on gentle cycle. Do not bleach. Tumble dry low or line dry. Iron on low heat if needed."}
                </p>
              )}
            </div>

            {/* Shipping Policy */}
            <div className="py-4">
              <button 
                onClick={() => toggleAccordion('shipping')} 
                className="flex justify-between items-center w-full font-serif text-base text-[#0B132B] focus:outline-none"
              >
                <span className="font-semibold">Shipping & Delivery</span>
                <span className="text-xl font-sans">{activeAccordion === 'shipping' ? '−' : '+'}</span>
              </button>
              {activeAccordion === 'shipping' && (
                <p className="mt-3 text-gray-600 text-sm leading-relaxed">
                  Fast shipping across all governorates in Egypt via Bosta courier service within 2 to 4 business days.
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