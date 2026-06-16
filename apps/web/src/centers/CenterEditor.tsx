/**
 * CenterEditor — создание и правка центра (Ятра) в личном кабинете.
 *
 * Без slug — режим создания (POST → 'draft', автор становится админом). Со slug —
 * правка (загружаем карточку, PATCH по id). Эстетика приложения: сгруппированные
 * поля, золото-акцент, токены темы. Публикация в каталог — прерогатива ИСККОН;
 * владелец заполняет профиль и из карточки отправляет «на проверку».
 *
 * Расписание/божества/события правятся отдельно (следующая веха) — здесь профиль
 * центра: название, тип, адрес, языки, контакты, координаты.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAuthed, requireAuth } from "./../account/track";
import {
  centersClient,
  CENTER_TYPE_LABEL,
  centerErrorText,
  type CenterType,
  type CenterCreateInput,
  type CenterPatch,
} from "./api";

/* ───────────────────── палитра ───────────────────── */
const GOLD = "#D2AA1B";
const GOLDT = "#9c7c15";
const RED = "var(--color-danger-text)";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL = "var(--color-glass-thin)";
const FILL2 = "var(--color-glass-regular)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";

const TYPE_ORDER: CenterType[] = ["temple", "namahatta", "preaching_center", "restaurant", "farm"];
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

const Back = () => (
  <svg width="11" height="19" viewBox="0 0 11 19" fill="none" aria-hidden>
    <path d="M9 1.5L2 9.5l7 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ───────────────────── состояние формы ───────────────────── */
interface FormState {
  name: string;
  slug: string;
  type: CenterType;
  country: string;
  region: string;
  city: string;
  address: string;
  languages: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  lat: string;
  lng: string;
  timezone: string;
}
const EMPTY: FormState = {
  name: "", slug: "", type: "temple", country: "", region: "", city: "", address: "",
  languages: "ru", phone: "", whatsapp: "", email: "", website: "", lat: "", lng: "", timezone: "",
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
const parseLangs = (s: string): string[] =>
  s.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 12);
const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/* ───────────────────── поля ───────────────────── */
const groupLabel: CSSProperties = {
  fontFamily: FT, fontSize: 11, fontWeight: 700, letterSpacing: "0.6px",
  textTransform: "uppercase", color: L3, margin: "0 4px 8px",
};
const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", fontFamily: FT, fontSize: 15.5, color: L1,
  background: "transparent", border: "none", outline: "none", padding: 0, WebkitTapHighlightColor: "transparent",
};

function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: ReactNode; error?: string | null }) {
  return (
    <div style={{ padding: "11px 14px" }}>
      <div style={{ fontFamily: FT, fontSize: 11.5, fontWeight: 600, color: error ? RED : L3, marginBottom: 4 }}>{label}</div>
      {children}
      {(hint || error) && (
        <div style={{ marginTop: 5, fontFamily: FT, fontSize: 11.5, lineHeight: 1.4, color: error ? RED : L3 }}>{error || hint}</div>
      )}
    </div>
  );
}
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      {title && <div style={groupLabel}>{title}</div>}
      <div style={{ background: FILL, borderRadius: 16, overflow: "hidden" }}>{children}</div>
    </section>
  );
}
const sep = <div style={{ height: "0.5px", background: HAIR, marginLeft: 14 }} />;

