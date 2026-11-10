// Generates Bayeux-style "alien tapestry" scenes as SVG and renders them to JPEG.
const fs = require('fs');
const path = require('path');

const C = {
  linen: '#e6d9bf',
  red: '#a4523b',
  ochre: '#c39a45',
  sage: '#7f8c5a',
  blue: '#3f5866',
  wine: '#6b3d36',
  dark: '#2e2822',
  skin: '#93a26a', // alien green wool
  pale: '#d8c79f',
};

// ── primitives ────────────────────────────────────────────────────────────
const O = `stroke="${C.dark}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="3.2 1.1"`;
const fill = (c) => `fill="url(#w-${c})"`;

function line(pts, color, w = 4) {
  const d = 'M' + pts.map((p) => p.join(' ')).join('L');
  return `<path d="${d}" fill="none" stroke="${C.dark}" stroke-width="${w + 2.2}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${C[color]}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2.4 0.8"/>`;
}

function text(x, y, s, size = 13, anchor = 'start') {
  return `<text x="${x}" y="${y}" font-family="Uncial" font-size="${size}" fill="${C.blue}" text-anchor="${anchor}" letter-spacing="0.5">${s}</text>`;
}

// Alien in tunic. dir: 1 faces right, -1 left. arms: [[dx,dy],[dx,dy]] hand offsets from shoulders.
function alien(x, o = {}) {
  const dir = o.dir ?? 1;
  const tunic = o.tunic ?? 'red';
  const hose = o.hose ?? 'blue';
  const s = o.s ?? 1;
  const arms = o.arms ?? [[-8, 24], [10, 22]];
  const base = o.base ?? 188;
  let g = '';
  // legs
  if (o.seated) {
    g += line([[x - dir * 4, 144], [x + dir * 20, 146], [x + dir * 19, 184]], hose, 4.5);
    g += line([[x - dir * 2, 148], [x + dir * 24, 150], [x + dir * 25, 184]], hose, 4.5);
    g += `<ellipse cx="${x + dir * 21}" cy="186" rx="5" ry="2.4" fill="${C.dark}"/><ellipse cx="${x + dir * 27}" cy="186" rx="5" ry="2.4" fill="${C.dark}"/>`;
  } else {
    g += line([[x - 2, 150], [x - 7, base - 3]], hose, 4);
    g += line([[x + 2, 150], [x + 7, base - 3]], hose, 4);
    g += `<ellipse cx="${x - 8 + dir * 2}" cy="${base - 1}" rx="5" ry="2.4" fill="${C.dark}"/>`;
    g += `<ellipse cx="${x + 8 + dir * 2}" cy="${base - 1}" rx="5" ry="2.4" fill="${C.dark}"/>`;
  }
  // cloak behind
  if (o.cloak) g += `<path d="M${x - dir * 2} 116 Q${x - dir * 22} 140 ${x - dir * 16} 166 L${x - dir * 4} 158z" ${fill(o.cloak)} ${O}/>`;
  // tunic
  const tb = o.seated ? 146 : 154;
  g += `<path d="M${x - 13} ${tb} L${x - 8} 119 Q${x} 113 ${x + 8} 119 L${x + 13} ${tb} Q${x} ${tb + 5} ${x - 13} ${tb}z" ${fill(tunic)} ${O}/>`;
  g += `<path d="M${x - 10} 137 Q${x} 140 ${x + 10} 137" fill="none" stroke="${C.dark}" stroke-width="1.6"/>`;
  // arms
  const sh = [[x - 7, 122], [x + 7, 122]];
  arms.forEach(([dx, dy], i) => {
    const [sx, sy] = sh[i];
    const hx = sx + dx * dir, hy = sy + dy;
    g += line([[sx, sy], [(sx + hx) / 2 + (i ? 2 : -2), (sy + hy) / 2 + 3], [hx, hy]], tunic, 4);
    g += `<circle cx="${hx}" cy="${hy}" r="2.6" fill="url(#w-skin)" ${O}/>`;
  });
  // neck + alien head
  g += line([[x, 114], [x + dir * 1, 107]], 'skin', 3.5);
  g += `<ellipse cx="${x + dir * 2}" cy="95" rx="10.5" ry="12.5" transform="rotate(${dir * -12} ${x + dir * 2} 95)" ${fill('skin')} ${O}/>`;
  g += `<ellipse cx="${x + dir * 6.5}" cy="95" rx="3.6" ry="2" transform="rotate(${dir * 22} ${x + dir * 6.5} 95)" fill="${C.dark}"/>`;
  g += `<path d="M${x + dir * 9} 103 l${dir * 2.5} 0" stroke="${C.dark}" stroke-width="1.2"/>`;
  // antennae
  g += `<path d="M${x - 2} 84 Q${x - 6} 77 ${x - 9} 72 M${x + 4} 84 Q${x + 6} 77 ${x + 5} 71" fill="none" stroke="${C.dark}" stroke-width="1.6"/>`;
  g += `<circle cx="${x - 9}" cy="71" r="2.3" fill="url(#w-ochre)" ${O}/><circle cx="${x + 5}" cy="70" r="2.3" fill="url(#w-red)" ${O}/>`;
  if (o.crown) g += `<path d="M${x - 7} 84 l2 -8 3 5 2 -7 2 7 3 -5 2 8z" ${fill('ochre')} ${O}/>`;
  return `<g transform="translate(${x * (1 - s)} ${base * (1 - s)}) scale(${s})">${g}</g>`;
}

