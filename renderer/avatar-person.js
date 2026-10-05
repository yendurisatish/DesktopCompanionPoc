// Code-drawn person: the default stand-in until clips of the user's likeness are added.

const SKIN = '#E8B48A';
const SKIN_SHADE = '#D39B70';
const HAIR = '#2A1E17';
const TEE = '#8E949B';
const DENIM = '#4F7DB3';
const DENIM_DARK = '#3E6696';
const JEANS = '#2F3440';
const LIP = '#7A2E2E';

const PERSON_SVG = `
<svg class="ph" viewBox="0 0 200 360" xmlns="http://www.w3.org/2000/svg">
  <ellipse class="no-hit" cx="100" cy="352" rx="42" ry="6" fill="#000" opacity="0.18"/>
  <g class="body">
    <g class="leg leg-l">
      <rect x="80" y="210" width="19" height="120" rx="8" fill="${JEANS}"/>
      <path d="M78 326 h22 a6 6 0 0 1 6 6 v6 h-34 v-6 a6 6 0 0 1 6 -6z" fill="#F4F4F4"/>
      <rect x="72" y="336" width="34" height="5" rx="2.5" fill="#CFCFCF"/>
    </g>
    <g class="leg leg-r">
      <rect x="101" y="210" width="19" height="120" rx="8" fill="${JEANS}"/>
      <path d="M100 326 h22 a6 6 0 0 1 6 6 v6 h-34 v-6 a6 6 0 0 1 6 -6z" fill="#F4F4F4"/>
      <rect x="94" y="336" width="34" height="5" rx="2.5" fill="#CFCFCF"/>
    </g>
    <g class="arm arm-l">
      <rect x="58" y="136" width="18" height="80" rx="9" fill="${DENIM}"/>
      <rect x="58" y="202" width="18" height="9" fill="${DENIM_DARK}"/>
      <circle cx="67" cy="220" r="9" fill="${SKIN}"/>
    </g>
    <g class="torso">
      <rect x="70" y="128" width="60" height="96" rx="16" fill="${TEE}"/>
      <path d="M70 146 q0 -18 18 -18 h6 l-3 96 h-21z" fill="${DENIM}"/>
      <path d="M130 146 q0 -18 -18 -18 h-6 l3 96 h21z" fill="${DENIM}"/>
      <rect x="74" y="150" width="13" height="11" rx="2" fill="${DENIM_DARK}"/>
      <rect x="113" y="150" width="13" height="11" rx="2" fill="${DENIM_DARK}"/>
      <rect x="70" y="212" width="60" height="12" rx="4" fill="${DENIM_DARK}"/>
    </g>
    <g class="head">
      <rect x="91" y="110" width="18" height="24" rx="6" fill="${SKIN_SHADE}"/>
      <circle cx="66" cy="88" r="7" fill="${SKIN_SHADE}"/>
      <circle cx="134" cy="88" r="7" fill="${SKIN_SHADE}"/>
      <ellipse cx="100" cy="84" rx="33" ry="37" fill="${SKIN}"/>
      <path d="M67 84 q2 36 33 39 q31 -3 33 -39 q-5 20 -16 25 q-17 6 -34 0 q-11 -5 -16 -25z" fill="${HAIR}" opacity="0.55"/>
      <path d="M90 99 q10 -5 20 0 q-10 2 -20 0z" fill="${HAIR}" opacity="0.6"/>
      <path d="M66 82 q-6 -40 34 -46 q36 -2 38 36 q-6 -16 -18 -21 q-12 9 -36 7 q-12 2 -18 24z" fill="${HAIR}"/>
      <ellipse class="blush" cx="78" cy="96" rx="7" ry="4" fill="#E86F6F"/>
      <ellipse class="blush" cx="122" cy="96" rx="7" ry="4" fill="#E86F6F"/>
      <g class="brows">
        <rect class="brow brow-l" x="78" y="68" width="16" height="4" rx="2" fill="${HAIR}"/>
        <rect class="brow brow-r" x="106" y="68" width="16" height="4" rx="2" fill="${HAIR}"/>
      </g>
      <g class="eyes">
        <g class="eyes-open"><g class="blink">
          <ellipse cx="87" cy="82" rx="4" ry="5" fill="${HAIR}"/>
          <ellipse cx="113" cy="82" rx="4" ry="5" fill="${HAIR}"/>
          <circle cx="88.5" cy="80" r="1.4" fill="#fff"/>
          <circle cx="114.5" cy="80" r="1.4" fill="#fff"/>
        </g></g>
        <g class="eyes-wide">
          <circle cx="87" cy="81" r="6.5" fill="#fff"/><circle cx="87" cy="81" r="3.6" fill="${HAIR}"/>
          <circle cx="113" cy="81" r="6.5" fill="#fff"/><circle cx="113" cy="81" r="3.6" fill="${HAIR}"/>
        </g>
        <g class="eyes-happy" fill="none" stroke="${HAIR}" stroke-width="3" stroke-linecap="round">
          <path d="M81 84 q6 -7 12 0"/><path d="M107 84 q6 -7 12 0"/>
        </g>
        <g class="eyes-closed" fill="none" stroke="${HAIR}" stroke-width="3" stroke-linecap="round">
          <path d="M81 82 q6 4 12 0"/><path d="M107 82 q6 4 12 0"/>
        </g>
        <g class="eyes-narrow">
          <ellipse cx="87" cy="83" rx="5" ry="2.3" fill="${HAIR}"/>
          <ellipse cx="113" cy="83" rx="5" ry="2.3" fill="${HAIR}"/>
        </g>
      </g>
      <g class="mouth" fill="none" stroke="${LIP}" stroke-width="3" stroke-linecap="round">
        <path class="mouth-smile" d="M91 103 q9 7 18 0"/>
        <g class="mouth-grin" stroke="none">
          <path d="M88 101 q12 15 24 0z" fill="${LIP}"/>
          <path d="M90 101.5 h20 q-1 3 -3 3.5 h-14 q-2 -0.5 -3 -3.5z" fill="#fff"/>
        </g>
        <ellipse class="mouth-o" cx="100" cy="106" rx="4.5" ry="6" fill="${LIP}" stroke="none"/>
        <path class="mouth-flat" d="M93 105 h14"/>
        <path class="mouth-frown" d="M92 108 q8 -7 16 0"/>
        <path class="mouth-side" d="M95 106 q6 -3 12 -1"/>
      </g>
    </g>
    <!-- drawn after the head so the hand and bottle can come in front of the face -->
    <g class="arm arm-r">
      <rect x="124" y="136" width="18" height="80" rx="9" fill="${DENIM}"/>
      <rect x="124" y="202" width="18" height="9" fill="${DENIM_DARK}"/>
      <g class="bottle">
        <rect x="125" y="190" width="16" height="40" rx="5" fill="#A8DAF5" stroke="#5FA8D8" stroke-width="1.5"/>
        <rect x="126.5" y="206" width="13" height="22" rx="3" fill="#6EC1F0" opacity="0.7"/>
        <rect x="128" y="182" width="10" height="9" rx="2" fill="#2C6FB0"/>
      </g>
      <circle cx="133" cy="220" r="9" fill="${SKIN}"/>
    </g>
  </g>
  <g class="zzz no-hit" fill="#5B6B8C" font-family="Segoe UI, sans-serif" font-weight="700">
    <text x="128" y="50" font-size="14">z</text>
    <text x="128" y="50" font-size="18">z</text>
    <text x="128" y="50" font-size="22">Z</text>
  </g>
</svg>`;

const PERSON_ONE_SHOTS = { drink: 1600, celebrate: 1800, wave: 1600 };

class PersonAvatar extends DrawnAvatar {
  constructor(height) {
    super({ markup: PERSON_SVG, viewWidth: 200, viewHeight: 360, height, oneShots: PERSON_ONE_SHOTS });
    this.kind = 'person';
  }
}
