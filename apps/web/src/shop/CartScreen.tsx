/**
 * shop/CartScreen.tsx — корзина и оформление по стандартам Apple (iOS · Wallet).
 *
 * Полноэкранный коммерческий хаб (светлая iOS-grouped эстетика, как DonateModal):
 *   • Сегмент «Магазин ⇄ Корзина».
 *   • Магазин — сгруппированный inset-каталог: книги BBT, атрибуты, цифровое,
 *     пожертвование (выбор суммы). «+» добавляет; для добавленных — степпер −[n]+.
 *   • Корзина — строки со степпером, свайп-влево «Удалить», особая логика для
 *     цифровых товаров и пожертвования; сводка (товары · доставка · итого).
 *   • Оформление: Доставка (контакт + способ получения + адрес) → Оплата
 *     (Apple Pay при поддержке · карта с привязкой · СБП · USDT TRC20) →
 *     Подтверждение (Wallet-пасс чек). Заказ уходит команде письмом (/api/order).
 *
 * Реальные рельсы: крипта (адрес+QR), карта/СБП — защищённая страница ЮMoney.
 * «Привязка карты» хранит только бренд+последние4+срок (без номера/CVC).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import QRCode from "qrcode";
import {
  useCart, addToCart, setQty, removeFromCart, clearCart, qtyOf,
  fmtRub, lineTotal, subtotal, units, hasPhysical,
  shippingFor, SHIP_FREE_FROM, physicalSubtotal, makeOrderNo,
  readContact, writeContact, type Contact,
  useSavedCards, addSavedCard, removeSavedCard, type SavedCard,
  detectBrand, luhn, groupCard, formatExpiry, validExpiry,
  type CartLine, type ProductKind, type Product,
} from "./cart";
import { catalogNow, DONATION_PRESETS, donationProduct } from "./catalog";
import { useShop } from "./shopHydrate";

/* ───────── палитра (зеркало DonateModal/FavoritesScreen) ───────── */
const INK = "#1d1d1f";
const INK2 = "#6e6e73";
const INK3 = "#8e8e93";
const GROUPED = "#f2f2f7";
const CARD = "#ffffff";
const LINE = "rgba(60,60,67,0.11)";
const HAIR = "rgba(60,60,67,0.10)";
const FILL = "rgba(118,118,128,0.12)";
const BLUE = "#9c7c15";
const GREEN = "#34c759";
const OK = "#1d9e75";
const RED = "#ff3b30";
const GOLD = "#D2AA1B";
const GOLDT = "#9c7c15";

const USDT_TRC20 = "TRqkjRb8g4Yf3Ew9VoM9YxB1EETnTcB5Gp";
const YOOMONEY_URL = "https://yoomoney.ru/fundraise/1I77BODCCS9.260605";

