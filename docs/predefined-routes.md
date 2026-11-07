# Predefined routes — remaining migration decision

- Determine whether any tenant has meaningful records in `legacy_routes` that
  require migration to `predefined_routes`; do not treat sample browser rows as
  production data.
- If migration is required, define a reviewed mapping, preserve tenant scope and
  intended coverage, and verify affected appointment filtering before retiring
  the old records. Do not copy or delete legacy data automatically.

Current endpoint and payload definitions are in [api-docs.json](../api-docs.json).
