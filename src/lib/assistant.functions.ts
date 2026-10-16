import { EGP_PER_USD, type Product } from "@/lib/store";
import { BOSTA_SHIPPING_RATES, type EgyptGovernorate } from "@/lib/shipping";
import type { AssistantShippingRates } from "@/lib/assistant-data";

type ChatMsg = { role: "user" | "assistant"; content: string };
type AssistantReply = { text: string; productIds: string[] };

export const ASSISTANT_SYSTEM_PROMPT = "ROELIX Luxury Home Textile Advisor";

const formatPrice = (price: number) =>
  `EGP ${Math.round(price * EGP_PER_USD).toLocaleString("en-US")}`;
const GOVERNORATE_ALIASES: Partial<Record<EgyptGovernorate, string>> = {
  القاهرة: "cairo",
  الجيزة: "giza",
  القليوبية: "qalyubia",
  الإسكندرية: "alexandria",
  البحيرة: "beheira",
  الشرقية: "sharqia",
  الدقهلية: "dakahlia",
  الغربية: "gharbia",
  المنوفية: "monufia",
  "كفر الشيخ": "kafr el sheikh",
  دمياط: "damietta",
  بورسعيد: "port said",
  الإسماعيلية: "ismailia",
  السويس: "suez",
  الفيوم: "faiyum",
  "بني سويف": "beni suef",
  المنيا: "minya",
  أسيوط: "asyut",
  سوهاج: "sohag",
  قنا: "qena",
  الأقصر: "luxor",
  أسوان: "aswan",
  مطروح: "matrouh",
  "البحر الأحمر": "red sea",
  "الوادي الجديد": "new valley",
  "شمال سيناء": "north sinai",
  "جنوب سيناء": "south sinai",
};

function liveProducts(products: Product[]): Product[] {
  return products.filter((product) => product.isPublished && product.stock > 0);
}

function categoryFor(message: string): string | undefined {
  if (/towel|bath|منشفة|مناشف/.test(message)) return "Luxury Towels";
  if (/pillow|وساد/.test(message)) return "Hotel Pillows";
  if (/protector|mattress|مرتبة|واقي/.test(message)) return "Mattress Protectors";
  if (
    /bedding|duvet|sheet|bed|sateen|percale|cotton|thread count|سرير|مفروش|لحاف|قطن/.test(message)
  )
    return "Bedding Sets";
  return undefined;
}

function catalogMatches(message: string, products: Product[], category?: string): Product[] {
  const available = liveProducts(products);
  const words = message.split(/[^a-z0-9\u0600-\u06ff]+/i).filter((word) => word.length > 2);
  return available
    .map((product) => {
      const searchable =
        `${product.name} ${product.nameAr} ${product.category} ${product.description}`.toLowerCase();
      const score =
        (category && product.category === category ? 10 : 0) +
        words.reduce((total, word) => total + (searchable.includes(word) ? 2 : 0), 0);
      return { product, score };
    })
    .filter(({ product, score }) => score > 0 && (!category || product.category === category))
    .sort((a, b) => b.score - a.score)
    .map(({ product }) => product);
}

function describeProduct(product: Product): string {
  const details: string[] = [];
  if (product.threadCount) details.push(`${product.threadCount} thread count`);
  if (product.gsm) details.push(`${product.gsm} GSM`);
  if (product.origin) details.push(`origin: ${product.origin}`);
  const quality = details.length ? ` (${details.join("; ")})` : "";
  return `• ${product.name}${quality} — ${formatPrice(product.price)}`;
}

