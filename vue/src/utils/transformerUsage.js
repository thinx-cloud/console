// Transformer usage for the typed-confirm delete dialog (Phase 46 D-06, UI-SPEC UI-T09).
// Plain functions, no Vue: the Transformers page counts the devices that apply any of the
// transformers about to be deleted and words the warning for one or several of them.

// Number of distinct devices whose `transformers` array holds at least one of `utids`.
// A device without an array counts as using none; a device listed twice counts once.
export function countDevicesUsing(devices, utids) {
  const targets = Array.isArray(utids) ? utids : [];
  if (!Array.isArray(devices) || !targets.length) return 0;
  const seen = new Set();
  let count = 0;
  devices.forEach((device, index) => {
    if (!device || !Array.isArray(device.transformers)) return;
    if (!device.transformers.some(utid => targets.includes(utid))) return;
    const id = device.udid || device.id || 'index:' + index;
    if (seen.has(id)) return;
    seen.add(id);
    count++;
  });
  return count;
}

// The warning sentence: a known count (0, 1 or N) or, for null, the generic sentence used
// when the device list could not be loaded. `many` picks "them" over "it".
export function usageSentence(count, many) {
  const pronoun = many ? 'them' : 'it';
  if (typeof count !== 'number' || !isFinite(count) || count < 0) {
    return many
      ? 'Devices using these transformers will stop applying them.'
      : 'Devices using this transformer will stop applying it.';
  }
  if (count === 0) return 'No device uses ' + pronoun + '.';
  if (count === 1) return '1 device will stop applying ' + pronoun + '.';
  return count + ' devices will stop applying ' + pronoun + '.';
}
