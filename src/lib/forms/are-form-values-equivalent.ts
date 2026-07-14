/**
 * Deep-equality check for edit-form values before issuing an update/PUT.
 *
 * Prefer comparing submitted values to `*ToFormValues(entity)` (or a feature
 * `comparable*` normalizer) so accidental whitespace / ordering differences can
 * be normalized in one place. Skip the mutation when this returns true.
 */
export function areFormValuesEquivalent<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
