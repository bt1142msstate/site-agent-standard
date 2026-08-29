export {
  createNavigationProgress,
  createNavigationProgress as createNavigationTour,
} from "./navigation-progress.js";

function getParentElement(target) {
  return target?.parentElement || target?.getRootNode?.()?.host || null;
}

function isConnectedTarget(target) {
  return Boolean(target && target.isConnected !== false);
}

function findComposedAncestor(target, selector) {
  let current = target;
  while (current) {
    if (current.matches?.(selector)) return current;
    current = getParentElement(current);
  }
  return null;
}

function getScrollableAncestors(target, windowRef) {
  const ancestors = [];
  let parent = getParentElement(target);
  while (parent && parent !== target?.ownerDocument?.body) {
    const style = windowRef?.getComputedStyle?.(parent);
    const scrollsVertically = /(auto|scroll|overlay|hidden)/.test(String(style?.overflowY || ""))
      && parent.scrollHeight > parent.clientHeight;
    const scrollsHorizontally = /(auto|scroll|overlay|hidden)/.test(String(style?.overflowX || ""))
      && parent.scrollWidth > parent.clientWidth;
    if (scrollsVertically || scrollsHorizontally) {
      ancestors.push(parent);
    }
    if (parent.matches?.("dialog[open]")) break;
    parent = getParentElement(parent);
  }
  return ancestors;
}

function getClippingAncestors(target, windowRef) {
  const ancestors = [];
  let parent = getParentElement(target);
  while (parent && parent !== target?.ownerDocument?.body) {
    const style = windowRef?.getComputedStyle?.(parent);
    if (/(auto|scroll|hidden|clip)/.test(`${style?.overflowX || ""} ${style?.overflowY || ""}`)) {
      ancestors.push(parent);
    }
    if (parent.matches?.("dialog[open]")) break;
    parent = getParentElement(parent);
  }
  return ancestors;
}

function intersectBounds(bounds, rect, margin = 0) {
  return {
    bottom: Math.min(bounds.bottom, rect.bottom - margin),
    left: Math.max(bounds.left, rect.left + margin),
    right: Math.min(bounds.right, rect.right - margin),
    top: Math.max(bounds.top, rect.top + margin),
  };
}

function isComposedTargetHit(target, hitTarget) {
  if (!target || !hitTarget) return false;
  if (target === hitTarget || target.contains?.(hitTarget)) return true;
  let current = target;
  while (current) {
    if (current === hitTarget) return true;
    current = getParentElement(current);
  }
  return false;
}

function isTargetHitVisible(target, bounds) {
  const documentRef = target?.ownerDocument;
  if (typeof documentRef?.elementFromPoint !== "function") return true;
  const rect = target.getBoundingClientRect?.();
  if (!rect) return false;
  const visibleLeft = Math.max(rect.left, bounds.left);
  const visibleRight = Math.min(rect.right, bounds.right);
  const visibleTop = Math.max(rect.top, bounds.top);
  const visibleBottom = Math.min(rect.bottom, bounds.bottom);
  if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return false;
  const points = [
    [(visibleLeft + visibleRight) / 2, (visibleTop + visibleBottom) / 2],
    [visibleLeft + ((visibleRight - visibleLeft) * 0.25), visibleTop + ((visibleBottom - visibleTop) * 0.25)],
    [visibleLeft + ((visibleRight - visibleLeft) * 0.75), visibleTop + ((visibleBottom - visibleTop) * 0.75)],
  ];
  return points.some(([x, y]) => isComposedTargetHit(target, documentRef.elementFromPoint(x, y)));
}

function centerInScrollableAncestor(target, ancestor, behavior) {
  const targetRect = target.getBoundingClientRect?.();
  const ancestorRect = ancestor.getBoundingClientRect?.();
  if (!targetRect || !ancestorRect) return;
  const topOffset = targetRect.top - ancestorRect.top - ((ancestorRect.height - targetRect.height) / 2);
  const leftOffset = targetRect.left - ancestorRect.left - ((ancestorRect.width - targetRect.width) / 2);
  ancestor.scrollTo?.({
    behavior,
    left: Number(ancestor.scrollLeft || 0) + leftOffset,
    top: Number(ancestor.scrollTop || 0) + topOffset,
  });
}