/* ───────────────────── экран ───────────────────── */
export default function CenterEditor({
  slug,
  onBack,
  onOpenPath,
  flash,
}: {
  slug?: string;
  onBack: () => void;
  onOpenPath: (p: string) => void;
  flash?: (m: string) => void;
}) {
  const authed = useAuthed();
  const isEdit = !!slug;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">(isEdit ? "loading" : "ready");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const seeded = useRef(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const loadForEdit = useCallback(() => {
    if (!slug) return;
    setPhase("loading");
    centersClient
      .get(slug)
      .then(({ center: c }) => {
        setCenterId(c.id);
        if (!seeded.current) {
          setForm({
            name: c.name, slug: c.slug, type: c.type,
            country: c.country ?? "", region: c.region ?? "", city: c.city ?? "", address: c.address ?? "",
            languages: (c.languages || []).join(", ") || "ru",
            phone: c.phone ?? "", whatsapp: c.whatsapp ?? "", email: c.email ?? "", website: c.website ?? "",
            lat: c.lat != null ? String(c.lat) : "", lng: c.lng != null ? String(c.lng) : "", timezone: c.timezone ?? "",
          });
          seeded.current = true;
        }
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  }, [slug]);

  useEffect(() => {
    if (!authed) {
      setPhase("ready");
      return;
    }
    if (isEdit) loadForEdit();
  }, [authed, isEdit, loadForEdit]);

  // Автоадрес из названия (только создание, пока поле не трогали руками).
  const onName = (v: string) => {
    set("name", v);
    if (!isEdit && !slugTouched) set("slug", slugify(v));
  };

  const validate = (): string | null => {
    if (form.name.trim().length < 2) return "bad_name";
    if (!isEdit && !SLUG_RE.test(form.slug)) return "bad_slug";
    return null;
  };

  const save = useCallback(() => {
    if (saving) return;
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setErr(null);
    setSaving(true);

    if (!isEdit) {
      const input: CenterCreateInput = {
        name: form.name.trim(),
        slug: form.slug,
        type: form.type,
        country: form.country.trim() || null,
        region: form.region.trim() || null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        languages: parseLangs(form.languages),
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        lat: numOrNull(form.lat),
        lng: numOrNull(form.lng),
        timezone: form.timezone.trim() || null,
      };
      centersClient
        .create(input)
        .then((r) => {
          flash?.("Центр создан — это черновик");
          onOpenPath(`/center/${r.slug}`);
        })
        .catch((e: { code?: string }) => setErr(e?.code || "error"))
        .finally(() => setSaving(false));
      return;
    }

    if (!centerId) {
      setSaving(false);
      return;
    }
    const patch: CenterPatch = {
      name: form.name.trim(),
      type: form.type,
      country: form.country.trim() || null,
      region: form.region.trim() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      languages: parseLangs(form.languages),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      lat: numOrNull(form.lat),
      lng: numOrNull(form.lng),
      timezone: form.timezone.trim() || null,
    };
    centersClient
      .update(centerId, patch)
      .then(() => {
        flash?.("Сохранено");
        onBack();
      })
      .catch((e: { code?: string }) => setErr(e?.code || "error"))
      .finally(() => setSaving(false));
  }, [saving, isEdit, centerId, form, flash, onBack, onOpenPath]);

  /* ── оболочка ── */
  const navStyle: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
    borderBottom: `0.5px solid ${HAIR}`,
  };
  const iconBtn: CSSProperties = {
    display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none",
    color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent",
  };
  const Shell = ({ children }: { children: ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={onBack} style={iconBtn}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>{isEdit ? "Правка центра" : "Новый центр"}</div>
        <span style={{ width: 38 }} />
      </header>
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>{children}</div>
      </div>
    </div>
  );

  if (!authed) {
    return (
      <Shell>
        <div style={{ padding: 16, borderRadius: 18, background: FILL, textAlign: "center", marginTop: 8 }}>
          <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, color: L1 }}>Войдите, чтобы продолжить</div>
          <p style={{ margin: "9px auto 0", maxWidth: 300, fontFamily: FT, fontSize: 14, lineHeight: 1.5, color: L2 }}>Управление центром доступно вошедшим преданным.</p>
          <button type="button" onClick={requireAuth} style={{ marginTop: 16, padding: "12px 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Войти</button>
        </div>
      </Shell>
    );
  }
  if (phase === "loading") {
    return (
      <Shell>
        <div style={{ display: "grid", placeItems: "center", padding: "70px 0", color: L3 }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${HAIR}`, borderTopColor: GOLD, animation: "ceSpin .8s linear infinite" }} />
        </div>
        <style>{`@keyframes ceSpin{to{transform:rotate(360deg)}}`}</style>
      </Shell>
    );
  }
  if (phase === "error") {
    return (
      <Shell>
        <div style={{ padding: 16, borderRadius: 18, background: FILL, textAlign: "center", marginTop: 8 }}>
          <p style={{ margin: 0, fontFamily: FT, fontSize: 14.5, color: L2 }}>Не удалось загрузить центр.</p>
          <button type="button" onClick={loadForEdit} style={{ marginTop: 14, padding: "10px 20px", borderRadius: 12, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}>Повторить</button>
        </div>
      </Shell>
    );
  }

  const errField = (codes: string[]) => (err && codes.includes(err) ? centerErrorText(err) : null);
  const generalErr = err && !["bad_name", "bad_slug", "slug_taken", "bad_type"].includes(err) ? centerErrorText(err) : null;

  return (
    <Shell>
      {/* Основное */}
      <Group title="Основное">
        <Field label="Название" error={errField(["bad_name"])}>
          <input style={inputStyle} value={form.name} onChange={(e) => onName(e.target.value)} placeholder="Напр. Шри Шри Радха-Мадхава" maxLength={160} />
        </Field>
        {sep}
        {!isEdit ? (
          <Field
            label="Адрес страницы"
            error={errField(["bad_slug", "slug_taken"])}
            hint={<span>gaurangers.com/center/<b style={{ color: L2 }}>{form.slug || "адрес"}</b></span>}
          >
            <input
              style={inputStyle}
              value={form.slug}
              onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
              placeholder="radha-madhava"
              autoCapitalize="off"
              autoCorrect="off"
              maxLength={64}
            />
          </Field>
        ) : (
          <Field label="Адрес страницы" hint="Адрес нельзя изменить после создания.">
            <div style={{ fontFamily: FT, fontSize: 15.5, color: L2 }}>gaurangers.com/center/{form.slug}</div>
          </Field>
        )}
        {sep}
        <Field label="Тип центра">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
            {TYPE_ORDER.map((t) => {
              const on = form.type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("type", t)}
                  style={{
                    padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: FT, fontSize: 13, fontWeight: 600,
                    background: on ? GOLD : FILL2, color: on ? "#fff" : L2, WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {CENTER_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </Field>
      </Group>

      {/* Адрес */}
      <Group title="Адрес и язык">
        <Field label="Город">
          <input style={inputStyle} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Москва" maxLength={120} />
        </Field>
        {sep}
        <Field label="Страна (код, 2 буквы)" hint="ISO-код: RU, IN, US…">
          <input style={inputStyle} value={form.country} onChange={(e) => set("country", e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} placeholder="RU" maxLength={2} />
        </Field>
        {sep}
        <Field label="Регион / штат">
          <input style={inputStyle} value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="Московская область" maxLength={120} />
        </Field>
        {sep}
        <Field label="Адрес">
          <input style={inputStyle} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="ул. Хорошёвская, 8к3" maxLength={300} />
        </Field>
        {sep}
        <Field label="Языки" hint="Через запятую: ru, en">
          <input style={inputStyle} value={form.languages} onChange={(e) => set("languages", e.target.value)} placeholder="ru, en" maxLength={80} autoCapitalize="off" />
        </Field>
      </Group>

      {/* Контакты */}
      <Group title="Контакты">
        <Field label="Телефон">
          <input style={inputStyle} type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+7 495 000-00-00" maxLength={40} />
        </Field>
        {sep}
        <Field label="WhatsApp">
          <input style={inputStyle} type="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+7 999 000-00-00" maxLength={40} />
        </Field>
        {sep}
        <Field label="E-mail">
          <input style={inputStyle} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="info@temple.org" maxLength={200} autoCapitalize="off" />
        </Field>
        {sep}
        <Field label="Сайт">
          <input style={inputStyle} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="temple.org" maxLength={300} autoCapitalize="off" />
        </Field>
      </Group>

      {/* Дополнительно */}
      <Group title="Координаты и время">
        <Field label="Широта" hint="Для карты и поиска «рядом». Напр. 55.751">
          <input style={inputStyle} type="text" inputMode="decimal" value={form.lat} onChange={(e) => set("lat", e.target.value)} placeholder="55.751" maxLength={20} />
        </Field>
        {sep}
        <Field label="Долгота" hint="Напр. 37.618">
          <input style={inputStyle} type="text" inputMode="decimal" value={form.lng} onChange={(e) => set("lng", e.target.value)} placeholder="37.618" maxLength={20} />
        </Field>
        {sep}
        <Field label="Часовой пояс" hint="IANA: Europe/Moscow">
          <input style={inputStyle} value={form.timezone} onChange={(e) => set("timezone", e.target.value)} placeholder="Europe/Moscow" maxLength={64} autoCapitalize="off" />
        </Field>
      </Group>

      {generalErr && (
        <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--color-danger) 12%, transparent)", color: RED, fontFamily: FT, fontSize: 13.5, fontWeight: 600 }}>{generalErr}</div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        style={{ marginTop: 22, width: "100%", padding: "14px 0", borderRadius: 14, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}
      >
        {saving ? "Сохраняю…" : isEdit ? "Сохранить" : "Создать центр"}
      </button>

      {!isEdit && (
        <p style={{ margin: "12px 4px 0", fontFamily: FT, fontSize: 12, lineHeight: 1.5, color: L3, textAlign: "center" }}>
          Центр создаётся как черновик. Заполните профиль и отправьте на проверку — после подтверждения ИСККОН он появится в каталоге.
        </p>
      )}
    </Shell>
  );
}