// handheld glowing tablet
const tablet = (x, y, r = 0) =>
  `<g transform="rotate(${r} ${x} ${y})"><rect x="${x - 6}" y="${y - 8}" width="12" height="16" rx="1.5" ${fill('ochre')} ${O}/>` +
  `<path d="M${x - 3} ${y - 4}h6M${x - 3} ${y}h6M${x - 3} ${y + 4}h4" stroke="${C.blue}" stroke-width="1.2"/></g>`;

const robot = (x, o = {}) => {
  const b = o.base ?? 188;
  return `<g>` +
    line([[x - 5, b - 34], [x - 6, b - 3]], 'blue', 4.5) + line([[x + 5, b - 34], [x + 6, b - 3]], 'blue', 4.5) +
    `<rect x="${x - 13}" y="${b - 70}" width="26" height="38" rx="3" ${fill('pale')} ${O}/>` +
    `<path d="M${x - 8} ${b - 60}h16M${x - 8} ${b - 52}h16M${x - 8} ${b - 44}h10" stroke="${C.red}" stroke-width="1.6" stroke-dasharray="2 1"/>` +
    line([[x - 13, b - 64], [x - 22, b - 44]], 'pale', 4) + line([[x + 13, b - 64], [x + 22, b - 46]], 'pale', 4) +
    `<rect x="${x - 10}" y="${b - 92}" width="20" height="18" rx="3" ${fill('sage')} ${O}/>` +
    `<circle cx="${x + (o.dir ?? 1) * 3}" cy="${b - 83}" r="4" fill="url(#w-ochre)" ${O}/><circle cx="${x + (o.dir ?? 1) * 3}" cy="${b - 83}" r="1.5" fill="${C.dark}"/>` +
    `<path d="M${x} ${b - 92}v-8" stroke="${C.dark}" stroke-width="1.6"/><circle cx="${x}" cy="${b - 101}" r="2.4" fill="url(#w-red)" ${O}/>` +
    `<ellipse cx="${x - 7}" cy="${b - 1}" rx="5" ry="2.4" fill="${C.dark}"/><ellipse cx="${x + 7}" cy="${b - 1}" rx="5" ry="2.4" fill="${C.dark}"/></g>`;
};

