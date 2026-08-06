const defaultTextContrast = 4.5;
const largeTextContrast = 3;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseRgb(value) {
  const match = String(value || "").match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
  if (!match) return null;
  const alpha = match[4]?.endsWith("%")
    ? Number.parseFloat(match[4]) / 100
    : Number.parseFloat(match[4] ?? "1");
  return {
    r: clamp(Number.parseFloat(match[1]), 0, 255),
    g: clamp(Number.parseFloat(match[2]), 0, 255),
    b: clamp(Number.parseFloat(match[3]), 0, 255),
    a: clamp(alpha),
  };
}

function composite(foreground, background) {
  const alpha = foreground.a + (background.a * (1 - foreground.a));
  if (!alpha) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: ((foreground.r * foreground.a) + (background.r * background.a * (1 - foreground.a))) / alpha,
    g: ((foreground.g * foreground.a) + (background.g * background.a * (1 - foreground.a))) / alpha,
    b: ((foreground.b * foreground.a) + (background.b * background.a * (1 - foreground.a))) / alpha,
    a: alpha,
  };
}

function channelLuminance(channel) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color) {
  return (0.2126 * channelLuminance(color.r))
    + (0.7152 * channelLuminance(color.g))
    + (0.0722 * channelLuminance(color.b));
}

export function getContrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function effectiveOpacity(element, windowRef) {
  let opacity = 1;
  for (let current = element; current; current = current.parentElement) {
    const style = windowRef.getComputedStyle(current);
    if (style.display === "none" || style.visibility !== "visible") return 0;
    opacity *= clamp(Number.parseFloat(style.opacity || "1"));
  }
  return opacity;
}

function effectiveBackground(element, windowRef) {
  const layers = [];
  for (let current = element; current; current = current.parentElement) {
    const color = parseRgb(windowRef.getComputedStyle(current).backgroundColor);
    if (color?.a) layers.push(color);
  }
  let result = { r: 255, g: 255, b: 255, a: 1 };
  for (const layer of layers.reverse()) result = composite(layer, result);
  return result;
}

function intersectsViewport(rect, windowRef) {
  return rect.width > 0
    && rect.height > 0
    && rect.right > 0
    && rect.bottom > 0
    && rect.left < windowRef.innerWidth
    && rect.top < windowRef.innerHeight;
}

function textValue(element) {
  if (element instanceof element.ownerDocument.defaultView.HTMLInputElement) {
    return normalizeText(element.value);
  }
  if (element instanceof element.ownerDocument.defaultView.HTMLTextAreaElement) {
    return normalizeText(element.value);
  }
  if (element instanceof element.ownerDocument.defaultView.HTMLSelectElement) {
    return normalizeText(element.selectedOptions?.[0]?.textContent);
  }
  return normalizeText(element.innerText || element.textContent);
}

function isLargeText(style) {
  const size = Number.parseFloat(style.fontSize || "0");
  const weight = Number.parseInt(style.fontWeight || "400", 10);
  return size >= 24 || (size >= 18.66 && weight >= 700);
}

function renderedTextSegments(element, windowRef) {
  const documentRef = element.ownerDocument;
  const walker = documentRef.createTreeWalker(element, windowRef.NodeFilter.SHOW_TEXT);
  const segments = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = normalizeText(node.nodeValue);
    const parent = node.parentElement;
    if (!text || !parent) continue;
    const range = documentRef.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()];
    if (!rects.some((rect) => intersectsViewport(rect, windowRef))) continue;
    const style = windowRef.getComputedStyle(parent);
    const opacity = effectiveOpacity(parent, windowRef);
    const fill = parseRgb(style.webkitTextFillColor) || parseRgb(style.color);
    if (!fill || fill.a * opacity < 0.05 || Number.parseFloat(style.fontSize || "0") <= 0) continue;
    const background = effectiveBackground(parent, windowRef);
    const foreground = composite({ ...fill, a: fill.a * opacity }, background);
    segments.push({
      contrastRatio: getContrastRatio(foreground, background),
      requiredContrastRatio: isLargeText(style) ? largeTextContrast : defaultTextContrast,
      text,
    });
  }

  if (!segments.length && textValue(element)) {
    const style = windowRef.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const opacity = effectiveOpacity(element, windowRef);
    const fill = parseRgb(style.webkitTextFillColor) || parseRgb(style.color);
    if (intersectsViewport(rect, windowRef) && fill && fill.a * opacity >= 0.05) {
      const background = effectiveBackground(element, windowRef);
      const foreground = composite({ ...fill, a: fill.a * opacity }, background);
      segments.push({
        contrastRatio: getContrastRatio(foreground, background),
        requiredContrastRatio: isLargeText(style) ? largeTextContrast : defaultTextContrast,
        text: textValue(element),
      });
    }
  }
  return segments;
}

