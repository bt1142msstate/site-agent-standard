export const SITE_AGENT_PRESENTATION_VERSION = 1;

export const SITE_AGENT_PRESENTATION_PRESET = Object.freeze({
  id: "standard-instructional-v1",
  cursor: "modern-stemless-pointer",
  cursorMotion: "travel-pause-click",
  frameTarget: "settled-sticky-header-aware",
  clickFeedback: "target-outline-and-ripple",
  clickSound: "soft-tactile-ui-click-v1",
  scrollMotion: "tutorial-eased-nested-scroll-v1",
  inputPresentation: "visible-typing-with-keystroke-audio",
  typingSound: "ios-inspired-mobile-keyboard-tap-v1",
  responsiveVariants: Object.freeze(["desktop", "mobile"]),
  moveDuration: Object.freeze({ minimumMs: 280, maximumMs: 640, baseMs: 240, distanceFactor: 0.18 }),
  targetPauseMs: 180,
  clickDurationMs: 220,
});

export const SITE_AGENT_PRESENTATION_SELECTORS = Object.freeze({
  pointer: "[data-site-agent-presentation-pointer]",
  target: "[data-site-agent-presentation-target]",
  ripple: "[data-site-agent-presentation-ripple]",
  pointerCoreClass: "site-agent-presentation-pointer-core",
});

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function getPresentationMotionDuration(distance, preset = SITE_AGENT_PRESENTATION_PRESET) {
  const motion = preset.moveDuration || SITE_AGENT_PRESENTATION_PRESET.moveDuration;
  return clamp(
    Number(motion.baseMs) + (Math.max(0, Number(distance) || 0) * Number(motion.distanceFactor)),
    Number(motion.minimumMs),
    Number(motion.maximumMs),
  );
}

export function getPresentationPointerPoint(box, options = {}) {
  if (!box) return null;
  const xRatio = Number.isFinite(options.xRatio) ? options.xRatio : 0.5;
  const yRatio = Number.isFinite(options.yRatio) ? options.yRatio : 0.5;
  return Object.freeze({
    x: Math.round(box.x + clamp(box.width * xRatio, 12, Math.max(12, box.width - 12))),
    y: Math.round(box.y + clamp(box.height * yRatio, 12, Math.max(12, box.height - 12))),
  });
}

function requiredAdapterMethod(adapter, method) {
  if (typeof adapter?.[method] !== "function") throw new Error(`presentation-${method}-not-supported`);
  return adapter[method].bind(adapter);
}

function reportSafely(report, event) {
  if (typeof report !== "function") return;
  report(Object.freeze({
    profile: "presentation",
    event: event.event,
    status: event.status,
    durationMs: event.durationMs,
    failureCode: event.failureCode || "",
  }));
}