// Bayeux-style tree with curling branches
const tree = (x, c = 'sage') =>
  line([[x, 188], [x, 120]], 'wine', 4) +
  `<path d="M${x} 150 q-14 -6 -14 -22 q8 2 10 10 M${x} 140 q14 -6 14 -22 q-8 2 -10 10 M${x} 124 q-10 -10 -4 -24 q6 8 3 16 M${x} 122 q10 -10 6 -26 q-6 8 -4 18" ${fill(c)} ${O}/>`;

// Flying saucer
const saucer = (x, y, w = 60, beam = false) => {
  let g = '';
  if (beam) g += `<path d="M${x - w * 0.18} ${y + 6} L${x - w * 0.4} ${y + 52} H${x + w * 0.4} L${x + w * 0.18} ${y + 6}z" fill="url(#w-ochre)" opacity="0.55" ${O}/>`;
  g += `<path d="M${x - w * 0.22} ${y - 3} Q${x} ${y - w * 0.36} ${x + w * 0.22} ${y - 3}z" ${fill('pale')} ${O}/>`;
  g += `<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${w * 0.13}" ${fill('red')} ${O}/>`;
  g += `<path d="M${x - w * 0.45} ${y + 1}H${x + w * 0.45}" stroke="${C.ochre}" stroke-width="2.4" stroke-dasharray="3 3"/>`;
  [-0.3, 0, 0.3].forEach((k) => (g += `<circle cx="${x + w * k}" cy="${y - 1}" r="2" fill="url(#w-blue)" ${O}/>`));
  return g;
};

// Starship as a Bayeux longship hull with fins and exhaust
const starship = (x, y, w = 150, o = {}) => {
  const h = w * 0.2;
  let g = '';
  if (o.exhaust) g += `<path d="M${x - w / 2 + 6} ${y - h * 0.4} l-24 -6 6 8 -14 4 14 4 -6 8 24 -6z" ${fill('ochre')} ${O}/>`;
  g += `<path d="M${x - w / 2} ${y - h} Q${x - w * 0.42} ${y} ${x - w * 0.3} ${y} H${x + w * 0.3} Q${x + w * 0.42} ${y} ${x + w / 2} ${y - h}z" ${fill('wine')} ${O}/>`;
  ['ochre', 'red', 'blue'].forEach((c, i) => {
    const yy = y - h + 3 + i * (h / 3.2);
    g += `<path d="M${x - w / 2 + 6 + i * 3} ${yy}H${x + w / 2 - 6 - i * 3}" stroke="${C[c]}" stroke-width="${h / 4.2}" stroke-linecap="round"/>`;
  });
  // dragon prow + stern
  g += `<path d="M${x + w / 2} ${y - h} q6 -16 -2 -26 q10 2 12 -6 q2 10 -6 14 q4 10 -4 18z" ${fill('red')} ${O}/>`;
  g += `<path d="M${x - w / 2} ${y - h} q-6 -14 2 -22 q-4 10 4 14z" ${fill('sage')} ${O}/>`;
  // portholes
  for (let i = -2; i <= 2; i++) g += `<circle cx="${x + i * w * 0.14}" cy="${y - h * 0.55}" r="2.8" fill="url(#w-pale)" ${O}/>`;
  // fin / antenna mast
  if (o.mast !== false) g += `<path d="M${x - 4} ${y - h} L${x} ${y - h - 46} L${x + 4} ${y - h}" ${fill('blue')} ${O}/>` +
    `<path d="M${x} ${y - h - 46} l-14 -8 M${x} ${y - h - 46} l14 -8" stroke="${C.dark}" stroke-width="1.5"/><circle cx="${x}" cy="${y - h - 49}" r="3" fill="url(#w-ochre)" ${O}/>`;
  return g;
};

