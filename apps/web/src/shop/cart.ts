/**
 * shop/cart.ts — товарная модель + клиентская корзина (без авторизации).
 *
 * Зеркало паттерна избранного (cardActions): localStorage + useSyncExternalStore,
 * синхронизация между вкладками через событие `storage`. Корзина — персональная
 * база устройства; хранится снимок товара (переживает правки каталога).
 *
 * Безопасность платежей: слой «привязки карты» хранит ТОЛЬКО бренд + последние 4
 * цифры + срок (НИКОГДА полный номер или CVC) — реальное списание идёт на
 * защищённой стороне процессинга. Контакт/адрес сохраняются для повторного ввода.
 */
import { useCallback, useSyncExternalStore } from "react";

export type ProductKind = "physical" | "digital" | "donation";

export interface Product {
  id: string;
  title: string;
  subtitle?: string;       // издание/формат
  kind: ProductKind;
  price: number;           // ₽, целые рубли (для donation — пресет)
  cover?: string;          // обложка/изображение
  emblem?: boolean;        // плитка с эмблемой вместо обложки (пожертвование)
  weightG?: number;        // вес для оценки доставки (физический товар)
}

export interface CartLine {
  product: Product;
  qty: number;
  amount?: number;         // donation: произвольная сумма (перекрывает price)
}

/* ─────────── деньги ─────────── */
const NBSP = "\u202f"; // узкий неразрывный пробел
export function fmtRub(n: number): string {
  const s = Math.round(n).toLocaleString("ru-RU").replace(/\s/g, NBSP);
  return `${s}${NBSP}₽`;
}

/* ─────────── строка/итог ─────────── */
export function lineUnit(l: CartLine): number {
  return l.product.kind === "donation" ? (l.amount ?? l.product.price) : l.product.price;
}
export function lineTotal(l: CartLine): number {
  return lineUnit(l) * (l.product.kind === "donation" ? 1 : l.qty);
}
export function subtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}
export function hasPhysical(lines: CartLine[]): boolean {
  return lines.some((l) => l.product.kind === "physical");
}
export function physicalSubtotal(lines: CartLine[]): number {
  return lines.filter((l) => l.product.kind === "physical").reduce((s, l) => s + lineTotal(l), 0);
}
export function units(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + (l.product.kind === "donation" ? 1 : l.qty), 0);
}

/* ─────────── хранилище корзины ─────────── */
const KEY = "cart:v1";
type Raw = { p: Product; q: number; a?: number };
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;
const EMPTY: CartLine[] = [];
function emit() { cache = null; listeners.forEach((l) => l()); }
function readRaw(): CartLine[] {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return [];
    const arr = JSON.parse(s) as Raw[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((r) => r && r.p && r.p.id)
      .map((r) => ({ product: r.p, qty: Math.max(1, Math.min(99, Math.round(r.q || 1))), amount: r.a }));
  } catch { return []; }
}
function write(lines: CartLine[]) {
  try { localStorage.setItem(KEY, JSON.stringify(lines.map((l) => ({ p: l.product, q: l.qty, a: l.amount })))); }
  catch { /* приватный режим */ }
  emit();
}
function snapshot(): CartLine[] { if (!cache) cache = readRaw(); return cache; }

export function addToCart(product: Product, qty = 1, amount?: number) {
  const lines = snapshot().slice();
  if (product.kind === "donation") {
    const i = lines.findIndex((l) => l.product.kind === "donation");
    const line: CartLine = { product, qty: 1, amount };
    if (i >= 0) lines[i] = line; else lines.push(line);
    write(lines); return;
  }
  const i = lines.findIndex((l) => l.product.id === product.id);
  if (i >= 0) lines[i] = { ...lines[i], qty: Math.min(99, lines[i].qty + qty) };
  else lines.push({ product, qty: Math.max(1, qty) });
  write(lines);
}
export function setQty(id: string, qty: number) {
  const lines = snapshot().slice();
  const i = lines.findIndex((l) => l.product.id === id);
  if (i < 0) return;
  const q = Math.round(qty);
  if (q <= 0) lines.splice(i, 1);
  else lines[i] = { ...lines[i], qty: Math.min(99, q) };
  write(lines);
}
export function setAmount(id: string, amount: number) {
  const lines = snapshot().slice();
  const i = lines.findIndex((l) => l.product.id === id);
  if (i < 0) return;
  lines[i] = { ...lines[i], amount: Math.max(0, Math.round(amount)) };
  write(lines);
}
export function removeFromCart(id: string) { write(snapshot().filter((l) => l.product.id !== id)); }
export function clearCart() { write([]); }
export function qtyOf(id: string): number { return snapshot().find((l) => l.product.id === id)?.qty ?? 0; }
export function hasDonation(): boolean { return snapshot().some((l) => l.product.kind === "donation"); }

