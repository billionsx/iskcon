/* /play — каталог демо-данных. Названия и имена — фактические метаданные из
   45 эталонных экранов; редакционные подписи переписаны своими словами.
   Все обложки рисуются логотипом ISKCON ONE LOVE (см. Cover в core.tsx). */

export type Song = { id: string; t: string; a: string; e?: boolean; d: number; cov?: string };
export type Card = { id: string; t: string; s?: string; k?: string; cap?: string; e?: boolean; hue?: number };

const S = (id: string, t: string, a: string, d: number, e?: boolean): Song => ({ id, t, a, d, e });
const C = (id: string, t: string, s?: string, k?: string, cap?: string, e?: boolean): Card => ({ id, t, s, k, cap, e });

/* ── Плеер: стартовая очередь ─────────────────────────────────────────── */
export const NAVAJO = S("navajo", "Navajo", "Masego", 194);
export const QUEUE0: Song[] = [
  NAVAJO,
  S("needit", "Need It (feat. Masego)", "KAYTRANADA", 212, true),
  S("getme", "Get Me Down (feat. Jorja Smith)", "Nia Archives", 201),
];
export const STATION_NAME = "From Billions’s Station";

/* Строки текста песни — собственные, нейтральные (плейсхолдер караоке). */
export const LYRICS: { at: number; s: string }[] = [
  { at: 0, s: "Sunrise on the water, we begin" },
  { at: 14, s: "Every little wave is calling home" },
  { at: 28, s: "Hold the moment, let it breathe" },
  { at: 42, s: "We were made of summer light" },
  { at: 56, s: "Carry me across the golden hour" },
  { at: 72, s: "Even silence sings when you are near" },
  { at: 88, s: "Down the avenue the echoes bloom" },
  { at: 104, s: "Heartbeat keeping time with the tide" },
  { at: 120, s: "Stay — the night is still unwritten" },
  { at: 138, s: "All the colours lean into the sound" },
  { at: 156, s: "Morning finds us golden once again" },
];

/* ── HOME ─────────────────────────────────────────────────────────────── */
export const TOP_PICKS = [
  { id: "pickmasego", k: "Featuring Masego", t: "Masego & Similar Artists", hue: 18 },
  { id: "pickflo", k: "Featuring FLO", t: "FLO & Similar Artists", hue: 187 },
];
export const MOODS = [
  { id: "energy", t: "Energy", s: "Radio Station", bg: "#57B04A", glyph: "bolt" },
  { id: "love", t: "Love", s: "Radio Station", bg: "#E85BA4", glyph: "heart" },
  { id: "heartbreak", t: "Heartbreak", s: "Radio Station", bg: "#E1552F", glyph: "halfheart" },
];
export const TAKEOVER = {
  id: "flo-takeover", t: "Radio Takeover", cap: "UK trio FLO pick the soundtrack for their perfect night out.",
};

