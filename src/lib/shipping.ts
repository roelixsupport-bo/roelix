export const BOSTA_SHIPPING_RATES = {
  القاهرة: 50,
  الجيزة: 50,
  القليوبية: 50,
  الإسكندرية: 65,
  البحيرة: 65,
  الشرقية: 75,
  الدقهلية: 75,
  الغربية: 75,
  المنوفية: 75,
  "كفر الشيخ": 75,
  دمياط: 75,
  بورسعيد: 75,
  الإسماعيلية: 75,
  السويس: 75,
  الفيوم: 95,
  "بني سويف": 95,
  المنيا: 95,
  أسيوط: 95,
  سوهاج: 95,
  قنا: 95,
  الأقصر: 95,
  أسوان: 95,
  مطروح: 120,
  "البحر الأحمر": 120,
  "الوادي الجديد": 120,
  "شمال سيناء": 120,
  "جنوب سيناء": 120,
} as const;

export type EgyptGovernorate = keyof typeof BOSTA_SHIPPING_RATES;

export function shippingFor(governorate: EgyptGovernorate): number {
  return BOSTA_SHIPPING_RATES[governorate];
}