/* ───────── иконки (STROKE-стиль приложения) ───────── */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ic = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const Close = ({ size = 13 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="#8a8a8e" strokeWidth="1.9" strokeLinecap="round" aria-hidden><path d="M2 2l10 10M12 2L2 12" /></svg>;
const Back = ({ size = 23 }: { size?: number }) => <svg {...ic(size)}><path {...S} d="M15 5l-7 7 7 7" /></svg>;
const Bag = ({ size = 30 }: { size?: number }) => <svg {...ic(size)}><path {...S} d="M5.4 7.5h13.2a1 1 0 0 1 1 1.1l-1.2 11.4a1.5 1.5 0 0 1-1.5 1.4H7.1a1.5 1.5 0 0 1-1.5-1.4L4.4 8.6a1 1 0 0 1 1-1.1Z" /><path {...S} d="M8 9V6.5a4 4 0 0 1 8 0V9" /></svg>;
const Plus = ({ size = 18 }: { size?: number }) => <svg {...ic(size)}><path {...S} strokeWidth="2.1" d="M12 5.5v13M5.5 12h13" /></svg>;
const Minus = ({ size = 18 }: { size?: number }) => <svg {...ic(size)}><path {...S} strokeWidth="2.1" d="M5.5 12h13" /></svg>;
const Trash = ({ size = 17, color = "#fff" }: { size?: number; color?: string }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path {...S} stroke={color} d="M5 7h14M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7 7l.8 12a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L18 7" /></svg>;
const Chevron = ({ size = 17 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ color: INK3, flexShrink: 0 }}><path {...S} d="M9 5l7 7-7 7" /></svg>;
const CheckMark = ({ size = 40, color = "#fff" }: { size?: number; color?: string }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4.5 4.5L19 7" /></svg>;
const Lock = ({ size = 13 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}><rect {...S} x="5" y="10.5" width="14" height="10" rx="2.4" /><path {...S} d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>;
const Truck = ({ size = 21 }: { size?: number }) => <svg {...ic(size)}><path {...S} d="M3 6.5h10v9H3zM13 9.5h4l3 3v3h-7z" /><circle {...S} cx="7" cy="17.5" r="1.8" /><circle {...S} cx="17" cy="17.5" r="1.8" /></svg>;
const Store = ({ size = 21 }: { size?: number }) => <svg {...ic(size)}><path {...S} d="M4 9.5 5 5h14l1 4.5a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 1 1-4.8 0Z" /><path {...S} d="M5 11.8V20h14v-8.2" /></svg>;
const CardIc = ({ size = 21 }: { size?: number }) => <svg {...ic(size)}><rect {...S} x="3" y="5.5" width="18" height="13" rx="2.6" /><path {...S} d="M3 9.5h18" /></svg>;
const CopyIc = ({ size = 18, color = INK2 }: { size?: number; color?: string }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>;
const QrIc = ({ size = 18, color = INK2 }: { size?: number; color?: string }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><path d="M14 14h3v3M20 14v.01M14 20h.01M17 20h.01M20 17v3" /></svg>;
const AppleLogo = ({ size = 18, color = "#fff" }: { size?: number; color?: string }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path fill={color} d="M16.4 12.8c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .6 1 1.4 2.1 2.4 2 .9 0 1.3-.6 2.5-.6 1.1 0 1.4.6 2.5.6 1 0 1.7-1 2.3-2 .4-.6.7-1.3.9-2-2-.7-2-2.8-2-2.8ZM14.4 6.9c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.2 1.2-.5.5-.9 1.4-.8 2.3.9 0 1.7-.5 2.2-1.1Z" /></svg>;
const RadioDot = ({ on }: { on: boolean }) => (
  <span aria-hidden style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", border: on ? "none" : `1.6px solid ${INK3}`, background: on ? BLUE : "transparent", transition: "background .15s,border-color .15s" }}>
    {on && <CheckMark size={13} color="#fff" />}
  </span>
);
const Emblem = ({ size = 44, color = GOLD }: { size?: number; color?: string }) => (
  <span role="img" aria-label="ISKCON ONE LOVE" style={{ display: "block", height: size, width: size, backgroundColor: color, WebkitMaskImage: "url(/iskcon-sign.svg)", maskImage: "url(/iskcon-sign.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
);

/* ───────── мелкие примитивы ───────── */
function SectionLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: INK3, margin: "0 0 9px 16px" }}>{children}</div>;
}
function Footnote({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12.5, lineHeight: 1.45, color: INK3, margin: "9px 16px 0" }}>{children}</div>;
}
function GroupCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: CARD, borderRadius: 14, overflow: "hidden", ...style }}>{children}</div>;
}
function Spinner() {
  return <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", display: "inline-block", animation: "iolspin .7s linear infinite" }} />;
}
function Primary({ children, onClick, disabled, color = INK, busy }: { children: ReactNode; onClick: () => void; disabled?: boolean; color?: string; busy?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", height: 54, borderRadius: 14, border: "none",
        background: disabled ? "rgba(60,60,67,0.18)" : color, color: "#fff", fontFamily: "var(--font-text)", fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em",
        cursor: disabled || busy ? "default" : "pointer", opacity: busy ? 0.75 : 1, transition: "opacity .15s,background .15s", WebkitTapHighlightColor: "transparent" }}>
      {busy ? <Spinner /> : children}
    </button>
  );
}

/* ───────── обложка/плитка товара ───────── */
function Thumb({ line, size = 56 }: { line: { cover?: string; emblem?: boolean; kind: ProductKind; title: string }; size?: number }) {
  if (line.emblem || line.kind === "donation") {
    return <span style={{ flexShrink: 0, width: size, height: size, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#fbf4d8,#f1e1a4)", border: `0.5px solid ${GOLD}55` }}><Emblem size={Math.round(size * 0.6)} color={GOLDT} /></span>;
  }
  if (line.cover) {
    return <img src={line.cover} alt="" loading="lazy" style={{ flexShrink: 0, width: size, height: size, borderRadius: 11, objectFit: "cover", background: FILL }} />;
  }
  const initial = (line.title.trim()[0] || "•").toUpperCase();
  return <span style={{ flexShrink: 0, width: size, height: size, borderRadius: 12, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#eef0f4,#e2e5ea)", color: INK2, fontFamily: "var(--font-display)", fontSize: size * 0.42, fontWeight: 700 }}>{initial}</span>;
}

/* ───────── степпер −[n]+ ───────── */
function Stepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  const btn: CSSProperties = { display: "grid", placeItems: "center", width: 32, height: 32, border: "none", background: "transparent", color: INK, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", background: FILL, borderRadius: 999, height: 34 }} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Меньше" onClick={onDec} style={btn}>{qty <= 1 ? <Trash size={15} color={RED} /> : <Minus size={16} />}</button>
      <span style={{ minWidth: 22, textAlign: "center", fontSize: 15.5, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{qty}</span>
      <button type="button" aria-label="Больше" onClick={onInc} style={btn}><Plus size={16} /></button>
    </div>
  );
}

/* ───────── input-строка iOS grouped ───────── */
function Field({ label, value, onChange, placeholder, type = "text", inputMode, autoComplete, maxLength, first, last, invalid, mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; inputMode?: "text" | "numeric" | "tel" | "email" | "decimal"; autoComplete?: string;
  maxLength?: number; first?: boolean; last?: boolean; invalid?: boolean; mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "8px 16px", borderTop: first ? "none" : `0.5px solid ${HAIR}` }}>
      <label style={{ flexShrink: 0, width: 96, fontSize: 14.5, color: INK2 }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} inputMode={inputMode} autoComplete={autoComplete} maxLength={maxLength}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", textAlign: "right",
          fontFamily: mono ? "ui-monospace,SFMono-Regular,Menlo,monospace" : "var(--font-text)", fontSize: 15.5, color: invalid ? RED : INK, letterSpacing: mono ? "0.02em" : 0 }} />
    </div>
  );
}

/* ═══════════════════════ КАТАЛОГ (Магазин) ═══════════════════════ */
function CatalogRow({ p, first, onAdd }: { p: Product; first: boolean; onAdd: () => void }) {
  const q = qtyOf(p.id);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: first ? "none" : `0.5px solid ${HAIR}`, background: CARD }}>
      <Thumb line={p} size={54} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em", color: INK, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.title}</div>
        {p.subtitle && <div style={{ marginTop: 2, fontSize: 12.5, color: INK3, lineHeight: 1.3 }}>{p.subtitle}</div>}
        <div style={{ marginTop: 4, fontSize: 14.5, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{fmtRub(p.price)}</div>
      </div>
      {q > 0 ? (
        <Stepper qty={q} onDec={() => setQty(p.id, q - 1)} onInc={() => setQty(p.id, q + 1)} />
      ) : (
        <button type="button" aria-label="В корзину" onClick={onAdd} style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "50%", border: "none", background: BLUE, color: "#fff", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Plus size={18} /></button>
      )}
    </div>
  );
}
function CatalogView({ onAskDonation }: { onAskDonation: () => void }) {
  useCart();
  useShop();   // реактивная гидрация каталога магазина из БД (сид → БД)
  const donQty = qtyOf("donation");
  return (
    <div style={{ padding: "12px 16px calc(28px + env(safe-area-inset-bottom,0px))" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: INK2, lineHeight: 1.5, margin: "2px 2px 18px" }}>
        Книги, атрибуты и цифровые материалы. Каждая покупка поддерживает миссию Шрилы Прабхупады.
      </div>
      {catalogNow().map((g) => (
        <section key={g.key} style={{ marginBottom: 22 }}>
          <SectionLabel>{g.title}</SectionLabel>
          <GroupCard>
            {g.items.map((p, i) => <CatalogRow key={p.id} p={p} first={i === 0} onAdd={() => addToCart(p)} />)}
          </GroupCard>
          {g.note && <Footnote>{g.note}</Footnote>}
        </section>
      ))}
      <section style={{ marginBottom: 8 }}>
        <SectionLabel>Пожертвование</SectionLabel>
        <GroupCard>
          <button type="button" onClick={onAskDonation} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", border: "none", background: CARD, cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
            <Thumb line={{ emblem: true, kind: "donation", title: "Пожертвование" }} size={54} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 600, color: INK, letterSpacing: "-0.01em" }}>Поддержать проект</div>
              <div style={{ marginTop: 2, fontSize: 12.5, color: INK3 }}>{donQty > 0 ? "Сумма добавлена в корзину" : "Любая сумма · ISKCON ONE LOVE"}</div>
            </div>
            <Chevron />
          </button>
        </GroupCard>
        <Footnote>Распространение книг и развитие онлайн-проекта ISKCON ONE LOVE.</Footnote>
      </section>
    </div>
  );
}