/* ── NEW ──────────────────────────────────────────────────────────────── */
export const NEW_HEROES: Card[] = [
  C("h-rbnow", "R&B Now", "Apple Music R&B", "UPDATED PLAYLIST", "Steve Lacy and SZA ask one simple question: “is it cool?”."),
  C("h-fyf", "Fix Your Face", "Masego", "NEW ALBUM", "The soul alchemist spins fragile tales of resilience and rebirth.", true),
  C("h-upnext", "Up Next", "Apple Music Up Next", "UPDATED PLAYLIST", "New and current favourites, chosen by our editors."),
];
export const BEST_NEW_SONGS: Song[] = [
  S("heaven", "Heaven", "Masego", 187),
  S("vitamin", "Вітамін", "Parfeniuk", 173),
  S("dancenow", "Dance Right Now", "Ne-Yo", 199),
  S("ochi", "Очі", "Kalush Orchestra & melos", 182),
  S("bodywave", "BODY WAVE", "BBGIRLS", 176),
  S("nemani", "Не мани", "CHEEV", 168),
  S("normal", "NORMAL (Korean Ver.)", "BTS", 191, true),
  S("crush", "CRUSH", "SON JUNHYUNG", 179),
  S("popsound", "Pop Sound", "Kim Petras", 174),
  S("chat", "CHAT", "GIRLSET", 162, true),
  S("sunrise", "Take Me to Sunrise", "After", 208),
  S("artofletting", "The Art Of Letting Go", "Ambré", 196, true),
  S("brandnew", "Brand New", "Green Day", 181),
];
export const NEW_THIS_WEEK: Card[] = [
  C("fyf", "Fix Your Face", "Masego", undefined, undefined, true),
  C("stranger", "A Stranger To You", "Loathe"),
  C("liveinthe", "Live In The Backwoods", "BackRoad Gee"),
];
export const RECENT_RELEASES: Card[] = [
  C("nosleep", "No Sleep In Paradise", "Naomi Sharon"),
  C("swag", "SWAG LIVE FROM L.A.", "Justin Bieber", undefined, undefined, true),
  C("adam", "ADAM", "Adam Lambert", undefined, undefined, true),
];
export const UPDATED_PLAYLISTS: Card[] = [
  C("rbnow", "R&B Now", "Apple Music R&B"),
  C("upnext", "Up Next", "Apple Music Up Next"),
  C("alist", "A-List Pop", "Apple Music Pop"),
  C("brownsugar", "Brown Sugar", "Apple Music R&B"),
  C("newrb", "New in R&B", "Apple Music R&B"),
  C("newmusicdaily", "New Music Daily", "Apple Music"),
];
export const NEW_IN_MUSIC: Card[] = [
  C("newpop", "New in Pop", "Apple Music Pop"),
  C("newrock", "New in Rock", "Apple Music Rock"),
  C("newdance", "New in Dance", "Apple Music Dance"),
];
export const TRENDING: Song[] = [
  S("dracula", "Dracula (JENNIE Remix)", "Tame Impala & JENNIE", 204, true),
  S("sevennation", "Seven Nation Army", "The White Stripes", 231),
  S("dynamite", "Dynamite", "BTS", 199),
  S("hatethat", "hate that i made you love me", "Ariana Grande", 189),
  S("starlight", "Starlight", "Pink Pantheress", 164),
  S("move", "MOVE", "Beyoncé", 202),
  S("iknow", "I Know You Better", "Taylor Swift", 213),
  S("jaded", "Jaded", "Drake", 224),
];
export const EVERYONES: Card[] = [
  C("shakira-ess", "Shakira Essentials", "Apple Music Pop"),
  C("iceman", "ICEMAN", "Drake", undefined, undefined, true),
  C("verzuz", "VERZUZ Cheat Sheet: YG", "Apple Music"),
];
export const TOP100 = [
  { id: "t-global", k: "Top 100", n: "Global", t: "Top 100: Global", s: "Apple Music", hue: 356 },
  { id: "t-ua", k: "Топ-100", n: "Україна", t: "Top 100: Ukraine", s: "Apple Music", hue: 212 },
  { id: "t-us", k: "Top 100", n: "United States", t: "Top 100: USA", s: "Apple Music", hue: 226 },
];
export const CITY25 = [
  { id: "c-kyiv", k: "Топ-25", n: "Київ", t: "Top 25: Kyiv", s: "Apple Music" },
  { id: "c-almaty", k: "Top 25", n: "Almaty", t: "Top 25: Almaty", s: "Apple Music" },
  { id: "c-london", k: "Top 25", n: "London", t: "Top 25: London", s: "Apple Music" },
];
export const NEW_RADIO_EPISODES: Card[] = [
  C("ep-flo", "FLO", "The group builds their perfect night out.", "RADIO TAKEOVER"),
  C("ep-judd", "Maximum Pleasure Guaranteed", "The cast of the Apple TV show talks Series 1.", "THE REBECCA JUDD SHOW"),
  C("ep-jay", "Reasonable Anniversary", "A landmark record turns another year older.", "ESSENTIALS ANNIVERSARIES"),
  C("ep-catch", "Catch & Dotty", "Fresh heat with Catch and Dotty.", "THE DOTTY SHOW"),
];
export const WATCH_INTERVIEWS: Card[] = [
  C("wi-paul", "Paul McCartney: The Interview", "Paul McCartney, The Beatles"),
  C("wi-olivia", "Olivia Rodrigo: The Zane Lowe Show", "Olivia Rodrigo & Zane Lowe", undefined, undefined, true),
  C("wi-yg", "YG: The Ebro Show", "YG & Ebro Darden", undefined, undefined, true),
  C("wi-baby", "BabyChiefDoIt on Rise & Grind", "BabyChiefDoit"),
  C("wi-kpop", "The K-pop generation", "LE SSERAFIM"),
];
export const COMING_SOON: Card[] = [
  C("cs-flo", "THERAPY AT THE CLUB", "FLO", undefined, undefined, true),
  C("cs-sam", "Hazel Eyes", "Sam Smith", undefined, undefined, true),
  C("cs-ellie", "I Know Too Much", "Ellie Goulding"),
];
export const MORE_EXPLORE_NEW = [
  "Concerts", "Browse by Genre", "Decades", "Moods and Activities",
  "Worldwide", "Charts", "Spatial Audio", "Music Videos", "Apple Music Classical",
];

