// src/utils/metaPixel.ts

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

export const META_PIXEL_ID = '2189877235209434';

// تهيئة Meta Pixel داخل التطبيق
export const initMetaPixel = () => {
  if (typeof window === 'undefined' || window.fbq) return;

  const n: any = (window.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  });

  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];

  const t = document.createElement('script');
  t.async = true;
  t.src = 'https://connect.facebook.net/en_US/fbevents.js';

  const s = document.getElementsByTagName('script')[0];
  s.parentNode?.insertBefore(t, s);

  window.fbq('init', META_PIXEL_ID);
  window.fbq('track', 'PageView');
};

// تابع لتتبع الأحداث المخصصة (مثل إضافة للسلة أو الشراء)
export const trackEvent = (eventName: string, options = {}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, options);
  }
};