/* ═══════════════════════ СТРОКА КОРЗИНЫ ═══════════════════════ */
function CartLineRow({ line, reduce, onEditDonation }: { line: CartLine; reduce: boolean; onEditDonation: () => void }) {
  const [dx, setDx] = useState(0);
  const [removing, setRemoving] = useState(false);
  const drag = useRef(false); const moved = useRef(false); const start = useRef(0);
  const REVEAL = 86, THRESH = 132;
  const id = line.product.id;
  const commit = () => { if (reduce) { removeFromCart(id); return; } setRemoving(true); window.setTimeout(() => removeFromCart(id), 240); };
  const onDown = (e: React.PointerEvent) => { drag.current = true; moved.current = false; start.current = e.clientX - dx; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ } };
  const onMove = (e: React.PointerEvent) => { if (!drag.current) return; let nx = e.clientX - start.current; if (nx > 0) nx = 0; if (nx < -168) nx = -168; if (Math.abs(nx - dx) > 2) moved.current = true; setDx(nx); };
  const onUp = () => { if (!drag.current) return; drag.current = false; if (-dx >= THRESH) commit(); else setDx(-dx >= REVEAL * 0.55 ? -REVEAL : 0); };
  const k = line.product.kind;
  return (
    <div style={{ position: "relative", maxHeight: removing ? 0 : 260, opacity: removing ? 0 : 1, overflow: "hidden", transition: reduce ? "none" : "max-height .24s ease,opacity .2s ease" }}>
      <button type="button" aria-label="Удалить" onClick={commit} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, paddingRight: 22, background: RED, color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600 }}>
        <Trash size={17} /> Удалить
      </button>
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: CARD, transform: `translateX(${dx}px)`, transition: drag.current ? "none" : "transform .26s cubic-bezier(.22,.61,.36,1)", touchAction: "pan-y" }}>
        <Thumb line={line.product} size={58} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em", color: INK, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{line.product.title}</div>
          {line.product.subtitle && <div style={{ marginTop: 2, fontSize: 12.5, color: INK3 }}>{line.product.subtitle}</div>}
          <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 10 }}>
            {k === "physical" && <Stepper qty={line.qty} onDec={() => setQty(id, line.qty - 1)} onInc={() => setQty(id, line.qty + 1)} />}
            {k === "digital" && <span style={{ fontSize: 12.5, fontWeight: 600, color: INK2, background: FILL, borderRadius: 999, padding: "5px 11px" }}>Цифровой товар</span>}
            {k === "donation" && <button type="button" onClick={onEditDonation} style={{ fontSize: 13, fontWeight: 600, color: BLUE, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>Изменить сумму</button>}
            <span style={{ marginLeft: "auto", fontSize: 15, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{fmtRub(lineTotal(line))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
const KIND_TITLE: Record<ProductKind, string> = { physical: "Товары с доставкой", digital: "Цифровые материалы", donation: "Пожертвование" };
function CartView({ lines, onEditDonation }: { lines: CartLine[]; onEditDonation: () => void }) {
  const reduce = useMemo(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  const groups: ProductKind[] = ["physical", "digital", "donation"];
  return (
    <div style={{ padding: "12px 16px 4px" }}>
      {groups.map((g) => {
        const items = lines.filter((l) => l.product.kind === g);
        if (!items.length) return null;
        return (
          <section key={g} style={{ marginBottom: 20 }}>
            <SectionLabel>{KIND_TITLE[g]}</SectionLabel>
            <GroupCard>{items.map((l) => <CartLineRow key={l.product.id} line={l} reduce={reduce} onEditDonation={onEditDonation} />)}</GroupCard>
          </section>
        );
      })}
      <Footnote>Свайп влево по строке — удалить. Цифровые товары и пожертвование не требуют доставки.</Footnote>
    </div>
  );
}

/* ═══════════════════════ ДОСТАВКА ═══════════════════════ */
function DeliveryView({ contact, set }: { contact: Contact; set: (c: Contact) => void }) {
  const f = (k: keyof Contact) => (v: string) => set({ ...contact, [k]: v });
  return (
    <div style={{ padding: "14px 16px calc(28px + env(safe-area-inset-bottom,0px))" }}>
      <SectionLabel>Контакт</SectionLabel>
      <GroupCard>
        <Field first label="Имя" value={contact.name} onChange={f("name")} placeholder="Имя и фамилия" autoComplete="name" />
        <Field label="Телефон" value={contact.phone} onChange={f("phone")} placeholder="+7 900 000-00-00" inputMode="tel" autoComplete="tel" />
        <Field last label="Email" value={contact.email} onChange={f("email")} placeholder="you@example.com" inputMode="email" type="email" autoComplete="email" />
      </GroupCard>

      <div style={{ height: 18 }} />
      <SectionLabel>Способ получения</SectionLabel>
      <div style={{ display: "flex", gap: 10 }}>
        {([["delivery", "Доставка", <Truck key="t" />, "от 300 ₽"], ["pickup", "Самовывоз", <Store key="s" />, "бесплатно"]] as const).map(([id, label, icon, hint]) => {
          const on = contact.method === id;
          return (
            <button key={id} type="button" onClick={() => set({ ...contact, method: id })}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "13px 14px", borderRadius: 14, cursor: "pointer", textAlign: "left", border: on ? `1.6px solid ${BLUE}` : `1px solid ${LINE}`, background: CARD, WebkitTapHighlightColor: "transparent" }}>
              <span style={{ color: on ? BLUE : INK2 }}>{icon}</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: INK }}>{label}</span>
              <span style={{ fontSize: 12, color: INK3 }}>{hint}</span>
            </button>
          );
        })}
      </div>

      {contact.method === "delivery" && (
        <>
          <div style={{ height: 18 }} />
          <SectionLabel>Адрес доставки</SectionLabel>
          <GroupCard>
            <Field first label="Страна" value={contact.country} onChange={f("country")} placeholder="Россия" autoComplete="country-name" />
            <Field label="Город" value={contact.city} onChange={f("city")} placeholder="Москва" autoComplete="address-level2" />
            <Field label="Адрес" value={contact.street} onChange={f("street")} placeholder="Улица, дом, квартира" autoComplete="street-address" />
            <Field label="Индекс" value={contact.zip} onChange={f("zip")} placeholder="000000" inputMode="numeric" autoComplete="postal-code" maxLength={6} />
            <Field last label="Комментарий" value={contact.note} onChange={f("note")} placeholder="Подъезд, домофон…" />
          </GroupCard>
        </>
      )}
      <Footnote>Данные сохраняются только на вашем устройстве и передаются команде вместе с заказом.</Footnote>
    </div>
  );
}

/* ═══════════════════════ ОПЛАТА ═══════════════════════ */
type PayMethod = "card" | "sbp" | "crypto";
function PayRow({ icon, title, sub, on, onClick, withTop }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; on: boolean; onClick: () => void; withTop?: boolean }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, padding: "10px 16px", border: "none", borderTop: withTop ? `0.5px solid ${HAIR}` : "none", background: CARD, cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
      <span style={{ flexShrink: 0, color: INK }}>{icon}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 15.5, fontWeight: 500, color: INK, lineHeight: 1.25 }}>{title}</span>
        {sub && <span style={{ display: "block", marginTop: 1, fontSize: 12.5, color: INK3 }}>{sub}</span>}
      </span>
      <RadioDot on={on} />
    </button>
  );
}
function SbpMark() { return <span style={{ display: "inline-grid", placeItems: "center", width: 21, height: 21, borderRadius: 5, background: "linear-gradient(135deg,#f9a01b,#7b1fa2 55%,#1aa5b8)", color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "-0.5px" }}>СБП</span>; }
function UsdtMark() { return <span style={{ display: "inline-grid", placeItems: "center", width: 21, height: 21, borderRadius: "50%", background: "#26a17b", color: "#fff", fontSize: 13, fontWeight: 800 }}>₮</span>; }
const brandGlyph = (b: string) => b === "visa" ? "VISA" : b === "mc" ? "MC" : b === "mir" ? "Мир" : b === "amex" ? "AMEX" : b === "unionpay" ? "UP" : "Карта";