// Castle tower on a scaled motte, with a dish on top
const castle = (x, o = {}) => {
  let g = '';
  g += `<path d="M${x - 46} 188 Q${x} 128 ${x + 46} 188z" ${fill('sage')} ${O}/>`;
  for (let r = 0; r < 4; r++) for (let i = -3 + r; i <= 3 - r; i++)
    g += `<path d="M${x + i * 10 - 5} ${180 - r * 10} q5 6 10 0" fill="none" stroke="${C.dark}" stroke-width="1.1"/>`;
  g += `<rect x="${x - 18}" y="96" width="36" height="52" ${fill(o.c ?? 'red')} ${O}/>`;
  g += `<path d="M${x - 22} 96 h44 l-4 -10 h-36z" ${fill('blue')} ${O}/>`;
  g += `<path d="M${x - 8} 148 v-18 a8 8 0 0 1 16 0 v18z" fill="url(#w-dark)" ${O}/>`;
  g += `<path d="M${x - 8} 136h16M${x - 8} 142h16M${x - 3} 124v24M${x + 3} 124v24" stroke="${C.ochre}" stroke-width="1.3"/>`;
  g += `<path d="M${x - 14} 108h6M${x + 8} 108h6" stroke="${C.dark}" stroke-width="2"/>`;
  // dish antenna
  g += `<path d="M${x + 6} 86 v-10" stroke="${C.dark}" stroke-width="1.8"/><path d="M${x - 4} 70 a12 12 0 0 0 22 6z" ${fill('pale')} ${O}/>`;
  g += `<path d="M${x + 7} 73 l4 -6" stroke="${C.dark}" stroke-width="1.4"/><circle cx="${x + 11}" cy="66" r="1.8" fill="url(#w-red)"/>`;
  return g;
};

const throne = (x, dir = 1) =>
  `<path d="M${x - 16} 150 h32 v6 h-32z" ${fill('ochre')} ${O}/>` +
  `<path d="M${x - 13} 156 v30 M${x + 13} 156 v30" stroke="${C.dark}" stroke-width="3"/>` +
  `<path d="M${x - dir * 16} 150 v-26 q${-dir * 6} -4 ${-dir * 2} -10 q${dir * 6} 2 ${dir * 4} 8" ${fill('blue')} ${O}/>` +
  `<path d="M${x + dir * 16} 150 v-10 q${dir * 6} -6 ${dir * 2} -10" fill="none" stroke="${C.dark}" stroke-width="2.2"/>`;

const crate = (x, y) =>
  `<rect x="${x - 12}" y="${y - 12}" width="24" height="18" ${fill('wine')} ${O}/>` +
  `<path d="M${x - 12} ${y - 12}l24 18M${x + 12} ${y - 12}l-24 18" stroke="${C.ochre}" stroke-width="1.4"/>` +
  [-6, 0, 6].map((d) => `<circle cx="${x + d}" cy="${y - 15}" r="3.4" fill="url(#w-ochre)" ${O}/>`).join('');

// ── borders, fabric and ageing ────────────────────────────────────────────
function borders(seed) {
  let g = '';
  const bands = [[20, 52], [196, 228]];
  bands.forEach(([a, b], bi) => {
    g += `<rect x="0" y="${a}" width="500" height="${b - a}" fill="url(#w-linen)"/>`;
    g += `<path d="M0 ${bi ? a : b}H500" stroke="${C.dark}" stroke-width="1.6" stroke-dasharray="3 1"/>`;
    for (let i = 0, x = (seed * 7) % 44; x < 520; i++, x += 44) {
      const col = ['red', 'ochre', 'blue', 'sage'][(i + seed + bi) % 4];
      g += `<path d="M${x} ${b - 2} L${x + 14} ${a + 2}" stroke="${C.dark}" stroke-width="5.6" stroke-linecap="round"/>`;
      g += `<path d="M${x} ${b - 2} L${x + 14} ${a + 2}" stroke="${C[col]}" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="2.4 0.8"/>`;
      // creature or tiny saucer between bars
      const cx = x + 29, cy = (a + b) / 2;
      if ((i + seed) % 3 === 0) g += `<ellipse cx="${cx}" cy="${cy + 2}" rx="8" ry="2.6" ${fill('red')} ${O}/><path d="M${cx - 4} ${cy} q4 -7 8 0" ${fill('pale')} ${O}/>`;
      else if ((i + seed) % 3 === 1) g += `<path d="M${cx - 8} ${cy + 4} q4 -10 10 -6 q4 -6 6 2 q-2 2 -4 1 l2 8 M${cx - 4} ${cy + 3} l-2 6 M${cx + 2} ${cy + 4} l1 6" ${fill(['sage', 'ochre', 'wine'][i % 3])} ${O}/>`;
      else g += `<circle cx="${cx}" cy="${cy}" r="4" ${fill('ochre')} ${O}/><path d="M${cx - 9} ${cy}h18" stroke="${C.dark}" stroke-width="1.2"/>`;
    }
  });
  return g;
}

