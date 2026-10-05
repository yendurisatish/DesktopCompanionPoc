// Code-drawn Scottish Fold: blue coat, copper eyes, folded ears, round face and full cheeks.
// Side-on body with the head turned three-quarters toward the viewer. Fur edges come from an
// SVG turbulence filter; shading from user-space gradients so every fur piece shades consistently.

const FUR_FILTER = 'filter="url(#cat-fur)"';
const BODY = 'url(#cat-body)';
const HEAD = 'url(#cat-head)';
const LEG = 'url(#cat-leg)';
const FAR = 'url(#cat-far)';
const LIGHT = 'url(#cat-light)';
const EYE_RIM = '#2B2522';
const NOSE = '#9C8792';
const MOUTH_LINE = '#4E4A52';
const MOUTH_OPEN = '#6B3A44';

const catFrontLeg = (cls, dx, fill) => `
    <g class="leg ${cls}">
      <path ${FUR_FILTER} d="M${158 + dx} 126 C ${156 + dx} 146, ${160 + dx} 166, ${160 + dx} 182 L ${174 + dx} 182 C ${174 + dx} 166, ${176 + dx} 144, ${178 + dx} 128 Z" fill="${fill}"/>
      ${cls === 'leg-fn' ? CAT_BOTTLE : ''}
      <ellipse ${FUR_FILTER} cx="${167 + dx}" cy="185" rx="9.5" ry="5" fill="${fill}"/>
      <path d="M${163.5 + dx} 186 v3 M${167 + dx} 186.5 v3 M${170.5 + dx} 186 v3" stroke="#000" stroke-opacity="0.22" stroke-width="1" stroke-linecap="round"/>
    </g>`;

const catBackLeg = (cls, dx, fill) => `
    <g class="leg ${cls}">
      <path ${FUR_FILTER} d="M${64 + dx} 146 C ${60 + dx} 160, ${62 + dx} 172, ${66 + dx} 182 L ${80 + dx} 182 C ${77 + dx} 172, ${79 + dx} 160, ${88 + dx} 148 Z" fill="${fill}"/>
      <ellipse ${FUR_FILTER} cx="${73 + dx}" cy="185" rx="9.5" ry="5" fill="${fill}"/>
      <path d="M${69.5 + dx} 186 v3 M${73 + dx} 186.5 v3 M${76.5 + dx} 186 v3" stroke="#000" stroke-opacity="0.22" stroke-width="1" stroke-linecap="round"/>
    </g>`;

const CAT_BOTTLE = `
      <g class="bottle">
        <rect x="160" y="158" width="14" height="30" rx="4" fill="#BFE4F7" fill-opacity="0.9" stroke="#6FB2DC" stroke-width="1.2"/>
        <rect x="161.5" y="170" width="11" height="16" rx="3" fill="#7CC6EE" opacity="0.75"/>
        <rect x="163" y="151" width="8" height="8" rx="2" fill="#2C6FB0"/>
      </g>`;

// One eye: rim, copper iris, pupil, highlights.
const catEye = (cx, pupil) => `
          <ellipse cx="${cx}" cy="84" rx="9.6" ry="10" fill="${EYE_RIM}"/>
          <ellipse cx="${cx}" cy="84" rx="8.3" ry="8.8" fill="url(#cat-iris)"/>
          <g class="pupil">${pupil(cx)}</g>
          <circle cx="${cx - 2.8}" cy="80.2" r="2.3" fill="#fff" opacity="0.92"/>
          <circle cx="${cx + 3}" cy="88" r="1" fill="#fff" opacity="0.7"/>`;
const slitPupil = (cx) => `<ellipse cx="${cx}" cy="84" rx="2.4" ry="7" fill="#120E0C"/>`;
const roundPupil = (cx) => `<circle cx="${cx}" cy="84" r="6.2" fill="#120E0C"/>`;