function PaymentView({ method, setMethod, total, cards, selCard, setSelCard, onAddCard, applePay, onExpress, copied, onCopy, showQr, setShowQr, qr }: {
  method: PayMethod; setMethod: (m: PayMethod) => void; total: number; cards: SavedCard[]; selCard: string | null; setSelCard: (id: string | null) => void; onAddCard: () => void;
  applePay: boolean; onExpress: () => void; copied: boolean; onCopy: () => void; showQr: boolean; setShowQr: (v: boolean) => void; qr: string;
}) {
  return (
    <div style={{ padding: "14px 16px calc(28px + env(safe-area-inset-bottom,0px))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: CARD, borderRadius: 14, padding: "14px 16px", marginBottom: 18 }}>
        <span style={{ fontSize: 14.5, color: INK2 }}>К оплате</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: INK, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmtRub(total)}</span>
      </div>

      {applePay && (
        <>
          <button type="button" onClick={onExpress} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", height: 50, borderRadius: 13, border: "none", background: "#000", color: "#fff", fontFamily: "var(--font-text)", fontSize: 18, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.01em", WebkitTapHighlightColor: "transparent" }}>
            <AppleLogo size={20} /> Pay
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 2px 14px", color: INK3 }}>
            <span style={{ flex: 1, height: 0.5, background: LINE }} /><span style={{ fontSize: 12 }}>или способ оплаты</span><span style={{ flex: 1, height: 0.5, background: LINE }} />
          </div>
        </>
      )}

      {!applePay && <SectionLabel>Способ оплаты</SectionLabel>}
      <GroupCard>
        <PayRow icon={<CardIc />} title="Банковская карта" sub={cards.length ? `${cards.length} сохранённых · Visa · Mastercard · Мир` : "Visa · Mastercard · Мир"} on={method === "card"} onClick={() => setMethod("card")} />
        {method === "card" && (
          <div style={{ background: "rgba(118,118,128,0.06)", padding: "2px 0 6px" }}>
            {cards.map((c) => {
              const on = selCard === c.id;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 16px 9px 22px" }}>
                  <span style={{ flexShrink: 0, display: "grid", placeItems: "center", minWidth: 40, height: 24, padding: "0 6px", borderRadius: 5, background: "#1d1d1f", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.02em" }}>{brandGlyph(c.brand)}</span>
                  <button type="button" onClick={() => setSelCard(on ? null : c.id)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", padding: 0 }}>
                    <span style={{ fontSize: 14.5, color: INK, fontVariantNumeric: "tabular-nums" }}>•••• {c.last4}</span>
                    <span style={{ fontSize: 12, color: INK3 }}>{c.exp}</span>
                    <span style={{ marginLeft: "auto" }}><RadioDot on={on} /></span>
                  </button>
                  <button type="button" aria-label="Удалить карту" onClick={() => { removeSavedCard(c.id); if (on) setSelCard(null); }} style={{ flexShrink: 0, border: "none", background: "transparent", color: INK3, cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}><Trash size={15} color={INK3} /></button>
                </div>
              );
            })}
            <button type="button" onClick={onAddCard} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 16px 10px 22px", border: "none", background: "transparent", color: BLUE, cursor: "pointer", textAlign: "left", fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>
              <Plus size={16} /> Добавить карту
            </button>
          </div>
        )}
        <PayRow withTop icon={<SbpMark />} title="СБП — Система быстрых платежей" sub="Оплата по QR в приложении банка" on={method === "sbp"} onClick={() => setMethod("sbp")} />
        <PayRow withTop icon={<UsdtMark />} title="Криптовалюта · USDT" sub="Сеть TRC20 (Tron)" on={method === "crypto"} onClick={() => setMethod("crypto")} />
      </GroupCard>

      {method !== "crypto" && (
        <Footnote><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Lock /> Оплата проходит на защищённой странице ЮMoney. Карта хранится как «•••• последние 4» — без полного номера и CVC.</span></Footnote>
      )}

      {method === "crypto" && (
        <div style={{ marginTop: 16 }}>
          <SectionLabel>Адрес USDT (TRC20)</SectionLabel>
          <GroupCard>
            <div style={{ padding: "14px 16px 13px" }}>
              <div style={{ fontSize: 11.5, color: INK3, marginBottom: 5 }}>Кошелёк</div>
              <code style={{ display: "block", fontSize: 13.5, lineHeight: 1.4, color: INK, wordBreak: "break-all", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" }}>{USDT_TRC20}</code>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: INK }}>Сумма: {fmtRub(total)} <span style={{ color: INK3, fontWeight: 400 }}>· отправьте эквивалент в USDT</span></div>
            </div>
            <button onClick={onCopy} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, padding: "0 16px", border: "none", borderTop: `0.5px solid ${HAIR}`, background: "transparent", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 15.5, fontWeight: 500, color: copied ? OK : INK, textAlign: "left" }}>
              <CopyIc color={copied ? OK : INK2} /><span style={{ flex: 1 }}>{copied ? "Адрес скопирован" : "Копировать адрес"}</span>{copied && <CheckMark size={16} color={OK} />}
            </button>
            <button onClick={() => setShowQr(!showQr)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, padding: "0 16px", border: "none", borderTop: `0.5px solid ${HAIR}`, background: "transparent", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 15.5, fontWeight: 500, color: INK, textAlign: "left" }}>
              <QrIc /><span style={{ flex: 1 }}>{showQr ? "Скрыть QR-код" : "Показать QR-код"}</span><span style={{ color: INK3, fontSize: 11 }}>{showQr ? "▲" : "▼"}</span>
            </button>
            {showQr && (
              <div style={{ borderTop: `0.5px solid ${HAIR}`, padding: 18, display: "grid", placeItems: "center" }}>
                <div style={{ width: 196, height: 196, display: "grid", placeItems: "center", borderRadius: 14, background: "#fff", boxShadow: `0 0 0 0.5px ${HAIR}` }}>
                  {qr ? <img src={qr} alt="QR USDT TRC20" width={172} height={172} style={{ display: "block" }} /> : <span style={{ fontSize: 13, color: INK3 }}>Генерация…</span>}
                </div>
              </div>
            )}
          </GroupCard>
          <Footnote>Отправляйте только USDT в сети TRC20 (Tron). После перевода нажмите «Я оплатил» — мы подтвердим заказ.</Footnote>
        </div>
      )}
    </div>
  );
}

/* ───────── лист добавления карты ───────── */
function CardSheet({ onClose, onSave }: { onClose: () => void; onSave: (c: { brand: string; brandLabel: string; last4: string; exp: string }) => void }) {
  const [num, setNum] = useState(""); const [exp, setExp] = useState(""); const [cvc, setCvc] = useState(""); const [name, setName] = useState("");
  const digits = num.replace(/\D/g, "");
  const brand = detectBrand(digits);
  const numOk = luhn(digits); const expOk = validExpiry(exp); const cvcOk = cvc.replace(/\D/g, "").length >= 3;
  const ok = numOk && expOk && cvcOk;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1600, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.42)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: GROUPED, borderRadius: "24px 24px 0 0", padding: "10px 16px calc(20px + env(safe-area-inset-bottom,0px))", maxHeight: "92dvh", overflowY: "auto", fontFamily: "var(--font-text)" }}>
        <div style={{ width: 38, height: 5, borderRadius: 3, background: "rgba(60,60,67,0.3)", margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ flex: 1, margin: 0, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>Новая карта</h2>
          <span style={{ display: "inline-grid", placeItems: "center", minWidth: 46, height: 26, padding: "0 8px", borderRadius: 6, background: "#1d1d1f", color: "#fff", fontSize: 11, fontWeight: 800 }}>{brand.label}</span>
        </div>
        <GroupCard>
          <Field first mono label="Номер" value={num} onChange={(v) => setNum(groupCard(v))} placeholder="0000 0000 0000 0000" inputMode="numeric" autoComplete="cc-number" maxLength={24} invalid={digits.length >= 13 && !numOk} />
          <Field mono label="Срок" value={exp} onChange={(v) => setExp(formatExpiry(v))} placeholder="ММ/ГГ" inputMode="numeric" autoComplete="cc-exp" maxLength={5} invalid={exp.length === 5 && !expOk} />
          <Field mono label="CVC" value={cvc} onChange={(v) => setCvc(v.replace(/\D/g, "").slice(0, 4))} placeholder="•••" inputMode="numeric" autoComplete="cc-csc" maxLength={4} />
          <Field last label="Владелец" value={name} onChange={(v) => setName(v.toUpperCase())} placeholder="IVAN IVANOV" autoComplete="cc-name" />
        </GroupCard>
        <Footnote><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Lock /> Сохраняются только бренд, последние 4 цифры и срок. Полный номер и CVC не хранятся.</span></Footnote>
        <div style={{ marginTop: 18 }}>
          <Primary onClick={() => { if (ok) onSave({ brand: brand.id, brandLabel: brand.label, last4: digits.slice(-4), exp }); }} disabled={!ok}>Сохранить карту</Primary>
        </div>
      </div>
    </div>
  );
}

/* ───────── лист выбора суммы пожертвования ───────── */
function AmountSheet({ initial, onClose, onApply }: { initial: number; onClose: () => void; onApply: (a: number) => void }) {
  const [val, setVal] = useState(initial ? String(initial) : "");
  const n = Math.max(0, Math.round(+val.replace(/\D/g, "") || 0));
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1600, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.42)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: GROUPED, borderRadius: "24px 24px 0 0", padding: "10px 16px calc(20px + env(safe-area-inset-bottom,0px))", fontFamily: "var(--font-text)" }}>
        <div style={{ width: 38, height: 5, borderRadius: 3, background: "rgba(60,60,67,0.3)", margin: "0 auto 14px" }} />
        <h2 style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>Сумма пожертвования</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {DONATION_PRESETS.map((p) => {
            const on = n === p;
            return <button key={p} type="button" onClick={() => setVal(String(p))} style={{ flex: 1, height: 44, borderRadius: 12, border: on ? `1.6px solid ${GOLD}` : `1px solid ${LINE}`, background: on ? `${GOLD}1a` : CARD, color: INK, fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontVariantNumeric: "tabular-nums", WebkitTapHighlightColor: "transparent" }}>{p}</button>;
          })}
        </div>
        <GroupCard>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px" }}>
            <input value={val} onChange={(e) => setVal(e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="Другая сумма" inputMode="numeric"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-text)", fontSize: 22, fontWeight: 700, color: INK, letterSpacing: "-0.02em" }} />
            <span style={{ fontSize: 22, fontWeight: 700, color: INK3 }}>₽</span>
          </div>
        </GroupCard>
        <div style={{ marginTop: 18 }}>
          <Primary onClick={() => { if (n > 0) onApply(n); }} disabled={n <= 0} color={GOLDT}>{n > 0 ? `Добавить ${fmtRub(n)}` : "Укажите сумму"}</Primary>
        </div>
      </div>
    </div>
  );
}