function tufts(seed) {
  let g = '';
  for (let i = 0; i < 9; i++) {
    const x = ((i * 53 + seed * 31) % 480) + 10;
    g += `<path d="M${x} 189 q-3 -8 -7 -10 M${x} 189 q0 -10 2 -13 M${x} 189 q4 -7 8 -8" fill="none" stroke="${C[['sage','ochre','red'][i % 3]]}" stroke-width="1.8"/>`;
  }
  return g;
}

function defs() {
  const pat = Object.entries(C).map(([k, v]) =>
    `<pattern id="w-${k}" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(${k === 'linen' ? 0 : 35})">` +
    `<rect width="3" height="3" fill="${v}"/><path d="M0 0.6H3" stroke="#000" stroke-opacity="${k === 'linen' ? 0.04 : 0.17}" stroke-width="0.9"/></pattern>`).join('');
  return `<defs>${pat}
  <filter id="hand" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6"/>
  </filter>
  <filter id="cloth" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="1.4 0.9" numOctaves="2" seed="7" result="weave"/>
    <feColorMatrix in="weave" type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.17  0 0 0 0 0.1  0 0 0 0.55 -0.12" result="w2"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="11" result="stain"/>
    <feColorMatrix in="stain" type="matrix" values="0 0 0 0 0.32  0 0 0 0 0.22  0 0 0 0 0.1  0 0 0 1.5 -0.62" result="s2"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="w2"/><feMergeNode in="s2"/></feMerge>
  </filter>
  <radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset="0.55" stop-color="#3a2a14" stop-opacity="0"/><stop offset="1" stop-color="#3a2a14" stop-opacity="0.45"/></radialGradient>
  </defs>`;
}

