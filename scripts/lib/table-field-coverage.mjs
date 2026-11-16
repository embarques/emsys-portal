/** Compare exact schema fields, retaining only explicitly documented compatibility exceptions. */
export function compareTableFieldCoverage(schema, fields, compatibilityFields = {}) {
  if (!schema?.properties) throw new Error("Expected a response schema with properties");
  const expected = Object.keys(schema.properties);
  const duplicates = fields.filter((field, index) => fields.indexOf(field) !== index);
  const isCompatibilityField = field => Object.hasOwn(compatibilityFields, field) &&
    typeof compatibilityFields[field] === "string" && compatibilityFields[field].trim().length > 0;
  return {
    missing: expected.filter(field => !fields.includes(field)),
    extra: fields.filter(field => !expected.includes(field) && !isCompatibilityField(field)),
    duplicates: [...new Set(duplicates)],
  };
}