function getViewportBounds(target, windowRef, margin = 8, headerSelector = ".site-header") {
  const visualViewport = windowRef?.visualViewport;
  const top = Number(visualViewport?.offsetTop || 0);
  const left = Number(visualViewport?.offsetLeft || 0);
  const height = Number(visualViewport?.height || windowRef?.innerHeight || 0);
  const width = Number(visualViewport?.width || windowRef?.innerWidth || 0);
  const isInOpenDialog = Boolean(findComposedAncestor(target, "dialog[open]"));
  const viewportMargin = isInOpenDialog ? 0 : margin;
  const header = headerSelector && !isInOpenDialog
    ? target?.ownerDocument?.querySelector?.(headerSelector)
    : null;
  const headerStyle = header ? windowRef?.getComputedStyle?.(header) : null;
  const headerRect = /^(fixed|sticky)$/.test(String(headerStyle?.position || ""))
    ? header?.getBoundingClientRect?.()
    : null;
  const protectedTop = headerRect && headerRect.bottom > top && headerRect.top <= top + viewportMargin
    ? headerRect.bottom
    : top;
  return {
    bottom: top + height - viewportMargin,
    left: left + viewportMargin,
    right: left + width - viewportMargin,
    top: protectedTop + viewportMargin,
  };
}

function getVisibleBounds(target, windowRef, margin = 8, headerSelector = ".site-header") {
  return getClippingAncestors(target, windowRef).reduce((currentBounds, ancestor) => {
    const ancestorRect = ancestor.getBoundingClientRect?.();
    return ancestorRect ? intersectBounds(currentBounds, ancestorRect) : currentBounds;
  }, getViewportBounds(target, windowRef, margin, headerSelector));
}

function getCandidateCapacity(candidate, windowRef, options = {}) {
  const geometryTarget = candidate?.highlightTarget || candidate?.target;
  const viewportBounds = getViewportBounds(
    geometryTarget,
    windowRef,
    Number(options.margin ?? 8),
    options.headerSelector,
  );
  let availableHeight = Math.max(0, viewportBounds.bottom - viewportBounds.top);
  let availableWidth = Math.max(0, viewportBounds.right - viewportBounds.left);
  for (const ancestor of getClippingAncestors(geometryTarget, windowRef)) {
    const rect = ancestor.getBoundingClientRect?.();
    if (!rect) continue;
    availableHeight = Math.min(availableHeight, Math.max(0, Number(rect.height || ancestor.clientHeight || 0)));
    availableWidth = Math.min(availableWidth, Math.max(0, Number(rect.width || ancestor.clientWidth || 0)));
  }
  return { availableHeight, availableWidth };
}

function getCandidateFit(candidate, windowRef, options = {}) {
  const geometryTarget = candidate?.highlightTarget || candidate?.target;
  const rect = geometryTarget?.getBoundingClientRect?.();
  if (!rect) return { area: Number.POSITIVE_INFINITY, fits: null, overflow: 0 };
  const { availableHeight, availableWidth } = getCandidateCapacity(candidate, windowRef, options);
  const height = Math.max(0, Number(rect.height || 0));
  const width = Math.max(0, Number(rect.width || 0));
  const heightOverflow = Math.max(0, Number(rect.height || 0) - availableHeight);
  const widthOverflow = Math.max(0, Number(rect.width || 0) - availableWidth);
  return {
    area: height * width,
    fits: height > 0 && width > 0
      && heightOverflow === 0 && widthOverflow === 0,
    overflow: (heightOverflow / Math.max(1, availableHeight))
      + (widthOverflow / Math.max(1, availableWidth)),
  };
}

const precisionPriority = Object.freeze({
  value: 0,
  control: 1,
  field: 2,
  text: 3,
  record: 4,
  section: 5,
  surface: 6,
});

function rankCandidate(candidate, fit) {
  return [
    fit.fits === true ? 0 : fit.fits == null ? 1 : 2,
    Number(precisionPriority[candidate.precision] ?? 7),
    fit.fits === false ? fit.overflow : 0,
    fit.area,
    candidate.candidateIndex,
  ];
}

