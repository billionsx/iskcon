import { useEffect, useRef, useState } from "react";
import "./fitness.css";

/**
 * ЭТАЛОННЫЕ ЭКРАНЫ FITNESS — /design/fitness
 *
 * Три экрана Apple Fitness iOS 26.5, воспроизведённые по обмеру кадра. Это ОБРАЗЕЦ,
 * по которому строится интерфейс приложения: конституция docs/ONE_LOVE_DESIGN.md
 * описывает правила словами, здесь они работают.
 *
 * Стенд 393×852 pt вписывается в окно масштабом — координаты внутри остаются в pt,
 * иначе обмер потерял бы смысл.
 *
 * ЗКН-Д026: трекинг вычисляется на месте под доступный шрифт, а в разметке хранится
 * ЗАМЕР ширины чернил, снятый с кадра (data-w). Без этого пересчёта строки в
 * приложении расходятся с эталоном сильнее, чем в мокапе: 6.17 % против 3.85 %.
 */

type Screen = "01" | "02" | "03";

const TITLE: Record<Screen, string> = {
  "01": "Workout · тренировка",
  "02": "Awards · награды",
  "03": "Sessions · история",
};

/** Следующий экран по кругу — стенд листается нажатием на сам экран. */
const NEXT: Record<Screen, Screen> = { "01": "02", "02": "03", "03": "01" };

