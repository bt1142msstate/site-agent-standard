import {
  SITE_AGENT_PRESENTATION_SOUND_PROFILES,
  createPresentationSoundSamples,
} from "./presentation-audio.js";

export * from "./presentation-audio.js";

export const SITE_AGENT_PRESENTATION_VERSION = 2;

export const SITE_AGENT_PRESENTATION_PRESET = Object.freeze({
  id: "standard-instructional-v2",
  cursor: "modern-stemless-pointer",
  cursorMotion: "travel-pause-click",
  frameTarget: "settled-sticky-header-aware",
  clickFeedback: "target-outline-and-ripple",
  clickSound: SITE_AGENT_PRESENTATION_SOUND_PROFILES.click,
  scrollMotion: "tutorial-eased-nested-scroll-v1",
  inputPresentation: "visible-typing-with-keystroke-audio",
  typingSound: SITE_AGENT_PRESENTATION_SOUND_PROFILES.typing,
  responsiveVariants: Object.freeze(["desktop", "mobile"]),
  moveDuration: Object.freeze({ minimumMs: 280, maximumMs: 640, baseMs: 240, distanceFactor: 0.18 }),
  targetPauseMs: 180,
  clickDurationMs: 220,
  keyDelayMs: 42,
  soundsEnabled: true,
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

function nextAnimationFrame(windowRef) {
  return new Promise((resolve) => windowRef.requestAnimationFrame(resolve));
}

function isScrollableElement(element, windowRef) {
  const style = windowRef.getComputedStyle(element);
  return (
    (/(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2) ||
    (/(auto|scroll|overlay)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 2)
  );
}

function getTopOcclusion(documentRef, windowRef) {
  let maximum = 0;
  documentRef.querySelectorAll("body *").forEach((element) => {
    if (!(element instanceof windowRef.HTMLElement)) return;
    const style = windowRef.getComputedStyle(element);
    if (!new Set(["fixed", "sticky"]).has(style.position) || style.visibility === "hidden") return;
    const bounds = element.getBoundingClientRect();
    if (
      bounds.top > 2 ||
      bounds.bottom <= 0 ||
      bounds.width < windowRef.innerWidth * 0.45 ||
      Number(style.opacity) === 0
    ) return;
    maximum = Math.max(maximum, bounds.bottom);
  });
  return maximum;
}

async function animateScrollTarget(target, destination, options) {
  const { root, windowRef, reducedMotion, preset } = options;
  const isRoot = target === root;
  const startLeft = isRoot ? windowRef.scrollX : target.scrollLeft;
  const startTop = isRoot ? windowRef.scrollY : target.scrollTop;
  const deltaLeft = destination.left - startLeft;
  const deltaTop = destination.top - startTop;
  const distance = Math.hypot(deltaLeft, deltaTop);
  if (distance < 2) return null;
  const duration = reducedMotion ? 0 : getPresentationMotionDuration(distance, preset);
  const startedAt = windowRef.performance.now();
  const setPosition = (progress) => {
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - (Math.pow(-2 * progress + 2, 3) / 2);
    const left = startLeft + (deltaLeft * eased);
    const top = startTop + (deltaTop * eased);
    if (isRoot) windowRef.scrollTo(left, top);
    else target.scrollTo(left, top);
  };
  if (!duration) {
    setPosition(1);
  } else {
    while (true) {
      const progress = clamp((windowRef.performance.now() - startedAt) / duration, 0, 1);
      setPosition(progress);
      if (progress >= 1) break;
      await nextAnimationFrame(windowRef);
    }
  }
  return Object.freeze({
    distancePx: Math.round(distance),
    durationMs: Math.round(windowRef.performance.now() - startedAt),
    scope: isRoot ? "viewport" : "container",
  });
}

export async function framePresentationTarget(target, options = {}) {
  if (!target?.getBoundingClientRect) throw new TypeError("presentation-target-element-required");
  const documentRef = options.document || target.ownerDocument || globalThis.document;
  const windowRef = options.window || documentRef?.defaultView || globalThis.window;
  const root = documentRef.scrollingElement || documentRef.documentElement;
  const scrollParents = [];
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (
      parent !== documentRef.body &&
      parent !== documentRef.documentElement &&
      isScrollableElement(parent, windowRef)
    ) scrollParents.push(parent);
  }
  scrollParents.push(root);

  const topMargin = Math.max(
    getTopOcclusion(documentRef, windowRef) + 18,
    Math.min(128, Math.max(72, windowRef.innerHeight * 0.13)),
  );
  const bottomMargin = Math.min(96, Math.max(48, windowRef.innerHeight * 0.1));
  const sideMargin = Math.min(40, Math.max(18, windowRef.innerWidth * 0.035));
  const priorStyles = {
    rootAnchor: root.style.overflowAnchor,
    rootBehavior: root.style.scrollBehavior,
    bodyAnchor: documentRef.body.style.overflowAnchor,
    bodyBehavior: documentRef.body.style.scrollBehavior,
  };
  root.style.overflowAnchor = "none";
  root.style.scrollBehavior = "auto";
  documentRef.body.style.overflowAnchor = "none";
  documentRef.body.style.scrollBehavior = "auto";
  const segments = [];

  try {
    for (const scrollTarget of scrollParents) {
      const isRoot = scrollTarget === root;
      const targetRect = target.getBoundingClientRect();
      const containerRect = isRoot
        ? { top: topMargin, bottom: windowRef.innerHeight - bottomMargin, left: sideMargin, right: windowRef.innerWidth - sideMargin }
        : scrollTarget.getBoundingClientRect();
      const verticalPadding = isRoot ? 0 : Math.min(24, Math.max(10, scrollTarget.clientHeight * 0.04));
      const horizontalPadding = isRoot ? 0 : Math.min(24, Math.max(10, scrollTarget.clientWidth * 0.04));
      const visibleRect = {
        top: containerRect.top + verticalPadding,
        bottom: containerRect.bottom - verticalPadding,
        left: containerRect.left + horizontalPadding,
        right: containerRect.right - horizontalPadding,
      };
      if (
        targetRect.top >= visibleRect.top &&
        targetRect.bottom <= visibleRect.bottom &&
        targetRect.left >= visibleRect.left &&
        targetRect.right <= visibleRect.right
      ) continue;

      const currentLeft = isRoot ? windowRef.scrollX : scrollTarget.scrollLeft;
      const currentTop = isRoot ? windowRef.scrollY : scrollTarget.scrollTop;
      const maximumLeft = isRoot
        ? Math.max(0, root.scrollWidth - windowRef.innerWidth)
        : Math.max(0, scrollTarget.scrollWidth - scrollTarget.clientWidth);
      const maximumTop = isRoot
        ? Math.max(0, root.scrollHeight - windowRef.innerHeight)
        : Math.max(0, scrollTarget.scrollHeight - scrollTarget.clientHeight);
      const segment = await animateScrollTarget(scrollTarget, {
        left: clamp(
          currentLeft + ((targetRect.left + targetRect.right) / 2) - ((visibleRect.left + visibleRect.right) / 2),
          0,
          maximumLeft,
        ),
        top: clamp(
          currentTop + ((targetRect.top + targetRect.bottom) / 2) - ((visibleRect.top + visibleRect.bottom) / 2),
          0,
          maximumTop,
        ),
      }, {
        root,
        windowRef,
        reducedMotion: options.reducedMotion === true,
        preset: options.preset || SITE_AGENT_PRESENTATION_PRESET,
      });
      if (segment) segments.push(segment);
    }
    await nextAnimationFrame(windowRef);
    await nextAnimationFrame(windowRef);
  } finally {
    root.style.overflowAnchor = priorStyles.rootAnchor;
    root.style.scrollBehavior = priorStyles.rootBehavior;
    documentRef.body.style.overflowAnchor = priorStyles.bodyAnchor;
    documentRef.body.style.scrollBehavior = priorStyles.bodyBehavior;
  }

  return Object.freeze({
    distancePx: segments.reduce((total, segment) => total + segment.distancePx, 0),
    durationMs: segments.reduce((total, segment) => total + segment.durationMs, 0),
    scrolled: segments.length > 0,
    segments: Object.freeze(segments),
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
  adapter.setMuted?.(muted);

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
  let audioContext = null;
  let soundIndex = 0;

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

  function getAudioContext() {
    const AudioContext = windowRef?.AudioContext || windowRef?.webkitAudioContext;
    if (!AudioContext) return null;
    audioContext ||= new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume?.().catch?.(() => {});
    return audioContext;
  }

  function playSound(kind) {
    if (muted || options.sounds === false) return false;
    const context = getAudioContext();
    if (!context) return false;
    const samples = createPresentationSoundSamples(kind, {
      eventIndex: soundIndex,
      sampleRate: context.sampleRate,
    });
    soundIndex += 1;
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(Float32Array.from(samples), 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    options.onSound?.({ kind, profile: SITE_AGENT_PRESENTATION_SOUND_PROFILES[kind] });
    return true;
  }

  return Object.freeze({
    setMuted(value) { muted = Boolean(value); },
    mount,
    async move({ target, settings, preset }) {
      const element = resolveElement(target);
      const framing = await framePresentationTarget(element, {
        document: documentRef,
        window: windowRef,
        reducedMotion: settings.reducedMotion,
        preset,
      });
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
      return { point, exact: true, visible: true, framing };
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
      playSound("click");
      element.click();
      await new Promise((resolve) => setTimeout(resolve, settings.reducedMotion ? 0 : preset.clickDurationMs));
      return { point, exact: true, visible: true };
    },
    async type({ target, value, settings }) {
      const element = resolveElement(target);
      element.focus();
      element.value = "";
      const delay = settings.reducedMotion ? 0 : Math.max(0, Number(settings.keyDelayMs ?? SITE_AGENT_PRESENTATION_PRESET.keyDelayMs));
      for (const character of value) {
        element.value += character;
        element.dispatchEvent(new windowRef.InputEvent("input", { bubbles: true, data: character, inputType: "insertText" }));
        playSound("typing");
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
      audioContext?.close?.().catch?.(() => {});
      audioContext = null;
    },
  });
}
