import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaRoot = path.join(root, "spec/0.2/schemas");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: false });
  for (const name of ["query", "navigation", "action"]) {
    ajv.addSchema(readJson(path.join(schemaRoot, `${name}.schema.json`)));
  }
  return ajv.compile(readJson(path.join(schemaRoot, "manifest.schema.json")));
}

test("the normative JSON Schema accepts the complete example", () => {
  const validate = validator();
  const example = readJson(path.join(root, "examples/basic/site-agent.json"));
  assert.equal(validate(example), true, JSON.stringify(validate.errors));
});

test("the normative JSON Schema rejects an unversioned broad destination", () => {
  const validate = validator();
  const example = readJson(path.join(root, "examples/basic/site-agent.json"));
  delete example.standardVersion;
  example.navigationDestinations[0].exact = false;
  assert.equal(validate(example), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => instancePath === "" && keyword === "required"));
  assert.ok(validate.errors.some(({ instancePath }) => instancePath.endsWith("/exact")));
});

test("the normative JSON Schema requires explicit safe target-selection behavior", () => {
  const validate = validator();
  const example = readJson(path.join(root, "examples/basic/site-agent.json"));
  example.navigationDestinations[0].targetSelection.inferredDomFallback = true;
  assert.equal(validate(example), false);
  assert.ok(validate.errors.some(({ instancePath }) => instancePath.endsWith("/inferredDomFallback")));
});

test("the normative JSON Schema requires rendered quality and complete multi-actor declarations", () => {
  const validate = validator();
  const example = readJson(path.join(root, "examples/basic/site-agent.json"));
  delete example.presentation.supportedThemes;
  assert.equal(validate(example), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => (
    instancePath === "/presentation" && keyword === "required"
  )));

  const incompleteActors = readJson(path.join(root, "examples/basic/site-agent.json"));
  delete incompleteActors.workflows[0].contexts;
  assert.equal(validate(incompleteActors), false);
  assert.ok(validate.errors.some(({ instancePath, keyword }) => (
    instancePath.endsWith("/workflows/0") && keyword === "required"
  )));
});
