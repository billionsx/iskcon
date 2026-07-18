/**
 * Разбиение кода на чанки (code-splitting).
 *
 * ЗАЧЕМ: раньше App.tsx статически импортировал ~40 экранов (книга-деталь,
 * ПКЛ, аккаунт, центры, прасад, дхамы, PDF-генератор…), и Vite складывал ВСЁ
 * приложение вместе со всеми данными в один бандл (index-*.js ≈ 1.6 МБ).
 * Браузер обязан был скачать и распарсить весь этот объём до первого кадра —
 * отсюда очень долгая загрузка главной на любом устройстве и сети.
 *
 * РЕШЕНИЕ: каждый экран за пределами критического пути (лента + оболочка)
 * грузится по требованию через React.lazy → отдельный чанк. Первый кадр теперь
 * тянет только оболочку и ленту; тяжёлые разделы подгружаются лениво при первом
 * переходе в них. Границы <Suspense> стоят в App.tsx (таб-аутлет и стек
 * оверлеев), поэтому оболочка (шапка + таб-бар) при переходах не мигает.
 *
 * КРИТИЧЕСКИЙ ПУТЬ (остаётся статикой в App.tsx): HomeFeed, DarshanRings,
 * HomeCalendar, провайдеры, мини-плеер, модалки — то, что видно/нужно сразу.
 */
import { lazy } from "react";

// — верхнеуровневые вкладки и хабы —
export const HomeScreen = lazy(() => import("./HomeScreen"));
export const EntityPage = lazy(() => import("./EntityPage"));
export const AccountScreen = lazy(() => import("./AccountScreen"));
export const BooksHub = lazy(() => import("./BooksHub"));
export const KirtansScreen = lazy(() => import("./KirtansScreen"));
export const KathaScreen = lazy(() => import("./KathaScreen"));
export const AcharyaScreen = lazy(() => import("./AcharyaScreen"));
export const PracticeHub = lazy(() => import("./PracticeHub"));
export const DhamaScreen = lazy(() => import("./dhama/DhamaScreen"));

// — страницы-детали / оверлеи —
export const BookDetailPage = lazy(() =>
  import("./BookDetailPage").then((m) => ({ default: m.BookDetailPage }))
);
export const BhajanDetailPage = lazy(() => import("./BhajanDetailPage"));
export const KirtanArtistPage = lazy(() => import("./KirtanArtistPage"));
export const ContentDetailPage = lazy(() => import("./ContentDetailPage"));
export const SearchScreen = lazy(() => import("./SearchScreen"));
export const FavoritesScreen = lazy(() => import("./FavoritesScreen"));
export const NotesScreen = lazy(() => import("./NotesScreen"));
export const NoteDetail = lazy(() => import("./NoteDetail"));
export const BookLoaderPage = lazy(() => import("./BookLoaderPage"));
export const CartScreen = lazy(() => import("./shop/CartScreen"));
export const JapaScreen = lazy(() => import("./JapaScreen"));
export const SadhanaScreen = lazy(() => import("./SadhanaScreen"));
export const VowScreen = lazy(() => import("./VowScreen"));
export const DarshanScreen = lazy(() => import("./DarshanScreen"));
export const DownloaderScreen = lazy(() => import("./DownloaderScreen"));
export const StoriesToolScreen = lazy(() => import("./StoriesToolScreen"));
export const DailyVerseScreen = lazy(() => import("./DailyVerseScreen"));
export const EkadashiScreen = lazy(() => import("./EkadashiScreen"));
export const MyProgressScreen = lazy(() => import("./MyProgressScreen"));

// — центры —
export const CenterScreen = lazy(() => import("./centers/CenterScreen"));
export const MyCentersScreen = lazy(() => import("./centers/MyCentersScreen"));
export const CentersScreen = lazy(() => import("./centers/CentersScreen"));
export const CenterEditor = lazy(() => import("./centers/CenterEditor"));
export const CenterSchedule = lazy(() => import("./centers/CenterSchedule"));
export const CenterDeities = lazy(() => import("./centers/CenterDeities"));
export const CenterEvents = lazy(() => import("./centers/CenterEvents"));
export const CenterModeration = lazy(() => import("./centers/CenterModeration"));
export const CenterPhotos = lazy(() => import("./centers/CenterPhotos"));

// — прасад —
export const PrasadamScreen = lazy(() => import("./prasad/PrasadamScreen"));
export const RecipeDetail = lazy(() => import("./prasad/RecipeDetail"));
export const CookbookScreen = lazy(() => import("./prasad/CookbookScreen"));

// — дхамы —
export const DhamaDetailPage = lazy(() => import("./dhama/DhamaDetailPage"));
export const TirthaDetailPage = lazy(() => import("./dhama/TirthaDetailPage"));

// — печатный режим (?pdf) —
export const PdfDoc = lazy(() =>
  import("./PdfDoc").then((m) => ({ default: m.PdfDoc }))
);

/**
 * Прогрев чанков основных вкладок в простое браузера.
 *
 * После первого кадра, когда главный поток свободен, тихо подтягиваем модули
 * разделов, в которые пользователь заходит чаще всего (личности, книги, практика,
 * кабинет). Тап по вкладке тогда открывается мгновенно — без скелетона, чанк уже
 * в кэше модулей. Экономный режим уважаем: при Save-Data или медленной сети (2g)
 * прогрев пропускаем, чтобы не тратить трафик наперёд.
 */
export function prefetchTopScreens(): void {
  try {
    const c = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ""))) return;
  } catch {
    /* нет Network Information API — прогреваем как обычно */
  }
  const warm = () => {
    void import("./AcharyaScreen");
    void import("./BooksHub");
    void import("./PracticeHub");
    void import("./AccountScreen");
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout?: number }) => number }).requestIdleCallback;
  if (ric) ric(warm, { timeout: 3000 });
  else setTimeout(warm, 1500);
}
