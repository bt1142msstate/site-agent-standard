const activeStates = new Set([
  "activating",
  "adapter-error",
  "applying-state",
  "inexact-target",
  "locating",
  "retrying",
  "scrolling",
  "state-not-verified",
  "target-not-found",
  "waiting",
]);

const terminalStates = new Set([
  "cancelled",
  "failed",
  "focused",
  "not-found",
  "not-visible",
  "stopped",
  "timed-out",
]);

const phaseCopy = Object.freeze({
  activating: "Opening the right view",
  "adapter-error": "Waiting for the view",
  "applying-state": "Applying your filters",
  "inexact-target": "Finding the exact result",
  locating: "Finding the exact result",
  retrying: "Finishing the view",
  scrolling: "Bringing it into view",
  "state-not-verified": "Checking every filter",
  "target-not-found": "Waiting for the result",
  waiting: "Preparing your view",
});

const phaseProgress = Object.freeze({
  activating: 26,
  "adapter-error": 34,
  "applying-state": 48,
  "inexact-target": 62,
  locating: 66,
  retrying: 74,
  scrolling: 86,
  "state-not-verified": 58,
  "target-not-found": 68,
  waiting: 12,
});

const releaseCopy = Object.freeze({
  cancelled: "Navigation stopped",
  failed: "That destination could not be opened",
  focused: "Ready",
  "not-found": "That exact item could not be found",
  "not-visible": "That item could not be brought into view",
  stopped: "Navigation stopped",
  "timed-out": "Navigation took too long. You can keep using the page",
});

const blockedEventTypes = Object.freeze([
  "beforeinput", "change", "click", "dblclick", "input", "keydown", "mousedown", "mouseup",
  "pointerdown", "pointerup", "submit", "touchmove", "touchstart", "wheel",
]);

function appendElement(documentRef, parent, tagName, className, text = "") {
  const element = documentRef.createElement(tagName);
  element.className = className;
  if (text) element.textContent = text;
  parent.append(element);
  return element;
}

function eventComesFromProgress(event, root) {
  const path = event.composedPath?.() || [];
  return path.includes(root) || root.contains?.(event.target);
}

/**
 * Presents navigation progress and temporarily blocks trusted user input while
 * leaving programmatic adapter events untouched.
 */