function tapestry(seed, inscription, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 250" width="500" height="250" preserveAspectRatio="xMidYMid slice">${defs()}
  <g filter="url(#cloth)">
    <rect x="0" y="0" width="500" height="250" fill="#d9c9a8"/>
    <rect x="0" y="16" width="500" height="216" fill="url(#w-linen)"/>
    <g filter="url(#hand)">
      ${borders(seed)}
      ${text(14, 70, inscription)}
      <path d="M0 189 q20 -5 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="${C.sage}" stroke-width="2.4" stroke-dasharray="3 1"/>
      ${tufts(seed)}
      ${body}
    </g>
  </g>
  <rect width="500" height="250" fill="url(#vig)"/>
  <path d="M0 0H500V14 q-12 3 -24 0 t-26 1 t-30 -1 t-22 2 t-28 -1 t-30 1 t-24 -2 t-26 2 t-30 -1 t-22 1 t-28 0 t-26 -1 t-30 2 t-24 -1 t-30 0 t-26 1 t-28 -1 t-22 1 t-24 -1 V0z" fill="#1b140c" opacity="0.9"/>
  <path d="M0 250H500V236 q-14 -3 -26 0 t-28 -1 t-24 1 t-30 -2 t-22 1 t-28 1 t-26 -1 t-30 2 t-24 -1 t-28 0 t-24 1 t-26 -2 t-30 1 t-22 1 t-28 -1 t-24 0 t-26 1 t-28 -1 t-22 0 V250z" fill="#1b140c" opacity="0.9"/>
  </svg>`;
}

// ── scenes ────────────────────────────────────────────────────────────────
const SCENES = {
  gatehouse: ['HIC : CASTELLVM : CLAVSVM : EST', 1,
    saucer(150, 132, 54, false) + alien(150, { s: 0.55, base: 120, tunic: 'blue', arms: [[-6, 14], [14, 4]] }) +
    saucer(70, 150, 50) + alien(70, { s: 0.5, base: 140, tunic: 'ochre', hose: 'red', arms: [[-6, 14], [16, 2]] }) +
    castle(330) + tree(450) + alien(400, { dir: -1, tunic: 'wine', hose: 'sage', arms: [[-4, 26], [14, -10]] }) + line([[386, 112], [372, 70]], 'dark', 1.5)],
  feast: ['HIC : FECERVNT : CONVIVIVM : ET : SVFFRAGIA', 2,
    alien(110, { tunic: 'red', arms: [[-10, 10], [14, 12]] }) + alien(170, { tunic: 'sage', hose: 'wine', arms: [[-6, 14], [12, 8]] }) +
    alien(230, { tunic: 'blue', hose: 'red', arms: [[-10, 14], [10, 12]] }) + alien(290, { tunic: 'ochre', arms: [[-8, 12], [12, 10]] }) +
    alien(350, { dir: -1, tunic: 'wine', hose: 'sage', arms: [[-8, 12], [12, 10]] }) +
    `<path d="M70 146 Q230 128 400 146 V158 H70z" ${fill('pale')} ${O}/>` +
    tablet(124, 138, -10) + tablet(184, 136, 6) + tablet(244, 136, -4) + tablet(302, 136, 8) + tablet(338, 138, -6) +
    `<path d="M80 158 v28 M390 158 v28" stroke="${C.dark}" stroke-width="3"/>` + saucer(440, 110, 50, true)],
  messengers: ['VBI : NVNTII : VENERVNT : ROBOTVS : SINE : SEDE', 3,
    tree(40) + alien(100, { tunic: 'red', cloak: 'ochre', arms: [[-6, 26], [18, 4]] }) + alien(160, { tunic: 'sage', hose: 'red', arms: [[-8, 22], [16, -6]] }) +
    tablet(181, 110, 10) + robot(250, { dir: -1 }) + `<path d="M300 160 h34 v6 h-34z" ${fill('ochre')} ${O}/><path d="M304 166 v20 M330 166 v20" stroke="${C.dark}" stroke-width="3"/>` +
    text(296, 152, 'VACAT', 9) + alien(400, { dir: -1, tunic: 'blue', crown: true, arms: [[-6, 22], [16, 2]] }) + tree(460, 'ochre')],
  provisions: ['PORTANT : AVRVM : AD : NAVEM : STELLAREM', 4,
    alien(60, { tunic: 'ochre', arms: [[4, -4], [10, -6]] }) + crate(66, 108) + alien(120, { tunic: 'blue', hose: 'red', arms: [[4, -4], [10, -6]] }) + crate(126, 108) +
    alien(180, { tunic: 'red', arms: [[-2, 14], [18, 10]] }) +
    `<path d="M195 136 h70 v24 h-70z" ${fill('wine')} ${O}/>` + [210, 228, 246].map((x) => `<circle cx="${x}" cy="132" r="6" fill="url(#w-ochre)" ${O}/>`).join('') +
    `<circle cx="210" cy="172" r="12" fill="none" stroke="${C.dark}" stroke-width="3"/><circle cx="250" cy="172" r="12" fill="none" stroke="${C.dark}" stroke-width="3"/>` +
    `<path d="M210 160v24M198 172h24M250 160v24M238 172h24" stroke="${C.ochre}" stroke-width="1.6"/>` + starship(390, 186, 170, { mast: true })],
  crowning: ['HIC : DEDERVNT : CORONAM : ELECTO', 5,
    alien(90, { tunic: 'sage', arms: [[-6, 20], [16, -2]] }) + tablet(108, 118, 12) + alien(150, { tunic: 'red', hose: 'sage', cloak: 'blue', arms: [[-4, 22], [18, -8]] }) +
    `<path d="M164 106 l3 -10 4 6 3 -8 3 8 4 -6 3 10z" ${fill('ochre')} ${O}/>` +
    alien(230, { dir: -1, tunic: 'ochre', hose: 'red', arms: [[-6, 24], [18, -2]] }) +
    `<path d="M292 188 V112 a20 20 0 0 1 40 0 V188" ${fill('blue')} ${O}/><path d="M296 120 h32 M296 150 h32" stroke="${C.ochre}" stroke-width="2"/>` +
    alien(380, { dir: -1, tunic: 'wine', arms: [[-6, 22], [10, 18]] }) + tablet(366, 140, -8) + alien(440, { dir: -1, tunic: 'red', hose: 'blue', arms: [[-6, 22], [16, 0]] })],
  enthroned: ['HIC : RESIDET : REX : STELLARVM', 6,
    `<path d="M120 188 V88 h120 V188" fill="none" ${O}/><path d="M112 88 h136 l-8 -14 h-120z" ${fill('red')} ${O}/>` +
    throne(180) + alien(178, { seated: true, crown: true, tunic: 'blue', hose: 'red', cloak: 'ochre', arms: [[-10, 4], [16, -4]] }) +
    line([[201, 118], [205, 72]], 'ochre', 2.5) + `<circle cx="205" cy="70" r="5" fill="url(#w-sage)" ${O}/><circle cx="205" cy="70" r="2" fill="url(#w-ochre)"/>` +
    alien(80, { tunic: 'sage', arms: [[-4, 20], [14, 4]] }) + robot(290, { dir: -1 }) + alien(350, { dir: -1, tunic: 'ochre', arms: [[-6, 20], [14, 8]] }) +
    alien(410, { dir: -1, tunic: 'red', hose: 'sage', arms: [[-6, 22], [14, -6]] }) + saucer(455, 98, 40)],
  shipbuilding: ['HIC : FABRI : EDIFICANT : NAVES : STELLARES', 7,
    tree(30) + alien(80, { tunic: 'red', arms: [[14, 4], [18, -8]] }) + line([[97, 114], [104, 102]], 'dark', 1.5) + `<rect x="100" y="96" width="10" height="6" fill="${C.dark}"/>` +
    starship(250, 176, 200, { mast: false }) + alien(200, { s: 0.75, base: 150, tunic: 'blue', hose: 'ochre', arms: [[12, 10], [16, 6]] }) +
    alien(300, { s: 0.75, base: 150, dir: -1, tunic: 'sage', hose: 'red', arms: [[12, 8], [16, 2]] }) +
    `<path d="M380 188 V70 M372 80 h60 M380 100 l40 -20" stroke="${C.dark}" stroke-width="3"/><path d="M428 80 v30" stroke="${C.dark}" stroke-width="1.4"/>` + crate(428, 124) +
    alien(460, { dir: -1, tunic: 'ochre', arms: [[-6, 20], [16, -6]] })],
  oath: ['VBI : SACRAMENTVM : FECIT : SVPER : MACHINAM', 8,
    `<path d="M30 188 V96 q20 -24 40 0 V188" ${fill('sage')} ${O}/><path d="M40 188 v-40 a10 10 0 0 1 20 0 v40" fill="url(#w-dark)"/>` +
    throne(120) + alien(118, { seated: true, tunic: 'wine', hose: 'blue', cloak: 'red', arms: [[-6, 10], [24, -6]] }) +
    `<rect x="200" y="122" width="36" height="40" ${fill('ochre')} ${O}/><path d="M206 132h24M206 140h24M206 148h16" stroke="${C.blue}" stroke-width="1.6"/>` +
    `<path d="M206 162 l-4 24 M230 162 l4 24" stroke="${C.dark}" stroke-width="3"/><path d="M218 122 v-14" stroke="${C.dark}" stroke-width="1.6"/><circle cx="218" cy="105" r="3" fill="url(#w-red)" ${O}/>` +
    alien(280, { dir: -1, tunic: 'blue', hose: 'ochre', arms: [[-14, 8], [24, -2]] }) +
    `<rect x="320" y="128" width="28" height="34" ${fill('red')} ${O}/><path d="M326 136h16M326 144h16" stroke="${C.ochre}" stroke-width="1.6"/><path d="M324 162 v24 M344 162 v24" stroke="${C.dark}" stroke-width="3"/>` +
    alien(400, { dir: -1, tunic: 'sage', arms: [[-6, 22], [14, 4]] }) + alien(450, { dir: -1, tunic: 'ochre', hose: 'red', arms: [[-6, 22], [14, -8]] })],
  keys: ['HIC : CLAVES : PORREXIT : IN : LANCEA', 9,
    castle(120, { c: 'ochre' }) + line([[170, 108], [300, 130]], 'dark', 1.4) +
    `<circle cx="226" cy="122" r="5" fill="none" stroke="${C.ochre}" stroke-width="3"/><path d="M226 127 v14 h4 M226 135 h3" stroke="${C.ochre}" stroke-width="2.6"/>` +
    `<rect x="232" y="118" width="10" height="14" rx="1.5" ${fill('sage')} ${O}/><path d="M235 122h4M235 126h4" stroke="${C.ochre}" stroke-width="1.2"/>` +
    saucer(330, 132, 54) + alien(330, { s: 0.55, base: 120, dir: -1, tunic: 'red', arms: [[-6, 14], [16, 2]] }) +
    alien(420, { dir: -1, tunic: 'blue', hose: 'sage', arms: [[-6, 22], [16, -4]] }) + tree(470, 'red')],
  council: ['HIC : DVX : IN : CONSILIO : CVM : ROBOTO', 10,
    `<path d="M40 188 V96 q14 -20 28 0 V188" ${fill('red')} ${O}/><path d="M68 100 Q250 50 432 100" fill="none" ${O} stroke-width="3"/>` +
    `<path d="M432 188 V96 q14 -20 28 0 V188" ${fill('blue')} ${O}/>` +
    throne(220) + alien(218, { seated: true, crown: true, tunic: 'red', hose: 'blue', cloak: 'sage', arms: [[-6, 10], [20, -4]] }) +
    alien(130, { tunic: 'ochre', hose: 'wine', arms: [[-4, 22], [16, 0]] }) + tablet(150, 120, 10) +
    robot(310, { dir: -1 }) + alien(380, { dir: -1, tunic: 'sage', hose: 'red', arms: [[-6, 22], [14, -8]] })],
};

fs.mkdirSync(path.join(__dirname, 'svg'), { recursive: true });
const font = path.join(__dirname, 'node_modules/@fontsource/uncial-antiqua/files/uncial-antiqua-latin-400-normal.woff2');
for (const [name, [insc, seed, body]] of Object.entries(SCENES)) {
  const svg = tapestry(seed, insc, body);
  fs.writeFileSync(path.join(__dirname, 'svg', name + '.html'),
    `<!doctype html><html><head><style>@font-face{font-family:Uncial;src:url(file://${font})}html,body{margin:0;background:#000}svg{display:block}</style></head><body>${svg}</body></html>`);
}
console.log(Object.keys(SCENES).join(' '));
