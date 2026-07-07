/**
 * Единый источник URL для фотографий: ресайз и переупаковка через Cloudflare Image
 * Resizing. Движок стоит в apps/web/worker.ts на маршруте /api/img.
 *
 * ЧТО ДЕЛАЕТ. Удалённые http(s)-фото (даршаны храмов, hero_image личностей и дхам,
 * обложки альбомов, кадры ленты) прогоняются через /api/img?u=…&w=…, где воркер
 * отдаёт их в AVIF/WebP под ширину экрана. Локальные ассеты (/media/*.webp, svg),
 * data: и blob: НЕ трогаем — они уже оптимальны, повторное кодирование только вредит.
 *
 * КАЧЕСТВО (не страдает). Воркер использует fit=scale-down — НИКОГДА не увеличивает
 * картинку, значит замыливания от апскейла быть не может. quality≈82 на фотографиях
 * визуально неотличимо от оригинала, а format=auto отдаёт AVIF/WebP, которые при
 * таком качестве неотличимы от JPEG, но легче в разы. Плотность пикселей учитываем
 * здесь: ширину CSS-слота умножаем на DPR (кап ×2), чтобы на retina было чётко.
 *
 * БЕЗОПАСНОСТЬ (битых картинок не бывает). Если Image Resizing выключен в аккаунте
 * Cloudflare — директива игнорируется и воркер отдаёт ОРИГИНАЛ (fail-open). Если
 * источник недоступен (например, подписанные URL Instagram) — воркер делает 302 на
 * оригинал, и браузер грузит его напрямую. Плюс каждый <img> получает фолбэк onImgError
 * на сырой src. Три рубежа — в худшем случае показывается оригинал, ровно как сегодня.
 */

// Приложение нигде не показывает картинку шире ~560px контейнера; 1600 — с запасом
// на 2× retina и десктоп. Выше нет смысла тянуть пиксели.
const MAX_WIDTH = 1600;

/**
 * Построить URL картинки под ширину CSS-слота (в css-px). Ширина домножается на
 * плотность пикселей устройства (кап ×2) для чёткости на retina.
 */
export function img(u: string | undefined | null, cssWidth = 720): string {
  if (!u) return "";
  // локальные ассеты и inline-данные — как есть
  if (u.startsWith("/") || u.startsWith("data:") || u.startsWith("blob:")) return u;
  if (!/^https?:\/\//i.test(u)) return u; // неизвестная схема — не трогаем
  let w = Math.round(cssWidth);
  try {
    if (typeof window !== "undefined") {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.round(cssWidth * dpr);
    }
  } catch {
    /* нет window (SSR) — берём cssWidth как есть */
  }
  if (w > MAX_WIDTH) w = MAX_WIDTH;
  if (w < 1) w = 1;
  return `/api/img?u=${encodeURIComponent(u)}&w=${w}`;
}

/**
 * Обработчик onError для <img>, который отдаёт картинку через img(): если ресайз-URL
 * не вернул изображение, один раз (флаг data-fb, без петли) подменяем src на исходный
 * удалённый URL, чтобы фото всё равно загрузилось напрямую. rawSrc — источник ДО img().
 */
export function onImgError(rawSrc: string | undefined | null) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const el = e.currentTarget;
    if (!rawSrc || el.dataset.fb === "1") return;
    el.dataset.fb = "1";
    el.src = rawSrc;
  };
}
