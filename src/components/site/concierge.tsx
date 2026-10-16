import { MessageCircle, Send, X, RotateCcw } from "lucide-react";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { askAssistant } from "@/lib/assistant.functions";
import { recordAIQuery, recordProductInteraction } from "@/lib/local-data";
import {
  loadAssistantCatalog,
  loadAssistantShippingRates,
  lookupCloudOrderStatus,
  type CloudOrderStatus,
} from "@/lib/assistant-data";

type Msg = { from: "bot" | "me"; text: string; productIds?: string[] };

const CHIPS = [
  "Which size fits my bed?",
  "Match sheets and a duvet cover",
  "Sateen vs percale",
  "How do I care for Egyptian cotton?",
  "Track my order",
];
const GREETING: Msg = {
  from: "bot",
  text: "Welcome to ROELIX. I’m your Luxury Home Textile Advisor, here to help you choose fine bed linen, coordinate a considered look, and care for your textiles.",
};
const KEY = "roelix_chat";
const UNAVAILABLE = "Sorry, the assistant is currently unavailable. Please try again later.";
const ORDER_NUMBER = /RX-?[A-Z0-9]{6}/i;

function extractPhone(value: string): { raw: string; digits: string } | undefined {
  const candidate = value.match(/[+0-9٠-٩۰-۹][0-9٠-٩۰-۹\s().-]{6,}[0-9٠-٩۰-۹]/g)?.find((match) => {
    const digits = match
      .replace(/[٠-٩۰-۹]/g, (digit) => {
        const code = digit.charCodeAt(0);
        return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
      })
      .replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15;
  });
  if (!candidate) return undefined;
  const digits = candidate
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/\D/g, "");
  return { raw: candidate, digits };
}

function maskedPhone(phone: string): string {
  return `••••${phone.slice(-4)}`;
}

function orderStatusReply(order: CloudOrderStatus | null, arabic: boolean): string {
  if (!order) {
    return arabic
      ? "لم أتمكن من العثور على طلب يطابق رقم الطلب ورقم الهاتف. تحقق من البيانات وحاول مرة أخرى."
      : "I couldn’t find an order matching that order number and phone. Please check the details and try again.";
  }
  const statuses = {
    pending: arabic ? "قيد الانتظار" : "Pending",
    processing: arabic ? "قيد التجهيز" : "Processing",
    shipped: arabic ? "تم الشحن" : "Shipped",
    delivered: arabic ? "تم التوصيل" : "Delivered",
    cancelled: arabic ? "ملغي" : "Cancelled",
  } as const;
  const amount = Math.round(order.total);
  return arabic
    ? `الحالة الحالية للطلب ${order.orderNumber}: ${statuses[order.status]}. الإجمالي: ${amount.toLocaleString("ar-EG")} ج.م.`
    : `Current status for order ${order.orderNumber}: ${statuses[order.status]}. Total: EGP ${amount.toLocaleString("en-US")}.`;
}

function clearSavedChat() {
  try {
    localStorage.removeItem(KEY);
  } catch (error) {
    console.error("Could not clear the saved concierge conversation", error);
  }
}

// Keeps any chat failure contained to the bubble so the rest of the page keeps working.
class ChatBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(e: unknown) {
    console.error("Assistant crashed", e);
    clearSavedChat();
  }
  override render() {
    if (this.state.failed)
      return (
        <button
          type="button"
          translate="no"
          onClick={() => this.setState({ failed: false })}
          className="notranslate fixed bottom-6 end-6 z-40 max-w-xs border bg-background px-4 py-3 text-start text-sm shadow-lux"
        >
          {UNAVAILABLE} <span className="text-gold underline">Retry</span>
        </button>
      );
    return this.props.children;
  }
}

export function Concierge() {
  return (
    <ChatBoundary>
      <ConciergeInner />
    </ChatBoundary>
  );
}

