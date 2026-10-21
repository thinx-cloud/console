// The one unsaved-changes confirm (Phase 46 D-10, UI-SPEC UI-T17), used by the route-leave
// guards of Device Detail (Transformer Assignment card) and TransformerEditor.
//
// Keep editing is focused, so Enter never discards changes. The promise resolves true only for
// an explicit OK; dismiss, Esc, the backdrop and a dialog that throws or rejects all resolve
// false, so the caller stays on the page.

const MESSAGE = 'You have unsaved changes. Leave anyway?';

export function confirmLeave(vm) {
  return Promise.resolve()
    .then(() => vm.$bvModal.msgBoxConfirm(MESSAGE, {
      title: 'Unsaved Changes',
      okVariant: 'warning',
      okTitle: 'Leave without saving',
      cancelTitle: 'Keep editing',
      autoFocusButton: 'cancel',
    }))
    .then((answer) => answer === true, () => false);
}