function catalogReply(
  products: Product[],
  arabic: boolean,
  message: string,
  category?: string,
): AssistantReply {
  const matching = catalogMatches(message, products, category);
  const asksForPairing =
    /match|pair|coordinate|complement|together|with|set|matching|نسق|متناسق|معًا|طقم/.test(message);
  const recommendations = matching.slice(0, asksForPairing ? 3 : 2);
  if (!recommendations.length) {
    return {
      text: arabic
        ? "لا أرى خيارًا متاحًا يطابق ذلك في الكتالوج الحالي. أخبرني بنوع المنتج أو اللون والمقاس المطلوبين، وسأبحث عن أقرب بديل."
        : "I don’t see an available exact match in the current collection. Tell me the item type, preferred colour, or size, and I’ll look for the closest alternative.",
      productIds: [],
    };
  }

  const lines = recommendations.map(describeProduct);
  const qualityNote = recommendations.some((product) => product.threadCount)
    ? arabic
      ? "\n\nجودة أغطية السرير لا تعتمد على عدد الخيوط وحده؛ فجودة الألياف والنسيج والتشطيب عوامل مهمة أيضًا. المواصفات والأسعار من الكتالوج الحالي."
      : "\n\nA refined sheet set is about more than thread count: fibre quality, weave, and finishing matter too. Specifications and prices are from the current catalogue."
    : arabic
      ? "\n\nالأسعار والتوفر من الكتالوج المحلي الحالي وقد يتغيران حسب المخزون."
      : "\n\nPrices and availability are from the current local catalogue and can change with stock.";
  const pairingNote = asksForPairing
    ? arabic
      ? "\n\nنصيحة تنسيق: اختَر غطاء لحاف بلون متناسق مع طقم الملاءات؛ العاجي والكحلي خياران أنيقان خالدَان."
      : "\n\nStyling note: pair a sheet set with a duvet cover in a complementary tone. Ivory and navy make a particularly timeless palette."
    : "";

  return {
    text: `${arabic ? "اختيارات مختارة من ROELIX:\n" : "A considered selection from ROELIX:\n"}${lines.join("\n")}${pairingNote}${qualityNote}`,
    productIds: recommendations.map((product) => product.id),
  };
}