/* ───────── сегмент-контрол ───────── */
function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode }[] }) {
  return (
    <div style={{ display: "flex", width: "100%", background: FILL, borderRadius: 10, padding: 2, gap: 2 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={on}
            style={{ flex: 1, height: 32, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600,
              color: on ? INK : INK2, background: on ? CARD : "transparent", boxShadow: on ? "0 1px 4px rgba(0,0,0,0.12),0 0 0 0.5px rgba(0,0,0,0.04)" : "none",
              transition: "background .18s,color .18s", WebkitTapHighlightColor: "transparent" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────── пустая корзина ───────── */
function EmptyCart({ onShop }: { onShop: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "64px 40px" }}>
      <span style={{ display: "grid", placeItems: "center", width: 76, height: 76, borderRadius: "50%", background: FILL, color: INK3 }}><Bag size={34} /></span>
      <h2 style={{ margin: "20px 0 0", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>Корзина пуста</h2>
      <p style={{ margin: "8px 0 20px", fontSize: 14.5, lineHeight: 1.5, color: INK2, maxWidth: 280 }}>Загляните в магазин: книги, атрибуты для практики и цифровые материалы.</p>
      <button type="button" onClick={onShop} style={{ height: 46, padding: "0 22px", borderRadius: 13, border: "none", background: INK, color: "#fff", fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Перейти в магазин</button>
    </div>
  );
}

/* ───────── сводка корзины ───────── */
function Summary({ goods, shipping, total, physical, lines }: { goods: number; shipping: number; total: number; physical: boolean; lines: CartLine[] }) {
  const toFree = SHIP_FREE_FROM - physicalSubtotal(lines);
  return (
    <div style={{ padding: "4px 16px calc(28px + env(safe-area-inset-bottom,0px))" }}>
      <SectionLabel>Итог</SectionLabel>
      <div style={{ background: CARD, borderRadius: 14, padding: "12px 16px" }}>
        <KvLine k="Товары" v={fmtRub(goods)} />
        {physical && <KvLine k="Доставка" v={shipping === 0 ? "Бесплатно" : fmtRub(shipping)} />}
        <div style={{ height: 0.5, background: HAIR, margin: "8px 0" }} />
        <KvLine k="Итого" v={fmtRub(total)} strong />
      </div>
      {physical && shipping > 0 && toFree > 0 && <Footnote>До бесплатной доставки — {fmtRub(toFree)}.</Footnote>}
    </div>
  );
}
function KvLine({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "3px 0" }}>
      <span style={{ fontSize: strong ? 17 : 14.5, fontWeight: strong ? 700 : 400, color: strong ? INK : INK2 }}>{k}</span>
      <span style={{ fontSize: strong ? 19 : 14.5, fontWeight: strong ? 800 : 600, color: INK, letterSpacing: strong ? "-0.01em" : 0, fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
}

/* ═══════════════════════ ПОДТВЕРЖДЕНИЕ (Wallet-пасс) ═══════════════════════ */
interface Placed { orderNo: string; lines: CartLine[]; goods: number; shipping: number; total: number; methodLabel: string; contact: Contact; physical: boolean; }
function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    const out: number[] = [];
    const s = (seed + "IOL824519").repeat(4);
    for (let i = 0; i < 56; i++) out.push(1 + (s.charCodeAt(i) % 4));
    return out;
  }, [seed]);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 40, justifyContent: "center" }}>
      {bars.map((w, i) => <span key={i} style={{ width: w, height: "100%", background: i % 2 ? "transparent" : INK, borderRadius: 0.5 }} />)}
    </div>
  );
}
function DoneView({ o, onDone }: { o: Placed; onDone: () => void }) {
  const itemsCount = units(o.lines);
  const where = o.physical ? (o.contact.method === "pickup" ? "Самовывоз" : `Доставка · ${[o.contact.city, o.contact.street].filter(Boolean).join(", ") || "адрес уточняется"}`) : "Цифровая доставка";
  const [paid, setPaid] = useState(false);
  // Живой опрос статуса: «Ожидает оплаты» → «Оплата получена», когда команда/верификатор подтвердит.
  useEffect(() => {
    if (paid) return;
    let stop = false, n = 0;
    const tick = () => {
      if (stop) return;
      fetch(`/api/order/${encodeURIComponent(o.orderNo)}`, { headers: { accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { status?: string } | null) => { if (j && j.status === "paid") { setPaid(true); return; } if (++n < 40 && !stop) timer = window.setTimeout(tick, 5000); })
        .catch(() => { if (++n < 40 && !stop) timer = window.setTimeout(tick, 5000); });
    };
    let timer = window.setTimeout(tick, 4000);
    return () => { stop = true; clearTimeout(timer); };
  }, [o.orderNo, paid]);
  return (
    <div style={{ padding: "8px 16px calc(28px + env(safe-area-inset-bottom,0px))", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ textAlign: "center", padding: "14px 0 22px" }}>
        <span style={{ display: "grid", placeItems: "center", width: 74, height: 74, borderRadius: "50%", background: GOLD, margin: "0 auto", boxShadow: "0 10px 30px rgba(210,170,27,0.4)" }}><CheckMark size={42} color="#fff" /></span>
        <h1 style={{ margin: "18px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>Заказ оформлен</h1>
        <p style={{ margin: "9px auto 0", maxWidth: 300, fontSize: 14, lineHeight: 1.5, color: INK2 }}>{paid ? "Оплата получена. Мы приступаем к обработке заказа." : "Состав заказа отправлен команде. Подтвердим оплату — статус обновится здесь."}</p>
      </div>

      <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 18px 50px rgba(0,0,0,0.18)", background: CARD }}>
        <div style={{ background: "linear-gradient(150deg,#23232a,#0e0e12)", color: "#fff", padding: "20px 20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Emblem size={34} color={GOLD} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>ISKCON ONE LOVE</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Заказ {o.orderNo}</div>
            </div>
            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, ...(paid ? { background: "rgba(52,199,89,0.25)", color: "#5ee07f" } : { background: "rgba(210,170,27,0.25)", color: "#f2cf4f" }) }}>{paid ? "Оплата получена" : "Ожидает оплаты"}</span>
          </div>
          <div style={{ display: "flex", gap: 26, marginTop: 18 }}>
            <div><div style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Сумма</div><div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em" }}>{fmtRub(o.total)}</div></div>
            <div><div style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Позиций</div><div style={{ fontSize: 21, fontWeight: 800 }}>{itemsCount}</div></div>
          </div>
        </div>
        <div style={{ position: "relative", height: 22 }}>
          <span style={{ position: "absolute", left: -11, top: 0, width: 22, height: 22, borderRadius: "50%", background: GROUPED }} />
          <span style={{ position: "absolute", right: -11, top: 0, width: 22, height: 22, borderRadius: "50%", background: GROUPED }} />
          <span style={{ position: "absolute", left: 16, right: 16, top: 10.5, height: 0, borderTop: `1.5px dashed ${LINE}` }} />
        </div>
        <div style={{ padding: "6px 20px 20px" }}>
          {o.lines.map((l) => (
            <div key={l.product.id} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "5px 0" }}>
              <span style={{ minWidth: 0, flex: 1, fontSize: 14, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.product.title}{l.product.kind === "physical" && l.qty > 1 ? ` ×${l.qty}` : ""}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{fmtRub(lineTotal(l))}</span>
            </div>
          ))}
          <div style={{ height: 0.5, background: HAIR, margin: "10px 0" }} />
          <KvLine k="Получение" v={""} />
          <div style={{ marginTop: -8, fontSize: 13, color: INK2, lineHeight: 1.4 }}>{where}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: INK2 }}>Оплата: <span style={{ color: INK, fontWeight: 600 }}>{o.methodLabel}</span></div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `0.5px solid ${HAIR}` }}>
            <Barcode seed={o.orderNo} />
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 11.5, letterSpacing: "0.18em", color: INK3, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" }}>{o.orderNo}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}><Primary onClick={onDone} color={INK}>Готово</Primary></div>
      <Footnote>Вопросы по заказу — support@billionsx.com</Footnote>
    </div>
  );
}

/* ═══════════════════════ Apple Pay / отправка заказа ═══════════════════════ */
async function tryApplePay(total: number): Promise<boolean> {
  try {
    const PR = (window as unknown as { PaymentRequest?: typeof PaymentRequest }).PaymentRequest;
    if (!PR) return false;
    const pr = new PR(
      [{ supportedMethods: "https://apple.com/apple-pay", data: { version: 3, merchantIdentifier: "merchant.com.gaurangers", merchantCapabilities: ["supports3DS"], supportedNetworks: ["visa", "masterCard"], countryCode: "RU" } }],
      { total: { label: "ISKCON ONE LOVE", amount: { currency: "RUB", value: String(total) } } },
    );
    const can = await pr.canMakePayment().catch(() => false);
    if (!can) return false;
    const resp = await pr.show();
    await resp.complete("success");
    return true;
  } catch { return false; }
}
async function submitOrder(o: Placed, methodLabel: string): Promise<void> {
  try {
    await fetch("/api/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderNo: o.orderNo, total: o.total, goods: o.goods, shipping: o.shipping, method: methodLabel,
        items: o.lines.map((l) => ({ title: l.product.title, kind: l.product.kind, qty: l.product.kind === "donation" ? 1 : l.qty, sum: lineTotal(l) })),
        contact: o.contact,
        url: typeof location !== "undefined" ? location.href : "", ua: typeof navigator !== "undefined" ? navigator.userAgent : "", lang: typeof navigator !== "undefined" ? navigator.language : "",
      }),
    });
  } catch { /* best-effort */ }
}

