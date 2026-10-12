# Desktop Form Keyboard Standard

At desktop widths (768px and above), plain Enter advances to the next visible,
enabled field. Hidden, disabled, read-only, and explicitly ignored controls are
skipped. Shift+Enter preserves multiline entry; composition and modifier keys
are not intercepted. Mobile keeps its existing behavior.

When a form first becomes visible, focus its first editable field. This includes
new pages, dialogs, asynchronously loaded forms, and reactivated workspace tabs.
Do not refocus on ordinary rerenders, typing, or validation updates, and preserve
focus already established inside the form by its own workflow.

- Use `useFormEnterNavigation` on forms. `FormKeyboardNavigation` provides a
  fallback for other forms, including dialogs rendered in portals.
- Populated selects keep their value on Enter. Typing or using arrow keys allows
  choosing a different option. Close the popup before advancing focus.
- Use `advanceFocusOnSelect={false}` only when the parent owns the transition,
  such as an inline comment editor that mounts the next field.
- Recalculate the next field after rendering conditional controls, such as bank
  accounts, check numbers, custom references, or exchange rates.
- Preserve action-button behavior. Enter on a switch advances without toggling;
  Space remains the normal way to change it.
- Validation must focus the visible invalid control. Custom selects should expose
  `aria-invalid`; wizard forms must reveal the invalid field's step before focus.
- An empty pickup starts with a comment draft without stealing initial focus.
  Drafts are not saved until complete.

Run `npm run test:keyboard` for DOM navigation and real-component browser tests.
These cover shared selectors, customer pickers, address suggestions, pickup
comments, and daily-income statements and transactions with isolated test data.
Live authenticated save flows still require the integration-test environment.