export function auditRenderedLabel(element, options = {}) {
  if (!element?.ownerDocument?.defaultView) throw new TypeError("rendered-quality-element-required");
  const windowRef = options.window || element.ownerDocument.defaultView;
  const expectedLabel = normalizeText(options.expectedLabel);
  const actualLabel = textValue(element);
  const segments = renderedTextSegments(element, windowRef);
  const minimumContrastRatio = segments.length
    ? Math.min(...segments.map(({ contrastRatio }) => contrastRatio))
    : 0;
  const requiredContrastRatio = segments.length
    ? Math.max(...segments.map((segment) => segment.requiredContrastRatio))
    : defaultTextContrast;
  const violations = [];
  if (!actualLabel || !segments.length) violations.push("visible-label-missing");
  if (expectedLabel && !actualLabel.toLowerCase().includes(expectedLabel.toLowerCase())) {
    violations.push("visible-label-mismatch");
  }
  if (segments.some((segment) => segment.contrastRatio + 0.01 < segment.requiredContrastRatio)) {
    violations.push("text-contrast-insufficient");
  }
  return Object.freeze({
    reference: String(options.reference || "mapped-control"),
    actualLabel,
    expectedLabel,
    visible: Boolean(actualLabel && segments.length),
    minimumContrastRatio,
    requiredContrastRatio,
    textSegmentsChecked: segments.length,
    violations: Object.freeze([...new Set(violations)]),
  });
}

export function auditRenderedState(options = {}) {
  const controls = Array.from(options.controls || []);
  const results = controls.map((control) => auditRenderedLabel(control.element || control, {
    expectedLabel: control.expectedLabel,
    reference: control.reference,
    window: options.window,
  }));
  return Object.freeze({
    mappedStateId: String(options.mappedStateId || ""),
    viewport: String(options.viewport || ""),
    theme: String(options.theme || ""),
    source: "browser-computed-style",
    computedStyles: true,
    labelsChecked: results.length,
    textContrastChecks: results.reduce((total, result) => total + result.textSegmentsChecked, 0),
    violations: Object.freeze(results.flatMap((result) => (
      result.violations.map((code) => ({ code, reference: result.reference }))
    ))),
    results: Object.freeze(results),
  });
}

export function getRenderedQualityMatrix(manifest = {}) {
  const mappedStateIds = (manifest.workflows || []).flatMap((workflow) => (
    (workflow.steps || []).map((step) => `${workflow.id}:${step.id}`)
  ));
  const stateIds = mappedStateIds.length
    ? mappedStateIds
    : (manifest.navigationDestinations || []).map(({ id }) => id);
  const viewports = manifest.presentation?.responsiveVariants || [];
  const themes = manifest.presentation?.supportedThemes || [];
  return Object.freeze(stateIds.flatMap((mappedStateId) => (
    viewports.flatMap((viewport) => themes.map((theme) => Object.freeze({ mappedStateId, viewport, theme })))
  )));
}

export function validateRenderedQualityEvidence(manifest, evidence = {}) {
  const errors = [];
  const expected = getRenderedQualityMatrix(manifest);
  const observations = Array.isArray(evidence.observations) ? evidence.observations : [];
  const key = ({ mappedStateId, viewport, theme }) => `${mappedStateId}\0${viewport}\0${theme}`;
  const observed = new Map(observations.map((observation) => [key(observation), observation]));
  if (evidence.source !== "browser-computed-style") errors.push("rendered-quality-source-must-be-browser-computed-style");
  for (const item of expected) {
    const observation = observed.get(key(item));
    if (!observation) {
      errors.push(`rendered-quality-state-missing:${item.mappedStateId}:${item.viewport}:${item.theme}`);
      continue;
    }
    if (observation.computedStyles !== true) errors.push(`computed-style-proof-missing:${key(item)}`);
    if (Number(observation.labelsChecked) < 1) errors.push(`visible-label-proof-missing:${key(item)}`);
    if (Number(observation.textContrastChecks) < 1) errors.push(`contrast-proof-missing:${key(item)}`);
    if (Array.isArray(observation.violations) && observation.violations.length) {
      errors.push(`rendered-quality-violation:${key(item)}`);
    }
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
