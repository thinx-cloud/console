/**
 * Bootstrap-style breakpoint boundaries in pixels.
 * Keys follow the pattern `{size}-min` and `{size}-max`.
 * `xs` has no min; `xl` has no max.
 * @type {Record<string, number>}
 */
const screens = {
  'xs-max': 543,
  'sm-min': 544,
  'sm-max': 767,
  'md-min': 768,
  'md-max': 991,
  'lg-min': 992,
  'lg-max': 1199,
  'xl-min': 1200,
};

/**
 * Returns whether the current viewport matches the named breakpoint.
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} size - Breakpoint name.
 * @returns {boolean} `true` when `window.innerWidth` falls within the breakpoint range.
 */
export default function isScreen(size) {
  const screenPx = window.innerWidth;
  return (screenPx >= screens[`${size}-min`] || size === 'xs')
    && (screenPx <= screens[`${size}-max`] || size === 'xl');
}
