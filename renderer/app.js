// Behavior engine: wandering, the hydration reminder, click/drag reactions, sleep, and the
// command surface (setPosition / playMotion / setExpression / ...) used by the tray and the local API.
(async () => {
  // What the character says; an avatar can override any of these (see CAT_LINES).
  const DEFAULT_LINES = {
    greeting: (name) => `Hi ${name}! 👋`,
    intro: (name) => `Hi ${name}! I'll come by when it's time for water 👋`,
    reactions: [
      { emotion: 'surprised', motion: 'idle', text: () => 'Oh! Hi!' },
      { emotion: 'happy', motion: 'wave', text: (name) => `Hi ${name}! 👋` },
      { emotion: 'thinking', motion: 'idle', text: () => 'Hmm? Need something?' },
    ],
    tickled: () => 'Hey! That tickles 😤',
    hydrationAsk: (name) => `Hey, ${name}! Did you drink water?`,
    hydrationDone: (count) => (count > 1 ? `Nice! 💙 That's ${count} today.` : 'Nice! 💙'),
    wake: () => '*yawn* Oh, hey!',
  };

  const host = window.companionHost;
  const init = await host.getInit();
  const cfg = init.config;

  const companionEl = document.getElementById('companion');
  const avatarEl = document.getElementById('avatar');
  const bubbleEl = document.getElementById('bubble');

  let avatar = null;
  if (init.character) {
    try {
      avatar = new ClipAvatar(init.character, cfg.character.height, host);
      await avatar.mount(avatarEl);
    } catch (err) {
      console.error(`Character clips failed to load, using placeholder: ${err.message}`);
      avatarEl.replaceChildren();
      avatar = null;
    }
  }
  if (!avatar) {
    const Builtin = cfg.character.builtin === 'person' ? PersonAvatar : CatAvatar;
    avatar = new Builtin(cfg.character.height);
    await avatar.mount(avatarEl);
  }
  const lines = { ...DEFAULT_LINES, ...avatar.lines };
  const size = avatar.size;
  avatarEl.style.width = `${size.width}px`;
  avatarEl.style.height = `${size.height}px`;

  const now = () => performance.now();
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const ground = () => window.innerHeight - 4;
  const clampX = (x) => clamp(x, size.width / 2, window.innerWidth - size.width / 2);
  const clampY = (y) => clamp(y, size.height + (bubbleEl.hidden ? 0 : bubbleEl.offsetHeight + 16), ground());

  // Feet-center position in overlay coordinates.
  const pos = { x: clampX(rand(size.width, window.innerWidth - size.width)), y: ground() };
  let mode = 'wander'; // wander | reminder | sleep
  let target = null;
  let onArrive = null;
  let dragging = false;
  let falling = false;
  let vy = 0;
  let pausedUntil = 0;
  let nextWanderAt = now() + 4000;
  let currentMotion = null;
  let restingMotion = 'idle'; // pose to settle into when nothing else is going on (a cat may sit)
  let fidgetTimer = null;
  let motionId = 0;
  let baseExpression = 'neutral';
  let emotionResetAt = Infinity;
  let reminderPresented = false;
  let pendingReminder = false;
  let hidden = false;
  let sequence = 0; // bumped when an interaction is interrupted, so its remaining steps are dropped
  let hydrationTimer = null;
  let autoSnoozeTimer = null;
  let bubbleTimer = null;
  // presence "reminders": the character stays off screen (window hidden) and only walks in for
  // reminders or when called; "always": it lives on the desktop.
  let presence = cfg.presence === 'always' ? 'always' : 'reminders';
  let away = true;
  let leaveAt = Infinity;

  // ---------- Motion & emotion ----------

  // Resolves true only if a one-shot motion played to the end without being replaced.
  function playMotion(name) {
    const id = ++motionId;
    currentMotion = name;
    return avatar.playMotion(name).then((finished) => {
      const completed = finished && id === motionId;
      if (completed) playMotion(restMotion());
      return completed;
    });
  }

  function ensureMotion(name) {
    if (currentMotion !== name) playMotion(name);
  }

  function restMotion() {
    if (dragging || falling) return 'dangle';
    if (mode === 'sleep') return 'sleep';
    if (mode === 'reminder' && reminderPresented) return 'hold_bottle';
    if (target !== null) return 'walk';
    return restingMotion;
  }

  // Emotions are temporary and decay back to the base expression.
  function setEmotion(name, seconds = 3) {
    avatar.setExpression(name);
    emotionResetAt = now() + seconds * 1000;
  }

  function setBaseExpression(name) {
    baseExpression = name;
    avatar.setExpression(name);
    emotionResetAt = Infinity;
  }

  function face(dx) {
    const dir = dx > 0 ? 'right' : 'left';
    avatarEl.classList.toggle('flipped', dir !== avatar.nativeFacing);
  }

  // ---------- Speech bubble ----------

  function say(text, { buttons = [], seconds = buttons.length ? 0 : 3 } = {}) {
    clearTimeout(bubbleTimer);
    const textEl = document.createElement('div');
    textEl.className = 'text';
    textEl.textContent = text;
    bubbleEl.replaceChildren(textEl);
    if (buttons.length) {
      const row = document.createElement('div');
      row.className = 'actions';
      for (const b of buttons) {
        const btn = document.createElement('button');
        btn.textContent = b.label;
        if (b.primary) btn.className = 'primary';
        btn.addEventListener('click', b.onClick);
        row.append(btn);
      }
      bubbleEl.append(row);
    }
    bubbleEl.style.setProperty('--shift', '0px');
    bubbleEl.hidden = true;
    bubbleEl.offsetWidth; // restart the pop-in animation
    bubbleEl.hidden = false;
    if (seconds) bubbleTimer = setTimeout(hideBubble, seconds * 1000);
  }

  function hideBubble() {
    clearTimeout(bubbleTimer);
    bubbleEl.hidden = true;
  }

  // ---------- Movement ----------

  function walkTo(x, callback = null, stayOnScreen = true) {
    clearTimeout(fidgetTimer);
    restingMotion = 'idle';
    leaving = false;
    target = stayOnScreen ? clampX(x) : x;
    onArrive = callback;
  }

  // Settle after a walk: pick a resting pose and maybe fidget (groom) a little later.
  function settle() {
    const poses = avatar.restMotions || ['idle'];
    restingMotion = poses[Math.floor(Math.random() * poses.length)];
    playMotion(restingMotion);
    const fidgets = avatar.fidgets || [];
    if (!fidgets.length || restingMotion === 'idle' || Math.random() > 0.5) return;
    fidgetTimer = setTimeout(() => {
      if (mode === 'wander' && target === null && !dragging && !falling && currentMotion === restingMotion) {
        playMotion(fidgets[Math.floor(Math.random() * fidgets.length)]);
      }
    }, rand(1500, 3500));
  }

  function wanderStep() {
    let x = pos.x;
    for (let tries = 0; tries < 6 && Math.abs(x - pos.x) < 140; tries++) {
      x = rand(size.width / 2, window.innerWidth - size.width / 2);
    }
    walkTo(x, () => {
      settle();
      nextWanderAt = now() + rand(cfg.walk.minPauseSeconds, cfg.walk.maxPauseSeconds) * 1000;
    });
  }

  // ---------- Presence: walking on and off screen ----------

  // Walk on screen from a random edge of the display the user is on. Resolves once positioned.
  let entering = null;
  function enter() {
    if (!away) return Promise.resolve();
    if (!entering) entering = moveToActiveDisplay().then(placeAtEdge).finally(() => (entering = null));
    return entering;
  }

  async function moveToActiveDisplay() {
    const bounds = await host.moveToActiveDisplay();
    if (window.innerWidth === bounds.width && window.innerHeight === bounds.height) return;
    // Wait for the page to see its new size before placing the character.
    await new Promise((resolve) => {
      const done = () => {
        window.removeEventListener('resize', done);
        resolve();
      };
      window.addEventListener('resize', done);
      setTimeout(done, 500);
    });
  }

  function placeAtEdge() {
    away = false;
    const fromLeft = Math.random() < 0.5;
    pos.x = fromLeft ? -size.width / 2 : window.innerWidth + size.width / 2;
    pos.y = ground();
    face(fromLeft ? 1 : -1);
    host.setPresent(true);
  }

  let leaving = false;
  function leave(onGone) {
    if (away) return;
    leaveAt = Infinity;
    hideBubble();
    const toLeft = pos.x < window.innerWidth / 2;
    walkTo(toLeft ? -size.width : window.innerWidth + size.width, () => {
      leaving = false;
      away = true;
      setInteractive(false);
      host.setPresent(false);
      if (onGone) onGone();
    }, false);
    leaving = true; // after walkTo, which clears it for any other walk
  }

  // The user moved to another monitor: walk off this one and come in on theirs.
  function relocate() {
    if (away || leaving || dragging || mode !== 'wander') return;
    leave(() => visit(presence === 'always' ? 0 : 10));
  }

  // A short visit: walk in, hang around for `seconds` (when only showing up for reminders), leave.
  async function visit(seconds, onArrived) {
    await enter();
    walkTo(rand(size.width * 1.5, window.innerWidth - size.width * 1.5), () => {
      settle();
      nextWanderAt = now() + seconds * 1000;
      if (presence === 'reminders') leaveAt = now() + seconds * 1000;
      if (onArrived) onArrived();
    });
  }

  function setPresence(value) {
    presence = value === 'always' ? 'always' : 'reminders';
    if (presence === 'always') {
      leaveAt = Infinity;
      if (away) visit(0);
    } else if (mode === 'wander' && !away) {
      leaveAt = now();
    }
  }

  function land() {
    falling = false;
    vy = 0;
    pos.y = ground();
    if (mode !== 'sleep') setEmotion('surprised', 0.8);
    playMotion(restMotion());
    pausedUntil = now() + 1500;
    if (mode === 'reminder' && !reminderPresented) approachForReminder();
  }

  // ---------- Hydration reminder ----------

  function scheduleHydration(minutes) {
    clearTimeout(hydrationTimer);
    hydrationTimer = setTimeout(startHydration, minutes * 60_000);
  }

  function startHydration() {
    if (mode === 'reminder') return;
    if (mode === 'sleep' || hidden) {
      pendingReminder = true;
      return;
    }
    pendingReminder = false;
    clearTimeout(hydrationTimer);
    sequence++;
    hideBubble();
    mode = 'reminder';
    reminderPresented = false;
    leaveAt = Infinity;
    enter().then(() => {
      if (mode === 'reminder' && !reminderPresented) approachForReminder();
    });
  }

  // Stand far enough from the screen edges that the bubble fits.
  function approachForReminder() {
    const margin = Math.max(size.width, 170);
    walkTo(clamp(pos.x, margin, window.innerWidth - margin), presentHydration);
  }

  function presentHydration() {
    if (mode !== 'reminder' || reminderPresented) return;
    reminderPresented = true;
    playMotion('hold_bottle');
    setEmotion('happy', Infinity);
    say(lines.hydrationAsk(cfg.userName), {
      buttons: [
        { label: 'Yes', primary: true, onClick: hydrationDone },
        { label: 'Remind me later', onClick: () => hydrationSnooze(false) },
      ],
    });
    clearTimeout(autoSnoozeTimer);
    autoSnoozeTimer = setTimeout(() => hydrationSnooze(true), cfg.hydration.unansweredSnoozeSeconds * 1000);
  }

  function hydrationDone() {
    scheduleHydration(cfg.hydration.intervalMinutes);
    const count = logDrink();
    endReminder(4);
    say(lines.hydrationDone(count), { seconds: 3.2 });
    setEmotion('happy', 4);
    const seq = ++sequence;
    playMotion('drink').then((completed) => {
      if (completed && seq === sequence) playMotion('celebrate');
    });
  }

  function hydrationSnooze(unanswered) {
    const minutes = cfg.hydration.snoozeMinutes;
    scheduleHydration(minutes);
    endReminder(unanswered ? 0.5 : 2.5);
    playMotion('idle');
    setBaseExpression(baseExpression);
    if (unanswered) hideBubble();
    else say(`Okay, I'll ask again in ${minutes} min.`, { seconds: 2.5 });
  }

  function endReminder(pauseSeconds) {
    clearTimeout(autoSnoozeTimer);
    mode = 'wander';
    reminderPresented = false;
    target = null;
    onArrive = null;
    pausedUntil = now() + pauseSeconds * 1000;
    if (presence === 'reminders') leaveAt = pausedUntil + 1000;
  }

  function logDrink() {
    const day = new Date().toLocaleDateString('en-CA');
    try {
      const log = JSON.parse(localStorage.getItem('hydrationLog') || '{}');
      log[day] = (log[day] || 0) + 1;
      localStorage.setItem('hydrationLog', JSON.stringify(log));
      return log[day];
    } catch {
      return 1;
    }
  }

  // ---------- Sleep & visibility ----------

  function sleep() {
    if (mode === 'sleep') return;
    if (mode === 'reminder') pendingReminder = true;
    sequence++;
    clearTimeout(autoSnoozeTimer);
    hideBubble();
    mode = 'sleep';
    reminderPresented = false;
    target = null;
    onArrive = null;
    setBaseExpression('sleepy');
    playMotion('sleep');
    host.reportState({ sleeping: true });
  }

  function wake() {
    if (mode !== 'sleep') return;
    mode = 'wander';
    setBaseExpression('neutral');
    host.reportState({ sleeping: false });
    if (away) {
      // Nobody saw it sleep; just deliver anything that came due meanwhile.
      if (pendingReminder) setTimeout(startHydration, 1500);
      return;
    }
    setEmotion('happy', 2.5);
    playMotion('idle');
    say(lines.wake(), { seconds: 2.5 });
    pausedUntil = now() + 3000;
    if (pendingReminder) setTimeout(startHydration, 3500);
  }

  function setVisibility(visible) {
    hidden = !visible;
    if (visible && pendingReminder && mode !== 'sleep') setTimeout(startHydration, 1500);
  }

  // ---------- Clicks & dragging ----------

  const recentClicks = [];

  function onClick() {
    if (mode === 'sleep') return wake();
    if (mode === 'reminder') return; // the bubble's buttons handle this
    const t = now();
    recentClicks.push(t);
    while (t - recentClicks[0] > 2500) recentClicks.shift();
    target = null;
    onArrive = null;
    pausedUntil = t + 2600;
    if (leaveAt !== Infinity) leaveAt = Math.max(leaveAt, t + 8000); // stay a bit while being played with
    if (recentClicks.length >= 3) {
      setEmotion('annoyed', 2.6);
      playMotion('idle');
      say(lines.tickled(), { seconds: 2.4 });
      return;
    }
    const reaction = lines.reactions[Math.floor(Math.random() * lines.reactions.length)];
    setEmotion(reaction.emotion, 2.6);
    playMotion(reaction.motion);
    say(reaction.text(cfg.userName), { seconds: 2.4 });
  }

  function startDrag() {
    sequence++;
    dragging = true;
    falling = false;
    target = null;
    document.body.classList.add('dragging');
    if (!reminderPresented) hideBubble();
    setEmotion('surprised', Infinity);
    playMotion('dangle');
  }

  function endDrag() {
    dragging = false;
    document.body.classList.remove('dragging');
    emotionResetAt = now();
    if (pos.y < ground() - 1) {
      falling = true;
      vy = 0;
    } else {
      land();
    }
  }

  let press = null;
  companionEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || bubbleEl.contains(e.target) || !avatar.hitTest(e.clientX, e.clientY)) return;
    press = { startX: e.clientX, startY: e.clientY, dx: pos.x - e.clientX, dy: pos.y - e.clientY, moved: false };
    companionEl.setPointerCapture(e.pointerId);
  });
  companionEl.addEventListener('pointermove', (e) => {
    if (!press) return;
    if (!press.moved && Math.hypot(e.clientX - press.startX, e.clientY - press.startY) > 5) {
      press.moved = true;
      startDrag();
    }
    if (press.moved) {
      pos.x = clampX(e.clientX + press.dx);
      pos.y = clampY(e.clientY + press.dy);
    }
  });
  companionEl.addEventListener('pointerup', () => {
    if (!press) return;
    const wasDrag = press.moved;
    press = null;
    if (wasDrag) endDrag();
    else onClick();
  });
  companionEl.addEventListener('pointercancel', () => {
    if (press && press.moved) endDrag();
    press = null;
  });

  // ---------- Click-through ----------
  // The window ignores the mouse (clicks reach the desktop) except while the pointer is over
  // the character or its bubble.

  let interactive = false;
  const mouse = { x: -1, y: -1 };

  function isOverCompanion(x, y) {
    if (!bubbleEl.hidden) {
      const r = bubbleEl.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    return avatar.hitTest(x, y);
  }

  function setInteractive(on) {
    if (on === interactive) return;
    interactive = on;
    host.setIgnoreMouse(!on);
  }

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!press) setInteractive(isOverCompanion(mouse.x, mouse.y));
  });
  document.addEventListener('mouseleave', () => {
    if (!press) setInteractive(false);
  });

  // ---------- Frame loop ----------

  let lastFrame = now();
  let lastHoverCheck = 0;

  function tick(t) {
    const dt = Math.min(0.05, (t - lastFrame) / 1000);
    lastFrame = t;

    if (!dragging && !falling && !away && pos.y < ground() - 1 && t >= pausedUntil) {
      falling = true;
      vy = 0;
      playMotion('dangle');
    }

    if (falling) {
      vy += 2400 * dt;
      pos.y += vy * dt;
      if (pos.y >= ground()) land();
    } else if (target !== null && !dragging && mode !== 'sleep') {
      const dx = target - pos.x;
      if (Math.abs(dx) < 2) {
        pos.x = target;
        target = null;
        const callback = onArrive;
        onArrive = null;
        if (callback) callback();
        else playMotion('idle');
      } else {
        ensureMotion('walk');
        face(dx);
        pos.x += Math.sign(dx) * Math.min(Math.abs(dx), cfg.walk.speed * dt);
      }
    } else if (mode === 'wander' && !dragging && !away && t >= pausedUntil) {
      if (t >= leaveAt) leave();
      else if (t >= nextWanderAt && leaveAt === Infinity) wanderStep(); // no strolling when about to leave
    }

    if (t >= emotionResetAt) {
      emotionResetAt = Infinity;
      avatar.setExpression(baseExpression);
    }

    // The character may move out from under (or in under) a still pointer.
    if (!press && mouse.x >= 0 && t - lastHoverCheck > 100) {
      lastHoverCheck = t;
      setInteractive(isOverCompanion(mouse.x, mouse.y));
    }

    render();
    requestAnimationFrame(tick);
  }

  function render() {
    companionEl.style.transform = `translate(${pos.x - size.width / 2}px, ${pos.y - size.height}px)`;
    if (bubbleEl.hidden) return;
    // Keep the bubble on screen when the character is near an edge.
    const shift = parseFloat(bubbleEl.style.getPropertyValue('--shift')) || 0;
    const r = bubbleEl.getBoundingClientRect();
    const left = r.left - shift;
    const right = r.right - shift;
    let next = 0;
    if (left < 8) next = 8 - left;
    else if (right > window.innerWidth - 8) next = window.innerWidth - 8 - right;
    if (Math.abs(next - shift) > 0.5) bubbleEl.style.setProperty('--shift', `${next}px`);
  }

  window.addEventListener('resize', () => {
    if (away) return; // placed afresh when it next walks on
    pos.x = clampX(pos.x);
    if (!dragging) pos.y = Math.min(pos.y, ground());
    if (target !== null) target = clampX(target);
  });

  // ---------- Command surface ----------

  const api = {
    ready: true,
    setPosition(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      target = null;
      onArrive = null;
      falling = false;
      pos.x = clampX(x);
      pos.y = clampY(y);
      pausedUntil = now() + 5000;
    },
    playMotion(name) {
      target = null;
      onArrive = null;
      pausedUntil = now() + 4000;
      return playMotion(String(name));
    },
    setExpression(name, seconds = 4) {
      setEmotion(String(name), seconds);
    },
    say(text, seconds = 4) {
      say(String(text), { seconds });
    },
    walkTo(x) {
      if (!Number.isFinite(x)) return;
      pausedUntil = 0;
      walkTo(x, () => {
        settle();
        nextWanderAt = now() + 8000;
      });
    },
    hydrate: startHydration,
    relocate,
    summon: () => (mode === 'wander' ? visit(20, () => say(lines.greeting(cfg.userName), { seconds: 3 })) : undefined),
    setPresence,
    sleep,
    wake,
    visibility: setVisibility,
    hitTest: isOverCompanion,
    debug() {
      const r = avatarEl.getBoundingClientRect();
      return {
        avatar: avatar.kind,
        mode,
        presence,
        away,
        motion: currentMotion,
        pos: { ...pos },
        size,
        box: { x: r.x, y: r.y, width: r.width, height: r.height },
        bubble: bubbleEl.hidden ? null : bubbleEl.textContent,
      };
    },
  };
  window.companion = api;

  const HOST_COMMANDS = ['setPosition', 'playMotion', 'setExpression', 'say', 'walkTo', 'hydrate', 'summon', 'relocate', 'setPresence', 'sleep', 'wake', 'visibility'];
  host.onCommand(({ cmd, args }) => {
    if (HOST_COMMANDS.includes(cmd)) api[cmd](...args);
    else console.warn(`Unknown command "${cmd}"`);
  });

  // ---------- Start ----------

  // Arrive from the edge and say hello; in reminders mode, explain and then leave.
  setBaseExpression('neutral');
  const intro = presence === 'reminders' ? lines.intro : lines.greeting;
  visit(presence === 'reminders' ? 6 : 0, () => {
    setEmotion('happy', 2.5);
    playMotion('wave');
    say(intro(cfg.userName), { seconds: 4.5 });
    pausedUntil = now() + 4500;
  });
  scheduleHydration(cfg.hydration.firstReminderMinutes);
  host.reportState({ sleeping: false });
  requestAnimationFrame(tick);
})();