export function createPresentationController(options = {}) {
  const adapter = options.adapter || {};
  const preset = Object.freeze({
    ...SITE_AGENT_PRESENTATION_PRESET,
    ...(options.preset || {}),
  });
  let muted = options.muted !== false;

  async function invoke(event, operation) {
    const startedAt = Date.now();
    try {
      const result = await operation();
      reportSafely(options.report, { event, status: "succeeded", durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      reportSafely(options.report, {
        event,
        status: "failed",
        durationMs: Date.now() - startedAt,
        failureCode: String(error?.message || "failed").slice(0, 120),
      });
      throw error;
    }
  }

  return Object.freeze({
    preset,
    get muted() { return muted; },
    setMuted(value) {
      muted = Boolean(value);
      adapter.setMuted?.(muted);
      return muted;
    },
    mount: () => invoke("mount", () => requiredAdapterMethod(adapter, "mount")({ preset, muted })),
    move: (target, settings = {}) => invoke("move", () => requiredAdapterMethod(adapter, "move")({ target, settings, preset, muted })),
    click: (target, settings = {}) => invoke("click", async () => {
      const move = requiredAdapterMethod(adapter, "move");
      const click = requiredAdapterMethod(adapter, "click");
      await move({ target, settings, preset, muted });
      if (preset.targetPauseMs) await new Promise((resolve) => setTimeout(resolve, preset.targetPauseMs));
      return click({ target, settings, preset, muted });
    }),
    type: (target, value, settings = {}) => invoke("type", () => requiredAdapterMethod(adapter, "type")({
      target,
      value: String(value ?? ""),
      settings,
      preset,
      muted,
    })),
    clear: () => invoke("clear", () => adapter.clear?.({ preset, muted })),
    destroy: () => invoke("destroy", () => adapter.destroy?.({ preset, muted })),
  });
}

export function createBrowserPresentationAdapter(options = {}) {
  const documentRef = options.document || globalThis.document;
  const windowRef = options.window || globalThis.window;
  let muted = options.muted !== false;

  function resolveElement(target) {
    if (target?.nodeType === 1) return target;
    throw new TypeError("presentation-target-element-required");
  }

  function mount() {
    if (!documentRef?.head || !documentRef?.body) throw new Error("presentation-browser-document-required");
    if (!documentRef.querySelector(SITE_AGENT_PRESENTATION_SELECTORS.pointer)) {
      const pointer = documentRef.createElement("div");
      pointer.dataset.siteAgentPresentationPointer = "";
      pointer.setAttribute("aria-hidden", "true");
      pointer.innerHTML = `<svg class="${SITE_AGENT_PRESENTATION_SELECTORS.pointerCoreClass}" viewBox="0 0 42 48" aria-hidden="true"><path d="M5 4 38 28 20 28 7 44Z" fill="#fff" stroke="#10243b" stroke-width="3.2" stroke-linejoin="round"/></svg>`;
      documentRef.body.append(pointer);
    }
    return documentRef.querySelector(SITE_AGENT_PRESENTATION_SELECTORS.pointer);
  }

  function playTone(kind) {
    if (muted || options.sounds === false || !windowRef?.AudioContext) return;
    const context = new windowRef.AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = kind === "typing" ? 760 : 520;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.045);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.05);
    oscillator.addEventListener("ended", () => context.close(), { once: true });
  }

  return Object.freeze({
    setMuted(value) { muted = Boolean(value); },
    mount,
    async move({ target, settings, preset }) {
      const element = resolveElement(target);
      element.scrollIntoView({ behavior: settings.reducedMotion ? "auto" : "smooth", block: "center", inline: "center" });
      await new Promise((resolve) => windowRef.requestAnimationFrame(() => windowRef.requestAnimationFrame(resolve)));
      documentRef.querySelectorAll(SITE_AGENT_PRESENTATION_SELECTORS.target).forEach((value) => {
        value.removeAttribute("data-site-agent-presentation-target");
      });
      element.dataset.siteAgentPresentationTarget = "";
      const rect = element.getBoundingClientRect();
      const point = getPresentationPointerPoint({ x: rect.left, y: rect.top, width: rect.width, height: rect.height }, settings);
      const pointer = mount();
      const previous = pointer.getBoundingClientRect();
      const distance = Math.hypot(point.x - previous.left, point.y - previous.top);
      pointer.style.setProperty("--site-agent-pointer-duration", `${settings.reducedMotion ? 0 : getPresentationMotionDuration(distance, preset)}ms`);
      pointer.style.transform = `translate3d(${point.x - 5}px, ${point.y - 4}px, 0)`;
      pointer.classList.add("is-visible");
      await new Promise((resolve) => setTimeout(resolve, settings.reducedMotion ? 0 : getPresentationMotionDuration(distance, preset)));
      return { point, exact: true, visible: true };
    },
    async click({ target, settings, preset }) {
      const element = resolveElement(target);
      const rect = element.getBoundingClientRect();
      const point = getPresentationPointerPoint({ x: rect.left, y: rect.top, width: rect.width, height: rect.height }, settings);
      const pointer = mount();
      pointer.classList.remove("is-clicking");
      void pointer.offsetWidth;
      pointer.classList.add("is-clicking");
      const ripple = documentRef.createElement("span");
      ripple.dataset.siteAgentPresentationRipple = "";
      ripple.style.left = `${point.x}px`;
      ripple.style.top = `${point.y}px`;
      documentRef.body.append(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      playTone("click");
      element.click();
      await new Promise((resolve) => setTimeout(resolve, settings.reducedMotion ? 0 : preset.clickDurationMs));
      return { point, exact: true, visible: true };
    },
    async type({ target, value, settings }) {
      const element = resolveElement(target);
      element.focus();
      element.value = "";
      const delay = settings.reducedMotion ? 0 : Math.max(0, Number(settings.keyDelayMs ?? 42));
      for (const character of value) {
        element.value += character;
        element.dispatchEvent(new windowRef.InputEvent("input", { bubbles: true, data: character, inputType: "insertText" }));
        playTone("typing");
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      }
      element.dispatchEvent(new windowRef.Event("change", { bubbles: true }));
      return { characters: value.length };
    },
    clear() {
      documentRef.querySelectorAll(SITE_AGENT_PRESENTATION_SELECTORS.target).forEach((value) => {
        value.removeAttribute("data-site-agent-presentation-target");
      });
    },
    destroy() {
      this.clear?.();
      documentRef.querySelector(SITE_AGENT_PRESENTATION_SELECTORS.pointer)?.remove();
      documentRef.querySelectorAll(SITE_AGENT_PRESENTATION_SELECTORS.ripple).forEach((value) => value.remove());
    },
  });
}