export function useCart(): CartLine[] {
  return useSyncExternalStore(
    useCallback((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, []),
    snapshot,
    () => EMPTY,
  );
}
export function useCartCount(): number { return units(useCart()); }

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (!e.key || e.key === KEY) emit(); });
}

/* ─────────── карты: бренд / Luhn / форматирование ─────────── */
export interface CardBrand { id: string; label: string; }
export function detectBrand(input: string): CardBrand {
  const d = input.replace(/\D/g, "");
  if (/^4/.test(d)) return { id: "visa", label: "Visa" };
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(d)) return { id: "mc", label: "Mastercard" };
  if (/^220[0-4]/.test(d)) return { id: "mir", label: "Мир" };
  if (/^(34|37)/.test(d)) return { id: "amex", label: "Amex" };
  if (/^(62|81)/.test(d)) return { id: "unionpay", label: "UnionPay" };
  return { id: "card", label: "Карта" };
}
export function luhn(input: string): boolean {
  const d = input.replace(/\D/g, "");
  if (d.length < 12) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}
export function groupCard(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 19);
  if (/^(34|37)/.test(d)) {
    const a = d.slice(0, 4), b = d.slice(4, 10), c = d.slice(10, 15);
    return [a, b, c].filter(Boolean).join(" ");
  }
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
export function formatExpiry(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + "/" + d.slice(2);
}
export function validExpiry(mmYY: string): boolean {
  const m = mmYY.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const mm = +m[1], yy = +m[2];
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  const curY = now.getFullYear() % 100, curM = now.getMonth() + 1;
  return yy > curY || (yy === curY && mm >= curM);
}

/* ─── сохранённые карты (привязка): храним ТОЛЬКО бренд+последние4+срок ─── */
export interface SavedCard { id: string; brand: string; brandLabel: string; last4: string; exp: string; }
const CARDS_KEY = "shop:cards:v1";
const cardListeners = new Set<() => void>();
let cardCache: SavedCard[] | null = null;
const EMPTY_CARDS: SavedCard[] = [];
function cardEmit() { cardCache = null; cardListeners.forEach((l) => l()); }
function readCards(): SavedCard[] {
  try { const s = localStorage.getItem(CARDS_KEY); const a = s ? JSON.parse(s) : []; return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function cardSnap(): SavedCard[] { if (!cardCache) cardCache = readCards(); return cardCache; }
export function addSavedCard(c: Omit<SavedCard, "id">): SavedCard {
  const card: SavedCard = { ...c, id: "c" + Date.now().toString(36) };
  const list = cardSnap().filter((x) => !(x.last4 === c.last4 && x.brand === c.brand));
  list.unshift(card);
  try { localStorage.setItem(CARDS_KEY, JSON.stringify(list.slice(0, 8))); } catch { /* noop */ }
  cardEmit();
  return card;
}
export function removeSavedCard(id: string) {
  try { localStorage.setItem(CARDS_KEY, JSON.stringify(cardSnap().filter((c) => c.id !== id))); } catch { /* noop */ }
  cardEmit();
}
export function useSavedCards(): SavedCard[] {
  return useSyncExternalStore(
    useCallback((cb) => { cardListeners.add(cb); return () => cardListeners.delete(cb); }, []),
    cardSnap,
    () => EMPTY_CARDS,
  );
}

/* ─────────── контакт + адрес доставки ─────────── */
export interface Contact {
  name: string; phone: string; email: string;
  method: "delivery" | "pickup";
  country: string; city: string; street: string; zip: string; note: string;
}
export const EMPTY_CONTACT: Contact = {
  name: "", phone: "", email: "", method: "delivery",
  country: "Россия", city: "", street: "", zip: "", note: "",
};
const CONTACT_KEY = "shop:contact:v1";
export function readContact(): Contact {
  try { const s = localStorage.getItem(CONTACT_KEY); return s ? { ...EMPTY_CONTACT, ...JSON.parse(s) } : { ...EMPTY_CONTACT }; }
  catch { return { ...EMPTY_CONTACT }; }
}
export function writeContact(c: Contact) { try { localStorage.setItem(CONTACT_KEY, JSON.stringify(c)); } catch { /* noop */ } }

/* ─────────── доставка ─────────── */
export const SHIP_FLAT = 300;       // ₽ — фиксированная доставка
export const SHIP_FREE_FROM = 3000; // ₽ — бесплатно от суммы физических товаров
export function shippingFor(lines: CartLine[], method: "delivery" | "pickup"): number {
  if (method === "pickup" || !hasPhysical(lines)) return 0;
  return physicalSubtotal(lines) >= SHIP_FREE_FROM ? 0 : SHIP_FLAT;
}

/* ─────────── номер заказа ─────────── */
export function makeOrderNo(): string {
  const t = Date.now().toString(36).toUpperCase().slice(-5);
  const r = Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase().padStart(2, "0");
  return `IOL-${t}${r}`;
}