/* ── RADIO ────────────────────────────────────────────────────────────── */
export const RADIO_TILES = [
  { id: "st1", logo: "one", text: "1", accent: "#E7332B" },
  { id: "sthits", logo: "hits", text: "HITS", accent: "#2E6BE6" },
  { id: "stcountry", logo: "country", text: "COUNTRY", accent: "#C9902A" },
  { id: "stmusica", logo: "musica", text: "MÚSICA UNO", accent: "#D63384" },
  { id: "stclub", logo: "club", text: "club", accent: "#3A3A3C" },
  { id: "stchill", logo: "chill", text: "Chill", accent: "#2E7CF6" },
];
export const ON_AIR = [
  { id: "oa1", tint: "#8B7F7B", k: "Music 1 · 12:00 – 13:00", t: "Apple Music 1", d: "The world’s best new music is on Apple Music 1." },
  { id: "oa2", tint: "#7C8895", k: "Music Hits · 12:00 – 13:00", t: "Apple Music Hits", d: "Songs you know and love, all day long." },
];
export const LATEST_EPISODES: Card[] = [
  C("le-soul", "Episode 738", "Joe returns with fresh discoveries and rediscoveries.", "SOULECTION"),
  C("le-charli", "Charli xcx: How We Got Here", "Beneath the electric guitars it’s still Charli.", "HOW WE GOT HERE", undefined, true),
  C("le-gracie", "Gracie Radio", "Gracie Abrams on the story behind Daughter from Hell.", "FOR THE FANS", undefined, true),
  C("le-tyla", "Tyla: How We Got Here", "A singular creative vision since high school.", "HOW WE GOT HERE"),
  C("le-vince", "5 on Fridays", "Vince Staples counts his five for the week.", "5 ON FRIDAYS"),
  C("le-thriller", "Essentials Anniversaries", "A landmark pop record celebrates a milestone.", "ESSENTIALS"),
];
export const TAKE_OVER: Card[] = [
  C("to-feid", "Feid x Ferxxo", "Frente a frente por primera vez.", undefined, undefined, true),
  C("to-chase", "CHASE B", "The DJ takes us back to Houston.", undefined, undefined, true),
  C("to-neyo", "Ne-Yo", "The R&B star hits rewind.", undefined, undefined, true),
];
export const LISTEN_INTERVIEWS: Card[] = [
  C("li-yg", "YG", "YG opens the doors to the Gentlemen’s Club.", "THE EBRO SHOW", undefined, true),
  C("li-malcolm", "Malcolm Todd", "Malcolm Todd live; Claire Rosinkranz opens a new era.", "THE ZANE LOWE SHOW", undefined, true),
  C("li-steve", "Steve Lacy", "Music from Gracie Abrams, Syd and more.", "NEW MUSIC DAILY RADIO", undefined, true),
  C("li-lorelei", "This Is Lorelei", "Guest hour on ALT CTRL Radio.", "ALT CTRL RADIO"),
  C("li-buju", "Buju Banton & Ebro Darden", "A legend in conversation.", "THE EBRO SHOW"),
  C("li-mico", "MICO & Travis Mills", "MICO drops by the show.", "THE TRAVIS MILLS SHOW"),
];
export const IN_STUDIO: Card[] = [
  C("is-way", "Live at Apple Music Radio", "Way Dynamic"),
  C("is-saint", "Live at Apple Music Radio", "Saint Harison", undefined, undefined, true),
  C("is-trim", "Live at Apple Music Radio", "Trim"),
];
export const CLUB_MIXES: Card[] = [
  C("cm-ranger", "Club Mix 006: Ranger Trucco", "Ranger Trucco", undefined, undefined, true),
  C("cm-honey", "Beats In Space 215", "HoneyLuv", undefined, undefined, true),
  C("cm-worra", "Club Mix 007: J. Worra", "J. Worra"),
];
export const ARTIST_SHOWS: Card[] = [
  C("as-mark", "The Mark Hoppus Show", "Mark Hoppus"),
  C("as-vince", "5 on Fridays with Vince Staples", "Vince Staples"),
  C("as-takeover", "Radio Takeovers", "Only on Apple Music"),
];
export const OUR_HOSTS: Card[] = [
  C("oh-zane", "The Zane Lowe Show", "Zane Lowe"),
  C("oh-dotty", "The Dotty Show", "Dotty"),
  C("oh-ebro", "The Ebro Show", "Ebro Darden"),
];
export const RADIO_LOCAL: Card[] = [
  C("rl-hitsru", "Hits in Russian Station", "Apple Music Hits"),
  C("rl-hiphopru", "Hip-Hop in Russian Station", "Apple Music Russian Hip-Hop"),
  C("rl-dance", "Dance Station", "Apple Music Dance"),
];
export const RADIO_GENRES = [
  "Acoustic", "African", "Alternative & Indie", "Christian", "Classical", "Country",
  "Dance", "Electronic", "From Around the World", "Hip-Hop", "Hits by Decade",
  "Christmas", "Jazz", "Kids & Family", "Latin", "Metal", "Pop", "R&B & Soul", "Rock",
];
export const GENRE_STATIONS: Record<string, { id: string; t: string; s: string; lab: string }[]> = {
  Acoustic: [
    { id: "g-ac1", t: "Acoustic Station", s: "Apple Music Acoustic", lab: "Акустика" },
    { id: "g-ac2", t: "Classic Acoustic Station", s: "Apple Music Acoustic", lab: "Класика акустичної музики" },
  ],
};