export function askAssistant(
  messages: ChatMsg[],
  products: Product[],
  shippingRates: AssistantShippingRates = {},
): AssistantReply {
  const latestMessage = messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
  const normalized = latestMessage.toLowerCase();
  const arabic = /[\u0600-\u06ff]/.test(latestMessage);

  if (/track|order status|where is my order|طلب|الطلب/.test(normalized)) {
    return {
      text: arabic
        ? "أرسل رقم طلبك بصيغة RX-XXXXXX ورقم الهاتف المستخدم عند إتمام الشراء للتحقق من حالته الحالية."
        : "Please share your order number (RX-XXXXXX) and the phone number used at checkout so I can check its current status.",
      productIds: [],
    };
  }

  if (/ship|deliver|return|guarantee|شحن|توصيل|إرجاع|ضمان/.test(normalized)) {
    const requestedGovernorate = (Object.keys(BOSTA_SHIPPING_RATES) as EgyptGovernorate[]).find(
      (governorate) =>
        normalized.includes(governorate.toLowerCase()) ||
        normalized.includes(GOVERNORATE_ALIASES[governorate] ?? "\u0000"),
    );
    if (requestedGovernorate) {
      const rate = shippingRates[requestedGovernorate];
      return {
        text:
          rate === undefined
            ? arabic
              ? "تعذر العثور على تعريفة شحن مؤكدة لهذه المحافظة حاليًا. يرجى المحاولة لاحقًا أو التحقق من تكلفة الشحن عند إتمام الطلب."
              : "I couldn’t find a confirmed shipping rate for that governorate right now. Please try again later or check the rate at checkout."
            : arabic
              ? `تقدير الشحن عبر بوستا إلى ${requestedGovernorate}: ${Math.round(rate).toLocaleString("ar-EG")} ج.م.`
              : `Estimated Bosta shipping to ${requestedGovernorate}: EGP ${Math.round(rate).toLocaleString("en-US")}.`,
        productIds: [],
      };
    }
    const availableRates = Object.values(shippingRates);
    return {
      text: arabic
        ? availableRates.length
          ? `تختلف رسوم الشحن عبر بوستا حسب المحافظة (من ${Math.min(...availableRates).toLocaleString("ar-EG")} إلى ${Math.max(...availableRates).toLocaleString("ar-EG")} ج.م). أخبرني باسم محافظتك لأتحقق من التعريفة الدقيقة.`
          : "تعذر تحميل تعريفة الشحن حاليًا. يرجى المحاولة لاحقًا أو التحقق من التكلفة عند إتمام الطلب."
        : availableRates.length
          ? `Bosta shipping fees depend on your governorate (currently EGP ${Math.min(...availableRates)}–${Math.max(...availableRates)}). Tell me your governorate and I’ll check the exact rate.`
          : "Shipping rates are unavailable right now. Please try again later or check the rate at checkout.",
      productIds: [],
    };
  }

  const category = categoryFor(normalized);
  if (
    /custom|bespoke|made.to.order|special order|custom order|مخصص|تفصيل|طلب خاص/.test(normalized)
  ) {
    const recommendations = catalogMatches(normalized, products, category).slice(0, 2);
    return {
      text: `Bespoke enquiries\n\nCustom sizing and made-to-order pricing are not configured for this local demonstration. I’d be delighted to help you shortlist a style from the current collection; for a bespoke request, please contact roelix.support@gmail.com.`,
      productIds: recommendations.map((product) => product.id),
    };
  }

  if (
    /care|wash|launder|iron|clean|maintain|fabric care|غسيل|اغسل|عناية|كيّ|تنظيف/.test(normalized)
  ) {
    return {
      text: `A little care for lasting luxury\n\n• Follow the care label on the individual piece first; fibre blends and finishes vary.\n• Wash linens with similar colours using a gentle cycle and mild detergent.\n• Avoid chlorine bleach, and dry gently; remove promptly to help minimise creasing.\n• Use a warm iron only when the care label permits it.\n\nFor Egyptian cotton in particular, gentle washing and avoiding excessive heat help preserve the hand and finish.`,
      productIds: [],
    };
  }

  if (
    /thread count|egyptian cotton|cotton|sateen|percale|fabric|thread|نسيج|قطن|ساتان/.test(
      normalized,
    )
  ) {
    const recommendations = catalogMatches(normalized, products, category ?? "Bedding Sets").slice(
      0,
      2,
    );
    const examples = recommendations.length
      ? `\n\nFrom the collection\n${recommendations.map(describeProduct).join("\n")}`
      : "";
    return {
      text: `A note on fine bed linen\n\nThread count describes the number of threads woven into a square inch, but a higher number alone does not guarantee a softer or longer-lasting sheet. Fibre length and quality, weave, and finishing all shape the result. Sateen tends to feel smooth and lustrous; percale is usually crisp and breathable. Choose the feel you enjoy, and follow the product’s stated fibre and care details.${examples}`,
      productIds: recommendations.map((product) => product.id),
    };
  }

  if (
    /decor|bedroom|style|colour|color|palette|luxury|interior|hom(e|eware)|ديكور|غرفة|ألوان/.test(
      normalized,
    )
  ) {
    return {
      text: `A quietly luxurious room\n\nBegin with a calm foundation—ivory, soft white, or warm neutral bedding—then introduce depth with a tailored duvet cover, a contrasting throw, and a few cushions in complementary tones. Natural texture and a restrained palette keep the room elegant rather than busy.\n\nIf you share your room colours, bed size, and whether you prefer a crisp or silky feel, I can suggest a more considered combination.`,
      productIds: [],
    };
  }

  if (/price|cost|how much|pricing|قيمة|سعر|بكام/.test(normalized)) {
    if (category) return catalogReply(products, arabic, normalized, category);
    const available = liveProducts(products).slice(0, 3);
    return {
      text: available.length
        ? `Current catalogue prices\n${available.map(describeProduct).join("\n")}\n\nTell me the product or collection you have in mind and I can narrow this down.`
        : "There are no currently available items to price in the local catalogue. Please check back soon or contact roelix.support@gmail.com.",
      productIds: available.map((product) => product.id),
    };
  }

  if (category) {
    return catalogReply(products, arabic, normalized, category);
  }

  return {
    text: `I’m the ${ASSISTANT_SYSTEM_PROMPT}. I’d be delighted to help with luxury sheets, duvet covers, hotel textiles, fabric care, or thoughtful bedroom styling.\n\nTell me what you’re looking for—perhaps a bed size, preferred colour, or crisp-versus-silky feel—and I’ll guide you to a suitable choice.`,
    productIds: [],
  };
}