function ConciergeInner() {
  const s = useStore();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [pendingOrderNumber, setPendingOrderNumber] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (
        Array.isArray(value) &&
        value.every(
          (message) =>
            message &&
            typeof message.text === "string" &&
            (message.from === "bot" || message.from === "me"),
        )
      ) {
        setMsgs(value as Msg[]);
      } else if (value !== null) {
        clearSavedChat();
      }
    } catch (error) {
      console.error("Could not restore the saved concierge conversation", error);
      clearSavedChat();
    }
  }, []);
  useEffect(() => {
    if (msgs.length <= 1) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40)));
    } catch (error) {
      console.error("Could not save the concierge conversation", error);
    }
  }, [msgs]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, typing]);

  async function send(text = input) {
    const query = text.trim();
    if (!query || typing) return;
    const phone = extractPhone(query);
    const orderNumber = query.match(ORDER_NUMBER)?.[0] ?? pendingOrderNumber;
    const trackingRequest =
      Boolean(orderNumber) ||
      Boolean(pendingOrderNumber) ||
      /track|order status|where is my order|طلب|الطلب|تتبع/.test(query.toLowerCase());
    if (pathname !== "/admin" && !phone && !trackingRequest) recordAIQuery(query);
    const visibleQuery = phone ? query.replace(phone.raw, maskedPhone(phone.digits)) : query;
    const next = [...msgs, { from: "me" as const, text: visibleQuery }];
    setMsgs(next);
    setInput("");
    setTyping(true);
    try {
      if (trackingRequest) {
        if (!orderNumber) {
          const response = askAssistant([{ role: "user", content: query }], []);
          setMsgs((m) => [...m, { from: "bot", text: response.text }]);
        } else if (!phone) {
          setPendingOrderNumber(orderNumber.toUpperCase().replace(/^RX-?/, "RX-"));
          setMsgs((m) => [
            ...m,
            {
              from: "bot",
              text: /[\u0600-\u06ff]/.test(query)
                ? "لأسباب تتعلق بالخصوصية، أرسل رقم الهاتف المستخدم عند إتمام الطلب. لن أحفظ رقم الهاتف في سجل المحادثة."
                : "For privacy, please send the phone number used at checkout. I won’t save your phone number in the conversation history.",
            },
          ]);
        } else {
          const normalizedOrderNumber = orderNumber.toUpperCase().replace(/^RX-?/, "RX-");
          const order = await lookupCloudOrderStatus(normalizedOrderNumber, phone.digits);
          setPendingOrderNumber(null);
          setMsgs((m) => [
            ...m,
            { from: "bot", text: orderStatusReply(order, /[\u0600-\u06ff]/.test(query)) },
          ]);
        }
      } else {
        const [products, shippingRates] = await Promise.all([
          loadAssistantCatalog(),
          loadAssistantShippingRates(),
        ]);
        const response = askAssistant(
          next
            .slice(1)
            .map((m) => ({ role: m.from === "me" ? "user" : "assistant", content: m.text })),
          products,
          shippingRates,
        );
        const replyText =
          typeof response?.text === "string" && response.text.trim() ? response.text : UNAVAILABLE;
        const productIds = Array.isArray(response?.productIds)
          ? response.productIds.filter((id: unknown): id is string => typeof id === "string")
          : [];
        setMsgs((m) => [...m, { from: "bot", text: replyText, productIds }]);
      }
    } catch (error) {
      console.error("Could not complete the concierge request", error);
      setMsgs((m) => [...m, { from: "bot", text: UNAVAILABLE }]);
    } finally {
      setTyping(false);
    }
  }

  function reset() {
    setMsgs([GREETING]);
    setPendingOrderNumber(null);
    clearSavedChat();
  }

  return (
    <div translate="no" className="notranslate">
      <button
        onClick={() => setOpen(!open)}
        aria-label="ROELIX Luxury Home Textile Advisor"
        className="fixed bottom-6 end-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-navy text-gold shadow-lux transition hover:scale-105"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
      {open && (
        <div className="fixed bottom-24 end-6 z-40 flex h-[32rem] w-[23rem] max-w-[calc(100vw-3rem)] flex-col border bg-background shadow-lux animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-start justify-between bg-navy px-5 py-4 text-navy-foreground">
            <div>
              <p className="font-serif text-xl">ROELIX Luxury Home Textile Advisor</p>
              <p className="eyebrow text-gold">At your service</p>
            </div>
            <button
              onClick={reset}
              aria-label="New conversation"
              className="text-gold/80 hover:text-gold"
            >
              <RotateCcw size={16} />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={
                  m.from === "me"
                    ? "ms-auto max-w-[80%] bg-navy px-3 py-2 text-navy-foreground"
                    : "max-w-[90%] space-y-2"
                }
              >
                <div className={m.from === "bot" ? "whitespace-pre-wrap bg-muted px-3 py-2" : ""}>
                  {m.text}
                </div>
                {m.productIds
                  ?.map((id) => s.find(id))
                  .filter((p) => p && p.isPublished)
                  .map((p) => (
                    <Link
                      key={p!.id}
                      to="/product/$id"
                      params={{ id: p!.id }}
                      onClick={() => {
                        recordProductInteraction("product_click", p!.id, p!.name);
                        setOpen(false);
                      }}
                      className="flex items-center gap-3 border p-2 hover:border-gold"
                    >
                      <img src={p!.images[0]} alt="" className="h-12 w-10 object-cover" />
                      <div>
                        <p className="font-serif">{p!.name}</p>
                        <p className="text-xs text-muted-foreground">{s.fmt(p!.price)}</p>
                      </div>
                    </Link>
                  ))}
              </div>
            ))}
            {typing && (
              <div className="w-fit bg-muted px-3 py-2 text-muted-foreground animate-pulse">
                Your advisor is preparing a recommendation…
              </div>
            )}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => send(c)}
                    className="border px-3 py-1 text-xs hover:border-gold hover:text-gold"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div ref={end} />
          </div>
          <div className="flex border-t">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about fabrics, styling, orders…"
              className="flex-1 bg-transparent px-4 py-3 text-sm outline-none"
            />
            <button
              onClick={() => send()}
              disabled={typing}
              className="px-4 text-gold"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