/* ── SEARCH (обзор) ───────────────────────────────────────────────────── */
export const SEARCH_CATS = [
  { id: "cat-summer", t: "Summertime Sounds", hue: 42 },
  { id: "cat-hits", t: "Hits", hue: 48 },
  { id: "cat-concerts", t: "Concerts", hue: 355 },
  { id: "cat-live", t: "Apple Music Live", hue: 228 },
  { id: "cat-chill", t: "Chill", hue: 192 },
  { id: "cat-upnext", t: "Up Next", hue: 353 },
  { id: "cat-fitness", t: "Fitness", hue: 62 },
  { id: "cat-replay", t: "Replay Monthly", hue: 24 },
  { id: "cat-charts", t: "Charts", hue: 58 },
  { id: "cat-focus", t: "Focus", hue: 30 },
  { id: "cat-alt", t: "Alternative", hue: 330 },
  { id: "cat-rock", t: "Rock", hue: 350 },
  { id: "cat-sing", t: "Sing", hue: 348 },
  { id: "cat-dance", t: "Dance", hue: 140 },
];

/* ── Хаб Summertime Sounds ────────────────────────────────────────────── */
export const HUB_HEROES: Card[] = [
  C("hh-gracie", "Gracie Abrams: Daughter from Hell Season", "Apple Music Summertime Sounds", "NEW PLAYLIST", "The pop star curates a euphoric mix for the season."),
  C("hh-zara", "Zara Larsson: Midsummer Mix", "Apple Music Summertime Sounds", "NEW PLAYLIST", "Pop star Zara Larsson builds a playlist for long light evenings."),
];
export const SUMMER_ESCAPES: Card[] = [
  C("se-riviera", "Summer In: The French Riviera", "Apple Music Summertime Sounds"),
  C("se-amalfi", "Summer In: The Amalfi Coast", "Apple Music Summertime Sounds"),
  C("se-greek", "Summer In: The Greek Islands", "Apple Music Summertime Sounds"),
  C("se-nordic", "Summer In: The Nordic Archipelago", "Apple Music Summertime Sounds"),
  C("se-turkiye", "Summer In: Mediterranean Türkiye", "Apple Music Summertime Sounds"),
  C("se-cornwall", "Summer In: Cornwall", "Apple Music Summertime Sounds"),
  C("se-cottage", "Summer In: Cottage Country", "Apple Music Summertime Sounds"),
];
export const SUMMER_ANTHEMS: Song[] = [
  S("saturday", "Saturday Night", "Ravyn Lenae", 187),
  S("anotherdrink", "Another Drink", "Marshmello & Kelsea Ballerini", 172),
  S("shedidit", "SHE DID IT AGAIN (feat. Zara Larsson)", "Tyla", 181),
  S("daidai", "Dai Dai", "Shakira & Burna Boy", 196),
  S("dracula", "Dracula (JENNIE Remix)", "Tame Impala & JENNIE", 204),
  S("motionparty", "Motion Party (Remix)", "Bossman Dlow & Megan Thee Stallion", 168),
  S("thinkdrunk", "Think As You Drunk", "Riley Green", 189),
  S("secretlang", "Secret Language", "Ryan Beatty", 214),
  S("girls", "GIRLS", "The Kid LAROI", 166),
  S("miyode", "Mi Yo De Antes", "Ozuna", 191),
  S("lemonade", "LEMONADE (feat. Becky G)", "aespa", 173),
  S("americangirls", "American Girls", "Harry Styles", 197),
  S("onefoot", "One Foot Out", "Infinity Song", 203),
  S("otherside", "other side.", "Breez", 178),
  S("whitekeys", "White Keys", "Dominic Fike", 184),
];
export const HUB_HOSTS: Card[] = [
  C("host-kelleigh", "Kelleigh Bannen’s Emerald Coast", "The Kelleigh Bannen Show"),
  C("host-evelyn", "Evelyn Sicairos’ Golden Hour", "La Oficial Radio with Evelyn"),
  C("host-matt", "Matt Wilkinson’s Seaside Set", "The Matt Wilkinson Show"),
];
export const SUMMER_ALBUMS: Card[] = [
  C("sa-1", "Sunset Tapes", "Various Artists"),
  C("sa-2", "Harbour Lights", "Various Artists"),
  C("sa-3", "Open Windows", "Various Artists"),
];

/* Пометки явного контента у Summer Anthems (по эталону) */
export const ANTHEMS_E = new Set(["dracula", "motionparty", "girls", "miyode"]);

/* Все песни каталога — для поиска */
export const ALL_SONGS: Song[] = (() => {
  const seen = new Set<string>(); const out: Song[] = [];
  for (const s of [...QUEUE0, ...BEST_NEW_SONGS, ...TRENDING, ...SUMMER_ANTHEMS]) {
    if (!seen.has(s.id)) { seen.add(s.id); out.push(s); }
  }
  return out;
})();
