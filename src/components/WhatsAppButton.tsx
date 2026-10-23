import React from 'react';

interface WhatsAppButtonProps {
  phoneNumber?: string; // رقم الهاتف من الأدمن
  message?: string;     // نص الرسالة التلقائية
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  phoneNumber = "201000000000", // الرقم الافتراضي (استبدله برقمك)
  message = "مرحباً Roelix، أود الاستفسار عن المنتجات."
}) => {
  // تجهيز رابط الواتساب المباشر
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-110"
      aria-label="تواصل معنا عبر واتساب"
    >
      <svg
        className="w-8 h-8 fill-current"
        viewBox="0 0 24 24"
      >
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.705 1.754zm6.097-4.901l.374.222c1.472.873 3.17 1.335 4.902 1.336 5.18 0 9.395-4.215 9.397-9.396.001-2.51-.975-4.87-2.753-6.649-1.779-1.778-4.139-2.755-6.649-2.756-5.18 0-9.396 4.215-9.398 9.397-.001 1.831.528 3.618 1.529 5.17l.25.388-1.003 3.662 3.748-.982z" />
      </svg>
    </a>
  );
};

export default WhatsAppButton;