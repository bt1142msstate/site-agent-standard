#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  getSiteAgentConformance,
  validateSiteAgentManifest,
} from "../src/manifest.js";

function usage() {
  console.log("Usage: site-agent <validate|test> <manifest.json> [--json]");
}

function readManifest(fileName) {
  const absolute = path.resolve(process.cwd(), fileName || "");
  return { absolute, manifest: JSON.parse(fs.readFileSync(absolute, "utf8")) };
}

function main() {
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
  const result = command === "test"
    ? getSiteAgentConformance(loaded.manifest)
    : validateSiteAgentManifest(loaded.manifest);
  if (rest.includes("--json")) console.log(JSON.stringify({ file: loaded.absolute, ...result }, null, 2));
  else if (result.valid) {
    const suffix = command === "test"
      ? `; profiles ${Object.entries(result.profiles).filter(([, enabled]) => enabled).map(([profile]) => profile).join(", ")}; fully conformant ${result.fullyConformant ? "yes" : "no"}`
      : "";
    console.log(`Site Agent manifest is valid${suffix}.`);
  } else {
    console.error(`Site Agent manifest failed (${result.errors.length}):`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  }
}

main();
