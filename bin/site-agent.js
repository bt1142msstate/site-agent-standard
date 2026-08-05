#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  getSiteAgentConformance,
  validateSiteAgentManifest,
} from "../src/manifest.js";
import { runSiteAgentConformance } from "../src/conformance.js";

function usage() {
  console.log("Usage: site-agent <validate|test> <manifest.json> [--adapter ./conformance.mjs] [--json]");
}

function readManifest(fileName) {
  const absolute = path.resolve(process.cwd(), fileName || "");
  return { absolute, manifest: JSON.parse(fs.readFileSync(absolute, "utf8")) };
}

function optionValue(values, name) {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1] : "";
}

async function main() {
  const [command, fileName, ...rest] = process.argv.slice(2);
  if (!new Set(["validate", "test"]).has(command) || !fileName) {
    usage();
    process.exitCode = 2;
    return;
  }
  let loaded;
  try {
    loaded = readManifest(fileName);
  } catch (error) {
    console.error(`Unable to read manifest: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  let result;
  if (command === "test") {
    const adapterPath = optionValue(rest, "--adapter");
    if (adapterPath) {
      const module = await import(pathToFileURL(path.resolve(process.cwd(), adapterPath)).href);
      const target = typeof module.default === "function" ? await module.default(loaded.manifest) : module.default;
      result = await runSiteAgentConformance({ manifest: loaded.manifest, ...target });
    } else {
      result = getSiteAgentConformance(loaded.manifest);
      result.errors = [...result.errors, "Executable conformance was not run. Provide --adapter."];
    }
  } else {
    result = validateSiteAgentManifest(loaded.manifest);
  }
  if (rest.includes("--json")) console.log(JSON.stringify({ file: loaded.absolute, ...result }, null, 2));
  else if (result.valid && (command !== "test" || result.fullyConformant)) {
    const suffix = command === "test"
      ? `; profiles ${Object.entries(result.profiles).filter(([, enabled]) => enabled).map(([profile]) => profile).join(", ")}; executable proofs ${result.proofs?.length || 0}; fully conformant yes`
      : "";
    console.log(`Site Agent manifest is valid${suffix}.`);
  } else {
    console.error(`Site Agent manifest failed (${result.errors.length}):`);
    (result.errors || []).forEach((error) => console.error(`- ${error}`));
    (result.proofs || []).filter(({ status }) => status === "failed")
      .forEach(({ id, failureCode }) => console.error(`- ${id}: ${failureCode}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
