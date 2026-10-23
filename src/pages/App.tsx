import ProductDetail from './ProductDetail';
import WhatsAppButton from '../components/WhatsAppButton';

function App() {
  // يمكنك استبدال هذا الرقم برقم الواتساب الخاص بمتجرك مباشرة
  const storePhoneNumber = "201012345678";

  return (
    <div>
      {/* استدعاء صفحة المنتج */}
      <ProductDetail />

      {/* زر الواتساب العائم */}
      <WhatsAppButton phoneNumber={storePhoneNumber} />
    </div>
  );
}

export default App;