export default function DesignFitness(
  { screen, onPick, onClose }:
  { screen: Screen; onPick: (n: Screen) => void; onClose?: () => void },
) {
  const setScreen = onPick;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      const box = wrapRef.current?.parentElement;
      if (!box) return;
      const k = Math.min(box.clientWidth / 393, (box.clientHeight - 24) / 852, 1);
      setScale(k > 0 ? k : 1);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  /* Подгонка трекинга — ЗКН-Д026. Считается после загрузки шрифтов и на каждой
     смене экрана: разметка нового экрана появляется в DOM только тогда. */
  useEffect(() => {
    let alive = true;
    const run = () => {
      if (!alive) return;
      const root = wrapRef.current;
      if (!root) return;
      (function(){
        var st = document.querySelector('.stage');
        if (!st) return;
        var ctx = document.createElement('canvas').getContext('2d');
        function num(name){ return parseFloat(getComputedStyle(st).getPropertyValue('--'+name)); }
        function ink(el, ls){
          var cs = getComputedStyle(el);
          ctx.font = cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
          if ('letterSpacing' in ctx) ctx.letterSpacing = ls+'px';
          var m = ctx.measureText(el.textContent);
          return { w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, l: m.actualBoundingBoxLeft };
        }
        function fit(){
          var list = st.querySelectorAll<HTMLElement>('[data-w]');
          for (var i=0;i<list.length;i++){
            var el = list[i], target = num(el.dataset.w);
            var n = (el.textContent||'').length;
            if (!(target>0) || n<2) continue;
            var ls = 0;
            for (var k=0;k<5;k++){
              var m = ink(el, ls);
              if (Math.abs(m.w-target) < 0.02) break;
              ls += (target - m.w)/(n-1);
            }
            /* ПРЕДЕЛ ПОПРАВКИ. Системный трекинг Apple не выходит за ±0.4 pt на текстовых
               кеглях. Если подгонка просит больше — виноват не трекинг, а КЕГЛЬ: строка
               набрана не тем размером, и разницу вытягивает межбуквенный просвет. На чужом
               шрифте эта разница будет другой, и текст поедет. Поэтому поправка режется:
               лучше строка естественной ширины, чем раздавленная или растянутая. */
            if (ls >  0.4) ls =  0.4;
            if (ls < -0.4) ls = -0.4;
            el.style.letterSpacing = ls.toFixed(4)+'px';
            if (el.dataset.x){
              var mm = ink(el, ls);
              el.style.left = (num(el.dataset.x) + mm.l).toFixed(2)+'px';
            }
          }
        }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
        else window.addEventListener('load', fit);
      })();
    };
    if ((document as any).fonts?.ready) (document as any).fonts.ready.then(run);
    else run();
    const t = setTimeout(run, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [screen]);

  return (
    <div className="fit-root">
      <div className="fit-bar">
        <button className="fit-back" onClick={onClose} aria-label="Назад">←</button>
        <span className="fit-title">{TITLE[screen]}</span>
        <div className="fit-pick">
          {(["01", "02", "03"] as Screen[]).map((s) => (
            <button key={s} className={s === screen ? "on" : ""} onClick={() => setScreen(s)}>
              {s === "01" ? "Тренировка" : s === "02" ? "Награды" : "История"}
            </button>
          ))}
        </div>
      </div>

      <div className="fit-box">
        <div
          ref={wrapRef}
          className="fit-wrap"
          style={{ transform: `scale(${scale})` }}
          onClick={() => setScreen(NEXT[screen])}
          title="Нажмите, чтобы перейти к следующему экрану"
        >
          {screen === "01" && <div className="fit-01"><div className="stage">

  <div className="t sb-time" data-w="w-sb-time" data-x="sb-time-x">22:45</div>
  <i className="g g-sbheart sb-heart"></i>
  <div className="sb-sig"><b></b><b></b><b></b><b></b></div>
  <div className="t sb-lte" data-w="w-lte" data-x="sb-lte-x">LTE</div>
  <i className="g g-batgrey bat"></i><i className="g g-batwhite bat-f"></i>

  <div className="t title" data-w="w-title" data-x="title-x">Workout</div>
  <div className="hbtn hbtn1"></div><i className="g g-compose"></i>
  <div className="hbtn hbtn2"></div><i className="g g-hrslash"></i>

  <div className="ban"><div className="ban-icon"></div><i className="g g-heart"></i>
    <div className="t ban-t" data-w="w-ban1" style={{top: "calc(var(--ban-t-top) + 0*var(--ban-text-step))"}}>To track other workout types,</div><div className="t ban-t" data-w="w-ban2" style={{top: "calc(var(--ban-t-top) + 1*var(--ban-text-step))"}}>connect Apple Watch, AirPods</div><div className="t ban-t" data-w="w-ban3" style={{top: "calc(var(--ban-t-top) + 2*var(--ban-text-step))"}}>with heart rate detection or a</div><div className="t ban-t" data-w="w-ban4" style={{top: "calc(var(--ban-t-top) + 3*var(--ban-text-step))"}}>device with a heart rate sensor.</div><div className="ban-x"></div><i className="g g-xmark"></i></div>

  <div className="tc tc1">
    <i className="g g-walk g-glyph"></i>
    <div className="tc-play"></div><i className="g g-play"></i>
    <div className="t tc-title" data-w="w-tc1-title">Outdoor Walk</div>
    <div className="slot slot-l"></div><div className="slot slot-r"></div>
    <i className="g g-note"></i><i className="g g-timer"></i>
  </div>
  <div className="tc tc2">
    <i className="g g-run g-glyph"></i>
    <div className="tc-play"></div><i className="g g-play"></i>
    <div className="t tc-title" data-w="w-tc2-title">Outdoor Run</div>
    <div className="slot slot-l"></div><div className="slot slot-r"></div>
    <i className="g g-note"></i><i className="g g-timer"></i>
  </div>
  <div className="tc tc3">
    <i className="g g-cycle g-glyph"></i>
    <div className="tc-play"></div><i className="g g-play"></i>
    <div className="t tc-title" data-w="w-tc3-title">Outdoor Cycle</div>
    <div className="slot slot-l"></div><div className="slot slot-r"></div>
    <i className="g g-note"></i><i className="g g-timer"></i>
  </div>
  <div className="scrim"></div>
  <div className="bar"></div><div className="pill"></div>
  <div className="badge"></div>
  <i className="g g-rings"></i><i className="g g-people"></i><i className="g g-badge"></i>
  <div className="t lb lb1" data-w="w-lb1">Summary</div>
  <div className="t lb lb2" data-w="w-lb2">Workout</div>
  <div className="t lb lb3" data-w="w-lb3">Sharing</div>

          </div></div>}
          {screen === "02" && <div className="fit-02"><div className="stage">

  <div className="t sb-time" data-w="w-sb-time" data-x="sb-time-x">22:46</div>
  <i className="g g-sbheart sb-heart"></i>
  <div className="sb-sig"><b></b><b></b><b></b><b></b></div>
  <div className="t sb-lte" data-w="w-lte" data-x="sb-lte-x">LTE</div>
  <i className="g g-batgrey bat"></i><i className="g g-batwhite bat-f"></i>

  <div className="hbtn"></div><i className="g g-chevron"></i>
  <div className="t title" data-w="w-title" data-x="title-x">Awards</div>

  <div className="card c1">
    <div className="a-award1"></div>
    <div className="a-ghost"></div>
    <div className="t c1-t1" data-w="w-c1-t1">Go For It</div>
    <div className="t c1-t2" data-w="w-c1-t2">365 Move Goals</div>
    <div className="t c1-t3" data-w="w-c1-t3">286 of 365</div>
    <div className="t c1-link" data-w="w-link1">Show All</div>
  </div>

  <div className="card c2">
    <div className="t c2-head" data-w="w-c2-head">Close Your Rings</div>
    <div className="a-medal"></div>
    <div className="t c2-cap c2-cap1" data-w="w-cap1">New Move Goal</div>
    <div className="t c2-cap c2-cap2" data-w="w-cap2">Today</div>
    <div className="a-stack"></div>
    <div className="t c2-more" data-w="w-more">+7 more</div>
    <div className="t c2-link" data-w="w-link2">Show All</div>
  </div>

  <div className="tile tile-l"><div className="t" data-w="w-tile1">Monthly</div><div className="t t2" data-w="w-tile2">Challenge</div></div>
  <div className="tile tile-r"><div className="t" data-w="w-tile3">Workouts</div></div>

  <div className="scrim"></div>
  <div className="bar"></div><div className="pill"></div><div className="glow"></div>
  <i className="g g-ringslime"></i><i className="g g-runtab"></i><i className="g g-people"></i>
  <div className="t lb lb1" data-w="w-lb1">Summary</div>
  <div className="t lb lb2" data-w="w-lb2">Workout</div>
  <div className="t lb lb3" data-w="w-lb3">Sharing</div>

          </div></div>}
          {screen === "03" && <div className="fit-03"><div className="stage">

  <div className="t sb-time" data-w="w-sb-time" data-x="sb-time-x">22:46</div>
  <i className="g g-sbheart sb-heart"></i>
  <div className="sb-sig"><b></b><b></b><b></b><b></b></div>
  <div className="t sb-lte" data-w="w-lte" data-x="sb-lte-x">LTE</div>
  <i className="g g-batgrey bat"></i><i className="g g-batwhite bat-f"></i>

  <div className="hbtn"></div><div className="hbtn2"></div>
  <i className="g g-chevron"></i><i className="g g-hdr2"></i>
  <div className="t title" data-w="w-title" data-x="title-x">Sessions</div>

  <div className="chip chip0"><div className="t" data-w="w-chip0">All</div></div>
  <div className="chip chip1"><div className="t" data-w="w-chip1">Workouts</div></div>
  <div className="chip chip2"><div className="t" data-w="w-chip2">Walking</div></div>
  <div className="chip chip3"><div className="t" data-w="w-chip3">Other</div></div>
  <div className="chip chip4"><div className="t" data-w="w-chip4">Hiking</div></div>

  <div className="t month m1" data-w="w-month1" data-x="col-x">July 2026</div>
  <div className="t hcol h1" data-w="w-total" data-x="col2-x">Total</div>
  <div className="t hcol h2" data-w="w-avg" data-x="col3-x">Average</div>
  <div className="t rw rl y1" data-w="w-r1" data-x="col-x">Workouts</div>
  <div className="t rw rc y1" data-w="w-v1" data-x="col2-x">1</div>
  <div className="t rw rl y2" data-w="w-r2" data-x="col-x">Time</div>
  <div className="t rw rc y2 vt" data-w="w-t1" data-x="col2-x">0:30:00</div>
  <div className="t rw rr y2 vt" data-w="w-t2" data-x="col3-x">0:30:00</div>
  <div className="t rw rl y3" data-w="w-r3" data-x="col-x">Kilocalories</div>
  <div className="t rw rc y3 vk" data-w="w-k1" data-x="col2-x">213 KCAL</div>
  <div className="t rw rr y3 vk" data-w="w-k2" data-x="col3-x">213 KCAL</div>

  <div className="card c1">
    <div className="disc"></div>
    <i className="g g-dance ci"></i>
    <div className="t ct1" data-w="w-c1">Social Dance</div>
    <div className="t ct2" data-w="w-c1v">213</div>
    <div className="t cu" data-w="w-c1u">KCAL</div>
    <div className="t cd" data-w="w-c1d">Today</div>
  </div>

  <div className="t month m2" data-w="w-month2" data-x="col-x">October 2025</div>
  <div className="t hcol h1b" data-w="w-total" data-x="col2-x">Total</div>
  <div className="t hcol h2b" data-w="w-avg" data-x="col3-x">Average</div>
  <div className="t rw rl y1b" data-w="w-r1" data-x="col-x">Workouts</div>
  <div className="t rw rc y1b" data-w="w-v1b" data-x="col2-x">4</div>
  <div className="t rw rl y2b" data-w="w-r2" data-x="col-x">Time</div>
  <div className="t rw rc y2b vt" data-w="w-t1b" data-x="col2-x">2:32:56</div>
  <div className="t rw rr y2b vt" data-w="w-t2b" data-x="col3-x">0:38:14</div>
  <div className="t rw rl y3b" data-w="w-r3" data-x="col-x">Kilocalories</div>
  <div className="t rw rc y3b vk" data-w="w-k1b" data-x="col2-x">622 KCAL</div>
  <div className="t rw rr y3b vk" data-w="w-k2b" data-x="col3-x">155 KCAL</div>

  <div className="card c2">
    <div className="disc"></div>
    <i className="g g-walk2 ci"></i>
    <div className="t ct1" data-w="w-c2">Outdoor Walk</div>
    <div className="t ct2" data-w="w-c2v">0:49</div>
    <div className="t cd" data-w="w-c2d">16.10.2025</div>
  </div>

  <div className="card c3">
    <div className="disc"></div>
    <i className="g g-walk2 ci"></i>
    <div className="t ct1" data-w="w-c3">Outdoor Walk</div>
    <div className="t ct2" data-w="w-c3v">0:49</div>
    <div className="t cd" data-w="w-c2d">15.10.2025</div>
  </div>

  <div className="c4"></div>
  <div className="scrim"></div>
  <div className="bar"></div><div className="glow"></div><div className="pill"></div>
  <i className="g g-rings"></i><i className="g g-runtab"></i><i className="g g-people"></i>
  <div className="t lb lb1" data-w="w-lb1">Summary</div>
  <div className="t lb lb2" data-w="w-lb2">Workout</div>
  <div className="t lb lb3" data-w="w-lb3">Sharing</div>

          </div></div>}
        </div>
      </div>
    </div>
  );
}