export function createNavigationProgress(options = {}) {
  const windowRef = options.windowRef || globalThis;
  const documentRef = options.documentRef || windowRef.document;
  const setTimeoutRef = options.setTimeoutRef || windowRef.setTimeout?.bind(windowRef);
  const clearTimeoutRef = options.clearTimeoutRef || windowRef.clearTimeout?.bind(windowRef);
  const maxDurationMs = Math.max(1000, Number(options.maxDurationMs || 21_000));
  let active = false;
  let cancelHandler = typeof options.onCancel === "function" ? options.onCancel : null;
  let releaseTimer = 0;
  let safetyTimer = 0;
  let previousActiveElement = null;
  let previousBodyBusy = null;

  if (!documentRef?.createElement) {
    return {
      cancel: () => {}, destroy: () => {}, isActive: () => false,
      setCancelHandler: () => {}, update: () => {},
    };
  }

  const root = documentRef.createElement("aside");
  root.className = options.className || "site-navigation-progress";
  root.setAttribute("aria-label", options.label || "Navigation progress");
  root.setAttribute("data-site-navigation-progress", "");
  root.setAttribute("popover", "manual");
  const panel = appendElement(documentRef, root, "div", "site-navigation-progress-panel");
  const indicator = appendElement(documentRef, panel, "span", "site-navigation-progress-indicator");
  indicator.setAttribute("aria-hidden", "true");
  appendElement(documentRef, indicator, "span", "site-navigation-progress-indicator-dot");
  const copy = appendElement(documentRef, panel, "span", "site-navigation-progress-copy");
  appendElement(documentRef, copy, "strong", "site-navigation-progress-title", options.title || "Taking you there");
  const message = appendElement(documentRef, copy, "span", "site-navigation-progress-message", phaseCopy.waiting);
  message.setAttribute("aria-atomic", "true");
  message.setAttribute("aria-live", "polite");
  const cancelButton = appendElement(documentRef, panel, "button", "site-navigation-progress-cancel", "X");
  cancelButton.type = "button";
  cancelButton.setAttribute("aria-label", options.cancelLabel || "Stop navigation");
  cancelButton.title = options.cancelLabel || "Stop navigation";
  const track = appendElement(documentRef, panel, "span", "site-navigation-progress-track");
  track.setAttribute("aria-hidden", "true");
  appendElement(documentRef, track, "span", "site-navigation-progress-track-fill");

  const supportsPopover = typeof root.showPopover === "function";
  if (!supportsPopover) root.hidden = true;
  (documentRef.body || documentRef.documentElement)?.append?.(root);

  function clearTimers() {
    if (releaseTimer) clearTimeoutRef?.(releaseTimer);
    if (safetyTimer) clearTimeoutRef?.(safetyTimer);
    releaseTimer = 0;
    safetyTimer = 0;
  }

  function showRoot() {
    if (supportsPopover) {
      try {
        if (!root.matches?.(":popover-open")) root.showPopover();
      } catch (_error) {
        root.hidden = false;
      }
    } else root.hidden = false;
  }

  function hideRoot() {
    if (supportsPopover) {
      try {
        if (root.matches?.(":popover-open")) root.hidePopover();
      } catch (_error) {
        root.hidden = true;
      }
    } else root.hidden = true;
  }

  function blockUserInteraction(event) {
    if (!active || event.isTrusted === false || eventComesFromProgress(event, root)) return;
    if (event.type === "keydown" && event.key === "Escape") {
      event.preventDefault?.();
      cancel("cancelled");
      return;
    }
    if (event.cancelable) event.preventDefault();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
  }

  function bindInteractionLock() {
    blockedEventTypes.forEach((type) => {
      documentRef.addEventListener?.(type, blockUserInteraction, { capture: true, passive: false });
    });
  }

  function unbindInteractionLock() {
    blockedEventTypes.forEach((type) => documentRef.removeEventListener?.(type, blockUserInteraction, true));
  }

  function setPhase(state, descriptor = null) {
    const normalizedState = activeStates.has(state) ? state : "waiting";
    root.dataset.navigationState = normalizedState;
    root.dataset.navigationKind = String(descriptor?.kind || "").slice(0, 80);
    root.style?.setProperty?.("--site-navigation-progress", `${phaseProgress[normalizedState] || 12}%`);
    message.textContent = phaseCopy[normalizedState] || phaseCopy.waiting;
  }

  function begin(state = "waiting") {
    if (active) return;
    clearTimers();
    active = true;
    previousActiveElement = documentRef.activeElement;
    previousBodyBusy = documentRef.body?.getAttribute?.("aria-busy");
    documentRef.documentElement?.setAttribute?.("data-site-navigation-locked", "true");
    documentRef.body?.setAttribute?.("aria-busy", "true");
    root.dataset.navigationActive = "true";
    cancelButton.hidden = false;
    showRoot();
    bindInteractionLock();
    safetyTimer = setTimeoutRef?.(() => cancel("timed-out"), maxDurationMs) || 0;
    windowRef.requestAnimationFrame?.(() => {
      if (active) cancelButton.focus?.({ preventScroll: true });
    });
    setPhase(state);
  }

  function release(state = "stopped") {
    if (!active && !terminalStates.has(state)) return;
    const wasActive = active;
    active = false;
    clearTimers();
    unbindInteractionLock();
    documentRef.documentElement?.removeAttribute?.("data-site-navigation-locked");
    if (previousBodyBusy == null) documentRef.body?.removeAttribute?.("aria-busy");
    else documentRef.body?.setAttribute?.("aria-busy", previousBodyBusy);
    root.dataset.navigationActive = "false";
    root.dataset.navigationState = state;
    root.style?.setProperty?.("--site-navigation-progress", state === "focused" ? "100%" : "0%");
    cancelButton.hidden = true;
    message.textContent = releaseCopy[state] || releaseCopy.stopped;
    if (wasActive && state !== "focused" && previousActiveElement?.isConnected !== false) {
      previousActiveElement?.focus?.({ preventScroll: true });
    }
    releaseTimer = setTimeoutRef?.(hideRoot, state === "focused" ? 650 : 2600) || 0;
  }

  function cancel(reason = "cancelled") {
    if (!active) return;
    release(reason);
    cancelHandler?.(reason);
  }

  function update(state, descriptor = null) {
    if (terminalStates.has(state)) {
      release(state);
      return;
    }
    if (!activeStates.has(state)) return;
    if (!active) begin(state);
    setPhase(state, descriptor);
  }

  function destroy() {
    if (active) release("stopped");
    clearTimers();
    unbindInteractionLock();
    hideRoot();
    root.remove?.();
  }

  cancelButton.addEventListener?.("click", () => cancel("cancelled"));
  return {
    cancel,
    destroy,
    element: root,
    isActive: () => active,
    setCancelHandler: (handler) => { cancelHandler = typeof handler === "function" ? handler : null; },
    update,
  };
}
