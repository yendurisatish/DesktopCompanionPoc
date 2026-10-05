// Plays the user's character as transparent WebM clips listed in assets/character/manifest.json.
// One <video> per clip, all preloaded, so switching motion is instant.

// When a motion has no clip of its own, try these instead (then fall back to idle).
const CLIP_FALLBACKS = {
  drink: ['hold_bottle'],
  celebrate: ['happy'],
  dangle: ['surprised'],
};
const CLIP_ONE_SHOTS = new Set(['drink', 'celebrate', 'wave', 'surprised', 'happy']);

class ClipAvatar {
  constructor(manifest, height, host) {
    this.kind = 'clips';
    this.manifest = manifest;
    this.height = manifest.height || height;
    this.host = host;
    this.nativeFacing = manifest.facing || 'right';
    this.videos = {};
    this.current = null;
    this.pending = null;
  }

  async mount(container) {
    this.container = container;
    for (const [name, clip] of Object.entries(this.manifest.clips)) {
      const bytes = await this.host.readCharacterFile(clip.src);
      const video = document.createElement('video');
      video.src = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }));
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.loop = clip.loop ?? !CLIP_ONE_SHOTS.has(name);
      video.style.height = `${this.height}px`;
      video.hidden = true;
      container.append(video);
      await new Promise((resolve, reject) => {
        video.addEventListener('loadeddata', resolve, { once: true });
        video.addEventListener('error', () => reject(new Error(`Can't play clip "${clip.src}"`)), { once: true });
      });
      this.videos[name] = video;
    }
    const idle = this.videos.idle;
    this.size = { width: Math.round((this.height * idle.videoWidth) / idle.videoHeight), height: this.height };
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
  }

  playMotion(name) {
    const key = [name, ...(CLIP_FALLBACKS[name] || [])].find((k) => this.videos[k]) || 'idle';
    this.finishPending(false);
    const video = this.videos[key];
    this.current = video;
    video.currentTime = 0;
    video.play().catch(() => {}).then(() => {
      if (this.current !== video) return;
      for (const other of Object.values(this.videos)) {
        if (other === video) continue;
        other.hidden = true;
        other.pause();
      }
      video.hidden = false;
    });
    if (video.loop) return Promise.resolve(false);
    return new Promise((resolve) => {
      const onEnded = () => {
        this.pending = null;
        resolve(true);
      };
      video.addEventListener('ended', onEnded, { once: true });
      this.pending = { resolve, cleanup: () => video.removeEventListener('ended', onEnded) };
    });
  }

  setExpression(_name) {
    // Clips carry their expression baked in; per-expression clips are a later milestone.
  }

  // Hit only on visible pixels, so clicks on the clip's transparent margins reach the desktop.
  hitTest(x, y) {
    const video = this.current;
    if (!video || video.hidden || !video.videoWidth) return false;
    const r = video.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    let u = (x - r.left) / r.width;
    const v = (y - r.top) / r.height;
    if (this.container.classList.contains('flipped')) u = 1 - u;
    try {
      this.ctx.clearRect(0, 0, 1, 1);
      this.ctx.drawImage(video, u * video.videoWidth, v * video.videoHeight, 1, 1, 0, 0, 1, 1);
      return this.ctx.getImageData(0, 0, 1, 1).data[3] > 32;
    } catch {
      return u > 0.2 && u < 0.8;
    }
  }

  finishPending(finished) {
    if (!this.pending) return;
    this.pending.cleanup();
    this.pending.resolve(finished);
    this.pending = null;
  }
}
