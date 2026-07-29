/**
 * Ц12 · селфтест на живых данных: боевой katha.ts (собран esbuild) получает
 * провод НОВЫХ маршрутов (каталог, дорожки цикла/голоса/страницы, точечные с
 * местами) и обязан восстановить ПОЛНЫЙ старый вид дорожки поле-в-поле, а
 * места из ROW_NUMBER сервера — совпасть с позициями строк областных выборок.
 * Данные кладёт рядом katha-c12-pull (JSON из D1 тем же SQL, что в воркере).
 */
import { readFileSync } from "node:fs";
import * as K from "/tmp/katha.bundle.mjs";

const D = JSON.parse(readFileSync("/tmp/c12-data.json", "utf8"));
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log("  ✗", msg); } };

/* провод: та же элизия, что в kathaWire воркера */
const wire = (r, alb) => {
  const t = { album: r.album_id, file: r.file, title: r.title, duration: r.duration ?? 0 };
  const a = alb.get(r.album_id);
  if (!a || r.identifier !== a.archive) t.identifier = r.identifier;
  if (!a || r.speaker_slug !== a.speaker) t.speaker = r.speaker_slug;
  return t;
};

const albums = D.albums.map((r) => ({
  id: r.id, speaker: r.speaker_slug, title: r.title, archive: r.archive ?? undefined,
  year: r.year ?? undefined, note: r.note ?? undefined, n: r.n, secs: r.secs ?? 0,
})).filter((a) => a.n > 0);
const albMap = new Map(albums.map((a) => [a.id, a]));
const speakers = D.speakers.map((r) => ({ slug: r.slug, name: r.name, role: r.role ?? "", bio: r.bio ?? "", mono: r.mono ?? "" }));
K.setKathaCatalog(speakers, albums);

console.log("═ 1. Цикл: восстановление поле-в-поле (" + D.albumRows.length + " строк, " + D.albumId + ")");
K.setAlbumTracks(D.albumId, D.albumRows.map((r) => wire(r, albMap)));
const at = K.albumTracks(D.albumId);
ok(at.length === D.albumRows.length, `длина ${at.length} ≠ ${D.albumRows.length}`);
D.albumRows.forEach((r, i) => {
  const t = at[i];
  ok(t.id === r.identifier + "/" + r.file, `id[${i}]`);
  ok(t.identifier === r.identifier, `identifier[${i}]: ${t.identifier} ≠ ${r.identifier}`);
  ok(t.speaker === r.speaker_slug, `speaker[${i}]`);
  ok(t.album === r.album_id && t.file === r.file && t.title === r.title && t.duration === (r.duration ?? 0), `поля[${i}]`);
});

console.log("═ 2. Голос: то же (" + D.speakerRows.length + " строк, " + D.speakerSlug + ") — внутри есть чужой identifier «Упадешамриты»");
K.setSpeakerTracks(D.speakerSlug, D.speakerRows.map((r) => wire(r, albMap)));
const st = K.speakerTracks(D.speakerSlug);
ok(st.length === D.speakerRows.length, `длина ${st.length} ≠ ${D.speakerRows.length}`);
let elided = 0, kept = 0;
D.speakerRows.forEach((r, i) => {
  const t = st[i];
  ok(t.identifier === r.identifier && t.speaker === r.speaker_slug, `восст[${i}]: ${t.identifier}/${t.speaker} ≠ ${r.identifier}/${r.speaker_slug}`);
  const w = wire(r, albMap);
  if (w.identifier === undefined) elided++; else kept++;
});
console.log(`  провод: identifier срезан у ${elided}, оставлен у ${kept} (исключения настоящие)`);
ok(!!kept === !!D.speakerHasForeign, "исключения не там, где ждали");

console.log("═ 3. Страница «всех» (after=" + D.allAfter + ", " + D.allRows.length + " строк): порядок и склейка");
/* хранилище пустое на страницах — докладываем с нуля постранично */
K.appendAllTracks(0, D.allFirst.map((r) => wire(r, albMap)), D.total);
K.appendAllTracks(D.allFirst.length, D.allRows.map((r) => wire(r, albMap)), D.total);
const all = K.allTracksLoaded();
ok(all.length === D.allFirst.length + D.allRows.length, `склейка: ${all.length}`);
ok(K.kathaAllTotal() === D.total, `total: ${K.kathaAllTotal()} ≠ ${D.total}`);
D.allRows.forEach((r, i) => {
  const t = all[D.allFirst.length + i];
  ok(t.id === r.identifier + "/" + r.file, `all[${D.allFirst.length + i}] ≠ строке страницы ${i}`);
});
/* не та страница — порядок не рвём */
K.appendAllTracks(3, D.allRows.slice(0, 1).map((r) => wire(r, albMap)), D.total);
ok(K.allTracksLoaded().length === all.length, "чужая страница приклеилась — порядок порван");

console.log("═ 4. Точечные с местами сервера: место = позиция в областной выборке");
K.setTailTracks(D.tailRows.map((r) => ({ ...wire(r, albMap), gi: r.gi, vi: r.vi, ci: r.ci })));
for (const r of D.tailRows) {
  const t = K.trackByTail(r.identifier + "/" + r.file);
  ok(!!t, `хвост не найден: ${r.file}`);
  if (!t) continue;
  if (r.album_id === D.albumId) ok(at[t.ci]?.id === t.id, `ci=${t.ci} мимо позиции в цикле`);
  if (r.speaker_slug === D.speakerSlug) ok(st[t.vi]?.id === t.id, `vi=${t.vi} мимо позиции у голоса`);
}
ok(K.trackByTail(D.tailRows[0].identifier + "/" + D.tailRows[0].file + "?v=2")?.file === D.tailRows[0].file, "хвост с ?v=2 не срезался");

console.log("═ 5. Часы цикла из каталога (secs воркера)");
const hrs = K.albumHours(D.albumId);
const want = (albMap.get(D.albumId).secs ?? 0) / 3600;
ok(Math.abs(hrs - want) < 1e-9, `albumHours ${hrs} ≠ ${want}`);

console.log(fails === 0 ? "\nИТОГ: все сходятся" : `\nИТОГ: РАСХОЖДЕНИЙ ${fails}`);
process.exit(fails ? 1 : 0);
