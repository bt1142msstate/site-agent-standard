function getParentElement(target) {
  return target?.parentElement || target?.getRootNode?.()?.host || null;
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

export function isVerifiedNavigationTargetVisible(options = {}) {
  const target = options.target;
  const windowRef = options.windowRef || globalThis;
  const rect = target?.getBoundingClientRect?.();
  if (!rect) return false;
  const margin = Number(options.margin ?? 8);
  const bounds = getClippingAncestors(target, windowRef).reduce((currentBounds, ancestor) => {
    const ancestorRect = ancestor.getBoundingClientRect?.();
    return ancestorRect ? intersectBounds(currentBounds, ancestorRect) : currentBounds;
  }, getViewportBounds(target, windowRef, margin, options.headerSelector));
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

export function createVerifiedNavigationController(options = {}) {
  const windowRef = options.windowRef || globalThis;
  const documentRef = options.documentRef || windowRef.document;
  const setTimeoutRef = options.setTimeoutRef || windowRef.setTimeout?.bind(windowRef);
  const clearTimeoutRef = options.clearTimeoutRef || windowRef.clearTimeout?.bind(windowRef);
  const MutationObserverRef = options.MutationObserverRef || windowRef.MutationObserver;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 20_000));
  let timeout = 0;
  let observer = null;
  let stopped = false;
  let focused = false;
  let focusInProgress = false;
  let startedAt = 0;
  let lastFailure = "";

  function report(state, descriptor = null) {
    options.report?.(state, descriptor);
  }

  function clearScheduledAttempt() {
    if (timeout) clearTimeoutRef?.(timeout);
    timeout = 0;
  }

  function stop() {
    stopped = true;
    clearScheduledAttempt();
    observer?.disconnect?.();
    observer = null;
  }

  function scheduleAttempt(delay = 80) {
    if (stopped || focused || timeout) return;
    timeout = setTimeoutRef?.(() => {
      timeout = 0;
      attempt();
    }, delay) || 0;
  }

  function attempt() {
    if (stopped || focused || focusInProgress) return;
    options.activate?.();
    const descriptor = options.resolve?.();
    if (descriptor?.target) {
      focusInProgress = true;
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
            report("focused", descriptor);
            stop();
            return;
          }
          lastFailure = reason || "not-visible";
          report("retrying", descriptor);
          scheduleAttempt(80);
        },
      });
    }
    if (focused || stopped) return;
    if (Date.now() - startedAt >= timeoutMs) {
      report(lastFailure === "outside-visible-region" ? "not-visible" : "not-found");
      stop();
      return;
    }
    scheduleAttempt(100);
  }

  function start() {
    if (options.hasIntent && !options.hasIntent()) return false;
    startedAt = Date.now();
    report("waiting");
    if (MutationObserverRef && documentRef.body) {
      observer = new MutationObserverRef(() => scheduleAttempt(0));
      observer.observe(documentRef.body, {
        attributes: true,
        attributeFilter: options.observedAttributes || ["aria-selected", "hidden", "open"],
        childList: true,
        subtree: true,
      });
    }
    attempt();
    return true;
  }

  return { attempt, start, stop };
}