function compareCandidateRanks(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function normalizeTargetCandidates(descriptor) {
  if (descriptor?.exact !== true) return [];
  const declared = Array.isArray(descriptor?.candidates) ? descriptor.candidates : [];
  const candidates = declared.length ? declared : [descriptor];
  return candidates
    .filter((candidate) => candidate?.target && isConnectedTarget(candidate.target))
    .filter((candidate) => candidate.exact !== false)
    .map((candidate, candidateIndex) => ({
      ...descriptor,
      ...candidate,
      candidateIndex,
      candidates: undefined,
      exact: true,
    }));
}

/**
 * Selects from host-declared semantic targets without inferring meaning from
 * the DOM. Precision and fit-after-scroll outrank declaration order so the
 * smallest useful reference is shown instead of a broad container.
 */
export function selectBestNavigationTarget(descriptor, options = {}) {
  if (descriptor?.exact !== true) return descriptor || null;
  const windowRef = options.windowRef || globalThis;
  const candidates = normalizeTargetCandidates(descriptor);
  if (!candidates.length) return null;
  const ranked = candidates
    .map((candidate) => {
      const fit = getCandidateFit(candidate, windowRef, options);
      return { candidate, fit, rank: rankCandidate(candidate, fit) };
    })
    .sort((left, right) => compareCandidateRanks(left.rank, right.rank));
  const selected = ranked[0];
  if (!selected) return null;
  const selectionReason = selected.fit.fits === true
    ? "most-precise-fitting-candidate"
    : selected.fit.fits == null
      ? "most-precise-unmeasured-candidate"
      : "most-precise-least-overflow-candidate";
  return { ...selected.candidate, selectionReason };
}

export function isVerifiedNavigationTargetVisible(options = {}) {
  const target = options.target;
  const windowRef = options.windowRef || globalThis;
  const rect = target?.getBoundingClientRect?.();
  if (!rect) return false;
  const margin = Number(options.margin ?? 8);
  const bounds = getVisibleBounds(target, windowRef, margin, options.headerSelector);
  const availableHeight = Math.max(0, bounds.bottom - bounds.top);
  const availableWidth = Math.max(0, bounds.right - bounds.left);
  const verticallyVisible = rect.height > availableHeight
    ? rect.top <= bounds.top && rect.bottom >= bounds.bottom
    : rect.top >= bounds.top && rect.bottom <= bounds.bottom;
  const horizontallyVisible = rect.width > availableWidth
    ? rect.left <= bounds.left && rect.right >= bounds.right
    : rect.left >= bounds.left && rect.right <= bounds.right;
  return verticallyVisible && horizontallyVisible
    && (options.verifyHitTarget === false || isTargetHitVisible(target, bounds));
}

function centerInViewport(target, windowRef, behavior, headerSelector) {
  const rect = target.getBoundingClientRect?.();
  if (!rect) return;
  const bounds = getViewportBounds(target, windowRef, 8, headerSelector);
  const availableHeight = Math.max(0, bounds.bottom - bounds.top);
  const desiredTop = rect.height > availableHeight
    ? bounds.top
    : bounds.top + ((availableHeight - rect.height) / 2);
  windowRef.scrollTo?.({
    top: Math.max(0, Number(windowRef.scrollY || 0) + rect.top - desiredTop),
    behavior,
  });
}

function openCollapsedAncestors(target) {
  let ancestor = getParentElement(target);
  while (ancestor) {
    if (ancestor.matches?.("details:not([open])")) ancestor.setAttribute?.("open", "");
    ancestor = getParentElement(ancestor);
  }
}

function getGeometryKey(target) {
  const rect = target?.getBoundingClientRect?.();
  return rect ? [rect.top, rect.right, rect.bottom, rect.left].map((value) => Math.round(value)).join(":") : "";
}

export function focusVerifiedNavigationTarget(options = {}) {
  const target = options.target;
  if (!target) return false;
  const windowRef = options.windowRef || globalThis;
  const setTimeoutRef = options.setTimeoutRef || windowRef.setTimeout?.bind(windowRef) || ((callback) => callback());
  const requestAnimationFrameRef = options.requestAnimationFrameRef
    || windowRef.requestAnimationFrame?.bind(windowRef) || ((callback) => callback());
  const highlightTarget = options.highlightTarget || target;
  const focusTarget = options.focusTarget
    || target.querySelector?.("button, input, select, textarea, summary, [tabindex]") || target;
  const behavior = windowRef.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
  let completed = false;
  let stableGeometry = "";
  let stablePasses = 0;
  const maxAttempts = Math.max(2, Number(options.maxAttempts || 8));

  function complete(visible, reason) {
    if (completed) return;
    completed = true;
    highlightTarget.setAttribute?.(options.stateAttribute || "data-verified-navigation-state", visible ? "visible" : "not-visible");
    if (visible) {
      if (!focusTarget.hasAttribute?.("tabindex") && focusTarget === target) focusTarget.setAttribute?.("tabindex", "-1");
      focusTarget.focus?.({ preventScroll: true });
    }
    options.onSettled?.({ focusTarget, highlightTarget, reason, target, visible });
    setTimeoutRef(() => {
      highlightTarget.classList?.remove?.(options.highlightClass || "is-navigation-focus");
      highlightTarget.removeAttribute?.(options.stateAttribute || "data-verified-navigation-state");
    }, options.highlightDurationMs || 2800);
  }

  openCollapsedAncestors(target);
  highlightTarget.classList?.add?.(options.highlightClass || "is-navigation-focus");
  highlightTarget.setAttribute?.(options.stateAttribute || "data-verified-navigation-state", "scrolling");
  requestAnimationFrameRef(() => requestAnimationFrameRef(() => {
    target.scrollIntoView?.({ behavior, block: "center", inline: "nearest" });
    getScrollableAncestors(target, windowRef).forEach((ancestor) => centerInScrollableAncestor(target, ancestor, behavior));
    const settle = (attempt = 0) => {
      if (target.isConnected === false || highlightTarget.isConnected === false) {
        complete(false, "target-replaced");
        return;
      }
      if (!isVerifiedNavigationTargetVisible({
        headerSelector: options.headerSelector,
        margin: options.margin,
        target,
        verifyHitTarget: options.verifyHitTarget,
        windowRef,
      })) {
        getScrollableAncestors(target, windowRef).forEach((ancestor) => (
          centerInScrollableAncestor(target, ancestor, attempt ? "auto" : behavior)
        ));
        centerInViewport(target, windowRef, attempt ? "auto" : behavior, options.headerSelector);
      }
      const visible = isVerifiedNavigationTargetVisible({
        headerSelector: options.headerSelector,
        margin: options.margin,
        target,
        verifyHitTarget: options.verifyHitTarget,
        windowRef,
      });
      const geometry = getGeometryKey(target);
      stablePasses = visible && geometry && geometry === stableGeometry ? stablePasses + 1 : 0;
      stableGeometry = geometry;
      highlightTarget.setAttribute?.(
        options.stateAttribute || "data-verified-navigation-state",
        visible ? "settling" : "adjusting",
      );
      if ((!visible || stablePasses < 1) && attempt < maxAttempts) {
        setTimeoutRef(() => settle(attempt + 1), 180);
        return;
      }
      complete(visible, visible ? "visible" : "outside-visible-region");
    };
    setTimeoutRef(() => settle(), 260);
  }));
  return true;
}

export const NAVIGATION_FAILURES = Object.freeze({
  adapterRequired: "adapter-required",
  inexactTarget: "inexact-target",
  stateNotVerified: "state-not-verified",
  targetNotFound: "target-not-found",
  timedOut: "timed-out",
});

function isAdapter(value) {
  return Boolean(value
    && typeof value.getIntent === "function"
    && typeof value.activate === "function"
    && typeof value.applyState === "function"
    && typeof value.isReady === "function"
    && typeof value.verifyState === "function"
    && typeof value.resolveTarget === "function");
}

function normalizeVerification(result) {
  if (result === true) return { reason: "verified", verified: true };
  if (result === false || result == null) {
    return { reason: NAVIGATION_FAILURES.stateNotVerified, verified: false };
  }
  return {
    reason: String(result.reason || (result.verified ? "verified" : NAVIGATION_FAILURES.stateNotVerified)),
    verified: result.verified === true,
  };
}

/**
 * Coordinates semantic navigation through a required host adapter. The engine
 * never searches the DOM for meaning and never guesses application state.
 */
export function createSiteNavigator(options = {}) {
  const windowRef = options.windowRef || globalThis;
  const documentRef = options.documentRef || windowRef.document;
  const adapter = options.adapter;
  const setTimeoutRef = options.setTimeoutRef || windowRef.setTimeout?.bind(windowRef);
  const clearTimeoutRef = options.clearTimeoutRef || windowRef.clearTimeout?.bind(windowRef);
  const MutationObserverRef = options.MutationObserverRef || windowRef.MutationObserver;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 20_000));
  let timeout = 0;
  let deadlineTimeout = 0;
  let observer = null;
  let stopped = false;
  let settled = false;
  let focused = false;
  let focusInProgress = false;
  let startedAt = 0;
  let lastFailure = "";
  let intent = null;
  let attemptNumber = 0;

  function report(state, descriptor = null) {
    options.report?.(state, descriptor);
  }

  function clearScheduledAttempt() {
    if (timeout) clearTimeoutRef?.(timeout);
    if (deadlineTimeout) clearTimeoutRef?.(deadlineTimeout);
    timeout = 0;
    deadlineTimeout = 0;
  }

  function cleanup() {
    stopped = true;
    clearScheduledAttempt();
    observer?.disconnect?.();
    observer = null;
  }

  function finish(state, descriptor = null) {
    if (settled) return;
    settled = true;
    report(state, descriptor);
    options.onSettled?.({ descriptor, reason: descriptor?.reason || state, state });
    cleanup();
  }

  function stop(reason = "cancelled") {
    if (settled || stopped) return;
    finish(reason, { reason });
  }

  function scheduleAttempt(delay = 80) {
    if (stopped || settled || focused || timeout) return;
    timeout = setTimeoutRef?.(() => {
      timeout = 0;
      attempt();
    }, delay) || 0;
  }

  function retry(state, descriptor = null, reason = state) {
    if (settled || stopped) return;
    focusInProgress = false;
    lastFailure = reason;
    report(state, descriptor);
    if (Date.now() - startedAt >= timeoutMs) {
      finish(NAVIGATION_FAILURES.timedOut, { reason: lastFailure || NAVIGATION_FAILURES.targetNotFound });
      return;
    }
    scheduleAttempt(state === "retrying" ? 80 : 100);
  }

  async function attempt() {
    if (stopped || settled || focused || focusInProgress) return;
    focusInProgress = true;
    attemptNumber += 1;
    const context = Object.freeze({
      attempt: attemptNumber,
      document: documentRef,
      intent,
      window: windowRef,
    });
    report("activating");
    try {
      await adapter.activate(context);
      if (settled || stopped) return;
      report("applying-state");
      await adapter.applyState(context);
      if (settled || stopped) return;
      const ready = await adapter.isReady(context);
      if (!ready) {
        retry("waiting", null, "not-ready");
        return;
      }
      const verification = normalizeVerification(await adapter.verifyState(context));
      if (!verification.verified) {
        retry("state-not-verified", null, verification.reason);
        return;
      }
    } catch (error) {
      retry("adapter-error", null, String(error?.code || error?.message || "adapter-error"));
      return;
    }

    if (settled || stopped) return;
    report("locating");
    let descriptor = null;
    try {
      descriptor = selectBestNavigationTarget(await adapter.resolveTarget(context), {
        ...options.focusOptions,
        windowRef,
      });
    } catch (error) {
      retry("adapter-error", null, String(error?.code || error?.message || "adapter-error"));
      return;
    }
    if (settled || stopped) return;
    if (descriptor?.target) {
      if (descriptor.exact !== true) {
        retry("inexact-target", descriptor, NAVIGATION_FAILURES.inexactTarget);
        return;
      }
      report("scrolling", descriptor);
      (options.focusTarget || focusVerifiedNavigationTarget)({
        ...options.focusOptions,
        focusTarget: descriptor.focusTarget,
        highlightTarget: descriptor.highlightTarget,
        target: descriptor.target,
        windowRef,
        onSettled: ({ reason, target, visible }) => {
          focusInProgress = false;
          if (visible && target?.isConnected !== false) {
            focused = true;
            finish("focused", descriptor);
            return;
          }
          retry("retrying", descriptor, reason || "not-visible");
        },
      });
    } else {
      retry("target-not-found", null, NAVIGATION_FAILURES.targetNotFound);
      return;
    }
  }

  function start() {
    if (!isAdapter(adapter)) {
      lastFailure = NAVIGATION_FAILURES.adapterRequired;
      report("failed", { reason: lastFailure });
      return false;
    }
    intent = adapter.getIntent();
    if (!intent) return false;
    startedAt = Date.now();
    report("waiting");
    deadlineTimeout = setTimeoutRef?.(() => {
      finish(NAVIGATION_FAILURES.timedOut, { reason: lastFailure || NAVIGATION_FAILURES.targetNotFound });
    }, timeoutMs) || 0;
    if (MutationObserverRef && documentRef.body) {
      observer = new MutationObserverRef(() => scheduleAttempt(0));
      observer.observe(documentRef.body, {
        attributes: true,
        attributeFilter: options.observedAttributes || ["aria-selected", "hidden", "open"],
        childList: true,
        subtree: true,
      });
    }
    void attempt();
    return true;
  }

  return { attempt, cancel: stop, start, stop };
}

export const createVerifiedNavigationController = createSiteNavigator;

export { runNavigationReveal } from "./navigation-reveal.js";
