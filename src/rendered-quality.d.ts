export interface RenderedLabelAudit {
  reference: string;
  actualLabel: string;
  expectedLabel: string;
  visible: boolean;
  minimumContrastRatio: number;
  requiredContrastRatio: number;
  textSegmentsChecked: number;
  violations: readonly string[];
}

export interface RenderedQualityObservation {
  mappedStateId: string;
  viewport: string;
  theme: string;
  source: "browser-computed-style";
  computedStyles: true;
  labelsChecked: number;
  textContrastChecks: number;
  violations: readonly { code: string; reference: string }[];
  results?: readonly RenderedLabelAudit[];
}

export declare function getContrastRatio(
  foreground: { r: number; g: number; b: number },
  background: { r: number; g: number; b: number },
): number;
export declare function auditRenderedLabel(element: Element, options?: Record<string, unknown>): RenderedLabelAudit;
export declare function auditRenderedState(options?: Record<string, unknown>): RenderedQualityObservation;
export declare function getRenderedQualityMatrix(manifest: Record<string, unknown>): readonly {
  mappedStateId: string;
  viewport: string;
  theme: string;
}[];
export declare function validateRenderedQualityEvidence(
  manifest: Record<string, unknown>,
  evidence: Record<string, unknown>,
): { valid: boolean; errors: readonly string[] };
