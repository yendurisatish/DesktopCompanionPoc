// Base for code-drawn SVG characters (person, cat). Motions and expressions are CSS classes on the
// <svg>. Shares the avatar interface with ClipAvatar:
//   kind, size, nativeFacing, lines?, mount(el), playMotion(name) -> Promise<finishedOneShot>,
//   setExpression(name), hitTest(x, y)

const EXPRESSIONS = ['neutral', 'happy', 'surprised', 'annoyed', 'sad', 'sleepy', 'thinking'];
const MOTIONS = ['idle', 'walk', 'sit', 'groom', 'hold_bottle', 'drink', 'celebrate', 'wave', 'sleep', 'dangle'];

class DrawnAvatar {
  // oneShots: durations (ms) of motions that play once; everything else loops.
  constructor({ markup, viewWidth, viewHeight, height, oneShots, lines }) {
    this.markup = markup;
    this.oneShots = oneShots;
    this.lines = lines;
    this.size = { width: Math.round((height * viewWidth) / viewHeight), height };
    this.nativeFacing = 'right';
    this.pending = null;
  }

  async mount(container) {
    container.innerHTML = this.markup;
    this.svg = container.querySelector('svg');
    this.svg.setAttribute('width', this.size.width);
    this.svg.setAttribute('height', this.size.height);
    this.setExpression('neutral');
  }

  playMotion(name) {
    if (!MOTIONS.includes(name)) {
      console.warn(`Unknown motion "${name}", playing idle`);
      name = 'idle';
    }
    this.finishPending(false);
    this.swapClass('motion-', name);
    const ms = this.oneShots[name];
    if (!ms) return Promise.resolve(false);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending = null;
        resolve(true);
      }, ms);
      this.pending = { resolve, timer };
    });
  }

  setExpression(name) {
    if (!EXPRESSIONS.includes(name)) {
      console.warn(`Unknown expression "${name}"`);
      return;
    }
    this.swapClass('expr-', name);
  }

  hitTest(x, y) {
    const el = document.elementFromPoint(x, y);
    return Boolean(el) && el !== this.svg && this.svg.contains(el) && !el.closest('.no-hit');
  }

  finishPending(finished) {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending.resolve(finished);
    this.pending = null;
  }

  swapClass(prefix, name) {
    for (const c of [...this.svg.classList]) if (c.startsWith(prefix)) this.svg.classList.remove(c);
    this.svg.getBoundingClientRect(); // restart CSS animations when the same class is re-applied
    this.svg.classList.add(prefix + name);
  }
}