// Upper eyelid in head fur, covering the eye down to `edgeY` (a half-closed, relaxed look).
const lid = (cx, edgeY) => `
          <path d="M${cx - 11} 85 C ${cx - 10} 70, ${cx + 10} 70, ${cx + 11} 85 C ${cx + 6} ${edgeY - 3}, ${cx - 6} ${edgeY - 3}, ${cx - 11} 85 Z" fill="${HEAD}"/>
          <path d="M${cx - 10} 85 C ${cx - 6} ${edgeY - 3}, ${cx + 6} ${edgeY - 3}, ${cx + 10} 85" fill="none" stroke="${EYE_RIM}" stroke-width="1.6" stroke-linecap="round"/>`;
const lowerLid = (cx, edgeY) => `
          <path d="M${cx - 11} 84 C ${cx - 10} 99, ${cx + 10} 99, ${cx + 11} 84 C ${cx + 6} ${edgeY + 3}, ${cx - 6} ${edgeY + 3}, ${cx - 11} 84 Z" fill="${HEAD}"/>`;

const CAT_SVG = `
<svg class="cat" viewBox="0 0 250 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="cat-body" gradientUnits="userSpaceOnUse" cx="118" cy="104" r="96">
      <stop offset="0" stop-color="#ABB3C0"/><stop offset="0.55" stop-color="#919AA8"/><stop offset="1" stop-color="#6E7786"/>
    </radialGradient>
    <radialGradient id="cat-head" gradientUnits="userSpaceOnUse" cx="184" cy="76" r="50">
      <stop offset="0" stop-color="#B2B9C5"/><stop offset="0.6" stop-color="#97A0AD"/><stop offset="1" stop-color="#7A8391"/>
    </radialGradient>
    <linearGradient id="cat-leg" gradientUnits="userSpaceOnUse" x1="0" y1="126" x2="0" y2="190">
      <stop offset="0" stop-color="#8790A0"/><stop offset="1" stop-color="#A4ACB8"/>
    </linearGradient>
    <linearGradient id="cat-far" gradientUnits="userSpaceOnUse" x1="0" y1="126" x2="0" y2="190">
      <stop offset="0" stop-color="#666F7E"/><stop offset="1" stop-color="#7D8695"/>
    </linearGradient>
    <radialGradient id="cat-light" gradientUnits="userSpaceOnUse" cx="188" cy="104" r="22">
      <stop offset="0" stop-color="#C8CDD6"/><stop offset="1" stop-color="#A7AEBA"/>
    </radialGradient>
    <radialGradient id="cat-iris" cx="0.5" cy="0.42" r="0.6">
      <stop offset="0" stop-color="#F6BE5C"/><stop offset="0.55" stop-color="#DB8B2C"/><stop offset="1" stop-color="#94541A"/>
    </radialGradient>
    <filter id="cat-fur" x="-15%" y="-15%" width="130%" height="130%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="fuzzy"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.8 0 0 0 -0.52" result="specks"/>
      <feComposite in="specks" in2="fuzzy" operator="in" result="grain"/>
      <feMerge><feMergeNode in="fuzzy"/><feMergeNode in="grain"/></feMerge>
    </filter>
    <filter id="cat-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>

  <ellipse class="no-hit" cx="122" cy="190" rx="76" ry="5" fill="#000" opacity="0.28" filter="url(#cat-soft)"/>
  <g class="all">
    ${catBackLeg('leg-bf', 14, FAR)}
    ${catFrontLeg('leg-ff', -12, FAR)}
    <g class="tail">
      <path ${FUR_FILTER} d="M62 120 C 40 118, 24 128, 20 146 C 17 158, 22 168, 30 166 C 34 165, 33 160, 31 156 C 30 146, 40 134, 62 134 Z" fill="${BODY}"/>
    </g>
    <path ${FUR_FILTER} d="M62 112 C 64 92, 96 88, 120 94 C 140 98, 158 92, 172 100 C 190 110, 192 140, 178 154 C 160 164, 120 164, 96 160 C 76 158, 58 150, 56 134 C 55 124, 58 116, 62 112 Z" fill="${BODY}"/>
    <path d="M118 150 C 130 156, 150 156, 166 150" fill="none" stroke="#5E6676" stroke-opacity="0.25" stroke-width="3" stroke-linecap="round"/>
    ${catBackLeg('leg-bn', 0, LEG)}
    <ellipse ${FUR_FILTER} cx="80" cy="138" rx="26" ry="28" fill="${BODY}"/>
    <path d="M60 132 C 62 116, 80 108, 99 116" fill="none" stroke="#5E6676" stroke-opacity="0.22" stroke-width="3" stroke-linecap="round"/>
    <path ${FUR_FILTER} d="M168 108 C 184 116, 186 140, 176 154 C 168 146, 164 128, 168 108 Z" fill="${LIGHT}" opacity="0.8"/>

    <g class="head">
      <path ${FUR_FILTER} d="M154 72 C 152 58, 162 50, 172 52 C 170 58, 166 64, 160 70 Z" fill="${HEAD}"/>
      <path ${FUR_FILTER} d="M222 72 C 224 58, 214 50, 204 52 C 206 58, 210 64, 216 70 Z" fill="${HEAD}"/>
      <path ${FUR_FILTER} d="M150 88 C 148 64, 168 50, 188 50 C 208 50, 228 64, 226 88 C 228 102, 220 114, 206 119 C 196 123, 180 123, 170 119 C 156 114, 148 102, 150 88 Z" fill="${HEAD}"/>
      <path d="M156 70 C 160 62, 166 56, 172 54 M220 70 C 216 62, 210 56, 204 54" fill="none" stroke="#5E6676" stroke-opacity="0.45" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M160 66 C 164 59, 168 56, 171 55 M216 66 C 212 59, 208 56, 205 55" fill="none" stroke="#C9CED7" stroke-opacity="0.5" stroke-width="1" stroke-linecap="round"/>
      <ellipse class="blush" cx="166" cy="100" rx="7" ry="3.6" fill="#E58C9E"/>
      <ellipse class="blush" cx="210" cy="100" rx="7" ry="3.6" fill="#E58C9E"/>
      <g class="brows" fill="none" stroke="#6E7786" stroke-opacity="0.7" stroke-width="2" stroke-linecap="round">
        <path class="brow brow-l" d="M166 72 C 170 70, 176 70, 180 72"/>
        <path class="brow brow-r" d="M196 72 C 200 70, 206 70, 210 72"/>
      </g>
      <g class="eyes">
        <g class="eyes-open"><g class="blink">${catEye(173, slitPupil)}${catEye(203, slitPupil)}</g></g>
        <g class="eyes-wide">${catEye(173, roundPupil)}${catEye(203, roundPupil)}</g>
        <g class="eyes-happy">${catEye(173, slitPupil)}${catEye(203, slitPupil)}${lid(173, 86)}${lid(203, 86)}</g>
        <g class="eyes-narrow">${catEye(173, slitPupil)}${catEye(203, slitPupil)}${lid(173, 85)}${lid(203, 85)}${lowerLid(173, 86)}${lowerLid(203, 86)}</g>
        <g class="eyes-closed" fill="none" stroke="${EYE_RIM}" stroke-width="2" stroke-linecap="round">
          <path d="M163 85 C 168 90, 178 90, 183 85"/><path d="M193 85 C 198 90, 208 90, 213 85"/>
        </g>
      </g>
      <ellipse cx="181.5" cy="104" rx="7.5" ry="5.5" fill="${LIGHT}"/>
      <ellipse cx="194.5" cy="104" rx="7.5" ry="5.5" fill="${LIGHT}"/>
      <ellipse cx="188" cy="112" rx="6.5" ry="3.8" fill="${LIGHT}"/>
      <g fill="#5E6676" opacity="0.5">
        <circle cx="178" cy="103" r="0.8"/><circle cx="181" cy="106" r="0.8"/><circle cx="177" cy="107" r="0.8"/>
        <circle cx="198" cy="103" r="0.8"/><circle cx="195" cy="106" r="0.8"/><circle cx="199" cy="107" r="0.8"/>
      </g>
      <path d="M183 95 C 183 93, 193 93, 193 95 C 193 97, 190 99, 188 100 C 186 99, 183 97, 183 95 Z" fill="${NOSE}"/>
      <path d="M186 94.6 C 187 94.2, 189 94.2, 190 94.6" stroke="#fff" stroke-opacity="0.35" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M188 100 v3.5" stroke="${MOUTH_LINE}" stroke-width="1.3" stroke-linecap="round"/>
      <g class="mouth" fill="none" stroke="${MOUTH_LINE}" stroke-width="1.5" stroke-linecap="round">
        <path class="mouth-smile" d="M181 106 C 184 108.5, 187 107.5, 188 103.5 C 189 107.5, 192 108.5, 195 106"/>
        <g class="mouth-grin" stroke="none">
          <path d="M182 105 C 184 114, 192 114, 194 105 C 191 107, 185 107, 182 105 Z" fill="${MOUTH_OPEN}"/>
          <ellipse cx="188" cy="110.5" rx="3.6" ry="2.2" fill="#D9798A"/>
        </g>
        <ellipse class="mouth-o" cx="188" cy="108" rx="3" ry="3.6" fill="${MOUTH_OPEN}" stroke="none"/>
        <path class="mouth-flat" d="M182.5 106 h11"/>
        <path class="mouth-frown" d="M182 108.5 C 185 105.5, 191 105.5, 194 108.5"/>
        <path class="mouth-side" d="M184 107 C 188 105, 192 105, 195 106"/>
      </g>
      <ellipse class="tongue no-hit" cx="188" cy="109" rx="2.6" ry="3.4" fill="#D9798A"/>
      <g class="no-hit" fill="none" stroke-linecap="round">
        <g stroke="#4F5665" stroke-opacity="0.35" stroke-width="1.9">
          <path d="M176 102 C 160 98, 146 98, 133 102 M176 105 C 160 105, 148 108, 135 113 M177 108 C 164 110, 152 116, 143 123"/>
          <path d="M200 102 C 214 98, 228 98, 245 100 M200 105 C 216 105, 230 108, 243 112 M199 108 C 212 110, 224 116, 233 123"/>
          <path d="M168 70 C 162 62, 158 58, 152 56 M208 70 C 214 62, 218 58, 224 56"/>
        </g>
        <g stroke="#F4F5F7" stroke-width="1">
          <path d="M176 102 C 160 98, 146 98, 133 102 M176 105 C 160 105, 148 108, 135 113 M177 108 C 164 110, 152 116, 143 123"/>
          <path d="M200 102 C 214 98, 228 98, 245 100 M200 105 C 216 105, 230 108, 243 112 M199 108 C 212 110, 224 116, 233 123"/>
          <path d="M168 70 C 162 62, 158 58, 152 56 M208 70 C 214 62, 218 58, 224 56"/>
        </g>
      </g>
    </g>
    <!-- near front leg comes last so its paw (and the bottle) can come up in front of the face -->
    ${catFrontLeg('leg-fn', 0, LEG)}
  </g>
  <g class="zzz no-hit" fill="#5B6B8C" font-family="Segoe UI, sans-serif" font-weight="700">
    <text x="214" y="44" font-size="14">z</text>
    <text x="214" y="44" font-size="18">z</text>
    <text x="214" y="44" font-size="22">Z</text>
  </g>
</svg>`;

