import Ajv2020 from "ajv/dist/2020.js";

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false,
});
const validators = new WeakMap();

function schemaValidator(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new TypeError("schema-must-be-an-object");
  }
  if (!validators.has(schema)) validators.set(schema, ajv.compile(schema));
  return validators.get(schema);
}
export function validateSchemaDefinition(schema) {
  try {
    schemaValidator(schema);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [String(error?.message || error)] };
  }
}

export function assertSchemaValue(schema, value, label = "value") {
  const validate = schemaValidator(schema);
  if (validate(value)) return value;
  const detail = (validate.errors || [])
    .slice(0, 5)
    .map(({ instancePath, message }) => `${instancePath || "/"} ${message}`)
    .join("; ");
  throw new TypeError(`${label}-schema-invalid${detail ? `: ${detail}` : ""}`);
}
