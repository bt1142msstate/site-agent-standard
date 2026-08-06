export declare const SITE_AGENT_FINGERPRINT_NORMALIZATION: "stable-content-v1";
export declare function canonicalizeFingerprintValue(value: unknown, options?: { volatileKeys?: readonly string[] }): unknown;
export declare function stableFingerprintPayload(
  entries: readonly { path: string; value: unknown }[],
  options?: { volatileKeys?: readonly string[] },
): string;
export declare function validateTutorialArtifactAcceptanceEvidence(evidence?: Record<string, unknown>): {
  valid: boolean;
  errors: readonly string[];
};