const CAT_ONE_SHOTS = { drink: 1600, celebrate: 1800, wave: 1400, groom: 2600 };

const CAT_LINES = {
  greeting: (name) => `Mrrp! Hi ${name}! 🐾`,
  reactions: [
    { emotion: 'surprised', motion: 'idle', text: () => 'Mew?!' },
    { emotion: 'happy', motion: 'wave', text: (name) => `Purr... hi ${name} 💕` },
    { emotion: 'thinking', motion: 'sit', text: () => 'Mrrp? Is it treat time?' },
  ],
  tickled: () => 'Hsss! Too many pokes 😾',
  hydrationAsk: (name) => `Meow! ${name}, did you drink water? 💧`,
  hydrationDone: (count) => (count > 1 ? `Purrfect! 💙 That's ${count} today.` : 'Purrfect! 💙'),
  wake: () => '*big stretch* ...mrrp?',
};

class CatAvatar extends DrawnAvatar {
  constructor(height) {
    super({ markup: CAT_SVG, viewWidth: 250, viewHeight: 200, height, oneShots: CAT_ONE_SHOTS, lines: CAT_LINES });
    this.kind = 'cat';
    // After a walk the cat settles into one of these, and sometimes fidgets.
    this.restMotions = ['sit', 'sit', 'idle'];
    this.fidgets = ['groom'];
  }
}