/* ═══════════════════════ ГЛАВНЫЙ ЭКРАН ═══════════════════════ */
export default function CartScreen({ onClose }: { onClose: () => void }) {
  const lines = useCart();
  const cards = useSavedCards();
  const [view, setView] = useState<"cart" | "delivery" | "payment" | "done">("cart");
  const [tab, setTab] = useState<"shop" | "cart">("cart");
  const [contact, setContact] = useState<Contact>(() => readContact());
  const [method, setMethod] = useState<PayMethod>("card");
  const [selCard, setSelCard] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [showAmount, setShowAmount] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [applePay, setApplePay] = useState(false);

  const physical = hasPhysical(lines);
  const goods = subtotal(lines);
  const shipping = shippingFor(lines, contact.method);
  const total = goods + shipping;
  const count = units(lines);

  useEffect(() => { writeContact(contact); }, [contact]);
  useEffect(() => { try { const AP = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession; if (AP?.canMakePayments?.()) setApplePay(true); } catch { /* noop */ } }, []);
  useEffect(() => {
    if (method !== "crypto" || !showQr || qr) return;
    QRCode.toDataURL(USDT_TRC20, { margin: 1, width: 480, errorCorrectionLevel: "M", color: { dark: "#1d1d1f", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [method, showQr, qr]);
  useEffect(() => { if (lines.length === 0 && view !== "done") { setView("cart"); setTab("shop"); } }, [lines.length, view]);

  const back = () => {
    if (view === "delivery") { setView("cart"); return; }
    if (view === "payment") { setView(physical ? "delivery" : "cart"); return; }
    if (view === "done") { finish(); return; }
    onClose();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") back(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, physical]);

  const copy = () => { if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(USDT_TRC20).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1900); }).catch(() => {}); };
  const openAmount = () => setShowAmount(true);
  const applyDonation = (n: number) => { addToCart(donationProduct(n)); setShowAmount(false); setTab("cart"); };
  const saveCard = (c: { brand: string; brandLabel: string; last4: string; exp: string }) => { const card = addSavedCard(c); setSelCard(card.id); setMethod("card"); setShowCard(false); };

  const proceedFromCart = () => { if (!count) return; setView(physical ? "delivery" : "payment"); };
  const deliveryValid = contact.name.trim() !== "" && contact.phone.trim() !== "" && (contact.method === "pickup" || (contact.city.trim() !== "" && contact.street.trim() !== "" && contact.zip.trim() !== ""));
  const proceedFromDelivery = () => { if (deliveryValid) setView("payment"); };

  const finish = () => { clearCart(); setPlaced(null); onClose(); };

  const methodLabelFor = (express: boolean): string => {
    if (express) return "Apple Pay";
    if (method === "card") { const c = cards.find((x) => x.id === selCard); return c ? `Карта •••• ${c.last4}` : "Банковская карта"; }
    if (method === "sbp") return "СБП";
    return "USDT (TRC20)";
  };
  const pay = async (express = false) => {
    if (busy || !count) return;
    setBusy(true);
    const crypto = method === "crypto" && !express;
    if (express) { await tryApplePay(total); }
    const ml = methodLabelFor(express);
    const order: Placed = { orderNo: makeOrderNo(), lines: lines.slice(), goods, shipping, total, methodLabel: ml, contact, physical };
    await submitOrder(order, ml);
    if (!crypto) { try { window.open(YOOMONEY_URL, "_blank", "noopener,noreferrer"); } catch { /* noop */ } }
    setPlaced(order);
    setBusy(false);
    setView("done");
    clearCart();
  };

  const title = view === "delivery" ? "Доставка" : view === "payment" ? "Оплата" : view === "done" ? "Заказ" : "";
  const checkout = view === "delivery" || view === "payment";
  const steps = physical ? ["Доставка", "Оплата", "Готово"] : ["Оплата", "Готово"];
  const stepIdx = view === "delivery" ? 0 : view === "payment" ? (physical ? 1 : 0) : steps.length - 1;
  const footerVisible = (view === "cart" && count > 0) || view === "delivery" || view === "payment" || view === "done";

  const navBtn: CSSProperties = { display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: INK, cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: GROUPED, color: INK, fontFamily: "var(--font-text)", WebkitTapHighlightColor: "transparent" }}>
      <style>{"@keyframes iolspin{to{transform:rotate(360deg)}}"}</style>

      {/* навбар */}
      <header style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 8px", borderBottom: `0.5px solid ${HAIR}`, background: GROUPED }}>
        <button type="button" onClick={back} aria-label={view === "cart" ? "Закрыть" : "Назад"} style={navBtn}>{view === "cart" ? <Close size={15} /> : <Back />}</button>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "0 4px" }}>
          {view === "cart"
            ? <div style={{ width: "100%", maxWidth: 250 }}><Segmented value={tab} onChange={(v) => setTab(v)} options={[{ id: "shop", label: "Магазин" }, { id: "cart", label: count ? `Корзина · ${count}` : "Корзина" }]} /></div>
            : <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>{title}</span>}
        </div>
        {view === "cart" && tab === "cart" && count > 0
          ? <button type="button" onClick={() => clearCart()} style={{ flexShrink: 0, height: 38, padding: "0 10px", border: "none", background: "none", color: INK2, fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Очистить</button>
          : <span style={{ width: 40 }} />}
      </header>

      {/* прогресс оформления */}
      {checkout && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 16px 12px", background: GROUPED, borderBottom: `0.5px solid ${HAIR}` }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 11, fontWeight: 700, background: i <= stepIdx ? INK : FILL, color: i <= stepIdx ? "#fff" : INK3 }}>{i < stepIdx ? "✓" : i + 1}</span>
                <span style={{ fontSize: 12.5, fontWeight: i === stepIdx ? 700 : 500, color: i === stepIdx ? INK : INK3 }}>{s}</span>
              </span>
              {i < steps.length - 1 && <span style={{ width: 18, height: 0.5, background: i < stepIdx ? INK : LINE }} />}
            </div>
          ))}
        </div>
      )}

      {/* контент */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {view === "cart" && tab === "shop" && <CatalogView onAskDonation={openAmount} />}
        {view === "cart" && tab === "cart" && (count > 0
          ? <><CartView lines={lines} onEditDonation={openAmount} /><Summary goods={goods} shipping={shipping} total={total} physical={physical} lines={lines} /></>
          : <EmptyCart onShop={() => setTab("shop")} />)}
        {view === "delivery" && <DeliveryView contact={contact} set={setContact} />}
        {view === "payment" && (
          <PaymentView method={method} setMethod={setMethod} total={total} cards={cards} selCard={selCard} setSelCard={setSelCard} onAddCard={() => setShowCard(true)} applePay={applePay} onExpress={() => void pay(true)} copied={copied} onCopy={copy} showQr={showQr} setShowQr={setShowQr} qr={qr} />
        )}
        {view === "done" && placed && <DoneView o={placed} onDone={finish} />}
      </div>

      {/* нижняя панель */}
      {footerVisible && (
        <div style={{ flexShrink: 0, padding: "12px 16px calc(12px + env(safe-area-inset-bottom,0px))", background: "color-mix(in srgb, #f2f2f7 86%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderTop: `0.5px solid ${HAIR}` }}>
          {view === "cart" && (
            <Primary onClick={proceedFromCart} color={INK}>
              <span>Оформить</span>
              <span style={{ fontWeight: 800 }}>· {fmtRub(total)}</span>
            </Primary>
          )}
          {view === "delivery" && <Primary onClick={proceedFromDelivery} disabled={!deliveryValid} color={INK}>Продолжить</Primary>}
          {view === "payment" && (
            <Primary onClick={() => void pay(false)} busy={busy} color={method === "crypto" ? GOLDT : INK}>
              {method === "crypto" ? "Я оплатил" : <><span>Оплатить</span><span style={{ fontWeight: 800 }}>{fmtRub(total)}</span></>}
            </Primary>
          )}
          {view === "done" && <Primary onClick={finish} color={GREEN}>Готово</Primary>}
        </div>
      )}

      {showCard && <CardSheet onClose={() => setShowCard(false)} onSave={saveCard} />}
      {showAmount && <AmountSheet initial={lines.find((l) => l.product.kind === "donation")?.amount ?? 0} onClose={() => setShowAmount(false)} onApply={applyDonation} />}
    </div>
  );
}
