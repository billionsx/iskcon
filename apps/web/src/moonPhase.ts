/**
 * Фаза Луны по дате — чтобы Экадаши отмечались НАСТОЯЩИМ ликом Луны, а не одним
 * дежурным полумесяцем. Экадаши — 11-я титхи: в светлую половину (шукла-пакша)
 * Луна растущая, почти полная (гиббозная); в тёмную (кришна-пакша) — убывающая,
 * тонкий серп. Полнолуние (пурнима) и новолуние (амавасья) — предельные лики.
 *
 * Считаем среднюю фазу от опорного новолуния (2000-01-06 18:14 UTC) по синодическому
 * месяцу. Точность ~сутки — этого с запасом хватает, чтобы выбрать верный глиф.
 * Освещённость lit ∈ [0,1] заливается цветом глифа; неосвещённое — прозрачно
 * (канон иконографии фаз). Растущая — свет справа; убывающая — слева.
 */

const SYNODIC = 29.530588853;
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // мс опорного новолуния

/** Возраст Луны (сутки от новолуния, 0..SYNODIC) для даты YYYY-MM-DD (полдень UTC). */
function moonAge(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const ms = Date.UTC(y, (m || 1) - 1, d || 1, 12);
  let age = ((ms - REF_NEW_MOON) / 86_400_000) % SYNODIC;
  if (age < 0) age += SYNODIC;
  return age;
}

export interface MoonPhase {
  frac: number;    // освещённая доля 0..1
  waxing: boolean; // true — растущая (свет справа)
  age: number;     // возраст в сутках
}

export function moonPhase(iso: string): MoonPhase {
  const age = moonAge(iso);
  const frac = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
  return { frac, waxing: age < SYNODIC / 2, age };
}

/** SVG-path освещённой части диска (заливка). Растущая — справа, убывающая — слева.
 *  Серп (frac<0.5) и гиббоз (frac>0.5) строятся терминатором-эллипсом. */
export function moonLitPath(frac: number, waxing: boolean, r = 9, cx = 12, cy = 12): string {
  const f = Math.max(0.001, Math.min(0.999, frac));
  const phi = Math.acos(1 - 2 * f);   // 0..π
  const b = r * Math.cos(phi);        // + серп, − гиббоз
  const outer = waxing ? 1 : 0;       // внешняя дуга по светлой стороне
  const term = waxing ? (b < 0 ? 1 : 0) : (b < 0 ? 0 : 1);
  const rx = Math.abs(b).toFixed(3);
  return `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outer} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${term} ${cx} ${cy - r} Z`;
}

/** Короткая подпись фазы (для экрана Экадаши). */
export function moonPhaseLabel(p: MoonPhase): string {
  if (p.frac >= 0.985) return "полнолуние";
  if (p.frac <= 0.03) return "новолуние";
  const dir = p.waxing ? "растущая" : "убывающая";
  const shape = p.frac >= 0.5 ? "почти полная" : "серп";
  return `${dir} Луна · ${shape}`;
}

/** Пакша (половина лунного месяца) — светлая при растущей, тёмная при убывающей. */
export function pakshaLabel(p: MoonPhase): string {
  return p.waxing ? "шукла-пакша · светлая половина" : "кришна-пакша · тёмная половина";
}
