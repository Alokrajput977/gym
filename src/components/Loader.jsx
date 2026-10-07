import { useEffect, useState } from 'react';
import './Loader.css';

/*
 * GYMNASTICS ACADEMY – arena loader
 *  Midnight arena, upar se spotlight, split-leap gymnast silhouette jiske haath se
 *  ribbon behta hai, stage disc ripples, sparkles, shimmer title + progress.
 *  Sirf CSS + ek SVG (koi 3D library / image nahi). Load hote hi DOM se hat jaata hai.
 */

const STEPS = [
  'Setting up the arena',
  'Laying the sprung floor',
  'Hanging the rings',
  'Chalking up the bars',
  'Warming up the gymnasts',
];

/* ---------- Silhouette: skeleton se smooth tapered limbs ---------- */
// [x1, y1, r1, x2, y2, r2] – do joints ke beech tapered segment
const LIMBS = [
  [157, 100, 5, 136, 76, 4], [136, 76, 4, 117, 55, 3], // left arm (upar, ribbon wala)
  [160, 102, 5, 187, 88, 4], [187, 88, 4, 214, 77, 3], // right arm (aage)
  [154, 158, 10.5, 197, 151, 7], [197, 151, 7, 238, 147, 4], [238, 147, 4, 255, 144, 2.4], // front leg
  [146, 162, 10.5, 108, 170, 7], [108, 170, 7, 68, 176, 4], [68, 176, 4, 50, 179, 2.4], // back leg
  [160, 96, 4.6, 163, 84, 4.2], // neck
];
// Spine points [x, y, half-width] – hip se gardan tak (leotard)
const SPINE = [[150, 163, 11.5], [152, 150, 10.5], [154, 136, 8.6], [156, 120, 10.5], [158, 106, 11.5], [160, 98, 7.5], [161, 93, 5]];

function segPath([x1, y1, r1, x2, y2, r2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const p = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  return `M${p(x1 + nx * r1, y1 + ny * r1)} L${p(x2 + nx * r2, y2 + ny * r2)} L${p(x2 - nx * r2, y2 - ny * r2)} L${p(x1 - nx * r1, y1 - ny * r1)} Z`;
}

const LIMB_PATHS = LIMBS.map(segPath);
const JOINTS = LIMBS.flatMap(([x1, y1, r1, x2, y2, r2]) => [[x1, y1, r1], [x2, y2, r2]]);
/** Spine ke dono taraf offset karke ek smooth body outline (quadratic curves). */
function bodyPath(pts) {
  const left = [];
  const right = [];
  pts.forEach(([x, y, w], i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
  });
  const f = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const smooth = (arr) => {
    let d = '';
    for (let i = 1; i < arr.length - 1; i++) d += ` Q${f(arr[i])} ${f(mid(arr[i], arr[i + 1]))}`;
    return `${d} L${f(arr[arr.length - 1])}`;
  };
  const r = [...right].reverse();
  const top = pts[pts.length - 1];
  const bot = pts[0];
  return `M${f(left[0])}${smooth(left)} Q${f([top[0] + (top[0] - pts[pts.length - 2][0]) * 0.6, top[1] + (top[1] - pts[pts.length - 2][1]) * 0.6])} ${f(r[0])}${smooth(r)} Q${f([bot[0] - (pts[1][0] - bot[0]) * 0.9, bot[1] - (pts[1][1] - bot[1]) * 0.9])} ${f(left[0])} Z`;
}

const BODY_PATH = bodyPath(SPINE);

function Gymnast() {
  return (
    <svg className="gx__figure" viewBox="0 0 300 300" aria-hidden="true">
      <defs>
        <linearGradient id="gxSkin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9ccff" />
        </linearGradient>
        <linearGradient id="gxSuit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff6fb1" />
          <stop offset="1" stopColor="#b5179e" />
        </linearGradient>
        <linearGradient id="gxRibbon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd36e" />
          <stop offset="0.5" stopColor="#ff4f9a" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* Ribbon – haath se behta hua */}
      <path
        className="gx__ribbon"
        pathLength="1000"
        d="M117 55 C 96 16, 26 26, 32 88 C 38 150, 124 128, 98 204 C 80 256, 168 274, 220 238 C 262 208, 252 150, 284 118"
      />
      <path
        className="gx__ribbon gx__ribbon--ghost"
        pathLength="1000"
        d="M117 55 C 96 16, 26 26, 32 88 C 38 150, 124 128, 98 204 C 80 256, 168 274, 220 238 C 262 208, 252 150, 284 118"
      />

      <g fill="url(#gxSkin)">
        {LIMB_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
        {JOINTS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
        <circle cx="165" cy="75" r="13" />
        <circle cx="153" cy="66" r="6.5" />
      </g>
      <path d={BODY_PATH} fill="url(#gxSuit)" />
      {/* leotard ki chamak */}
      <path d="M150 156 Q152 130 157 108" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

const SPARKS = [
  { x: 14, y: 22, s: 1, d: 0 },
  { x: 84, y: 16, s: 0.8, d: 0.6 },
  { x: 90, y: 58, s: 0.6, d: 1.2 },
  { x: 8, y: 62, s: 0.7, d: 1.8 },
  { x: 50, y: 6, s: 0.55, d: 0.9 },
];

const DUST = Array.from({ length: 14 }, (_, i) => ({
  left: 30 + ((i * 37) % 40),
  delay: (i * 0.53) % 6,
  dur: 6 + (i % 5),
  size: 2 + (i % 3),
}));

export default function Loader({ visible }) {
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(3);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    const a = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1500);
    const b = setInterval(() => setPct((p) => Math.min(96, p + (96 - p) * 0.07 + 0.2)), 120);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [visible]);

  useEffect(() => {
    if (visible) return undefined;
    setPct(100);
    const t = setTimeout(() => setGone(true), 1000);
    return () => clearTimeout(t);
  }, [visible]);

  if (gone) return null;
  const value = Math.round(pct);

  return (
    <div className={`gx ${visible ? '' : 'gx--done'}`} role="status" aria-live="polite" aria-hidden={!visible}>
      <div className="gx__spot" aria-hidden="true" />
      <div className="gx__dust" aria-hidden="true">
        {DUST.map((p, i) => (
          <span
            key={i}
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="gx__stage" aria-hidden="true">
        <div className="gx__floor">
          <span className="gx__ripple" />
          <span className="gx__ripple gx__ripple--2" />
        </div>
        <div className="gx__float">
          <Gymnast />
        </div>
        {SPARKS.map((s, i) => (
          <svg
            key={i}
            className="gx__spark"
            viewBox="0 0 20 20"
            style={{ left: `${s.x}%`, top: `${s.y}%`, '--s': s.s, animationDelay: `${s.d}s` }}
          >
            <path d="M10 0 C11 7 13 9 20 10 C13 11 11 13 10 20 C9 13 7 11 0 10 C7 9 9 7 10 0Z" />
          </svg>
        ))}
      </div>

      <div className="gx__text">
        <span className="gx__eyebrow">Welcome to</span>
        <h1 className="gx__title">Gymnastics Academy</h1>
      </div>

      <div className="gx__progress">
        <div className="gx__track" aria-hidden="true">
          <span className="gx__fill" style={{ transform: `scaleX(${value / 100})` }} />
        </div>
        <div className="gx__meta">
          <span className="gx__status" key={step}>
            {visible ? STEPS[step] : 'Ready'}
          </span>
          <span className="gx__pct">{value}%</span>
        </div>
      </div>
    </div>
  );
}
