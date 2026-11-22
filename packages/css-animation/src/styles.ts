/**
 * Styles of the presets, injected once per document by `SplitCssAnimationEngine` (as the
 * first stylesheet of `<head>`, so the app CSS wins). Every value is a custom property.
 *
 * The engine sets `data-split-animation="<preset>"` and `--split-slide` (the transform that
 * moves the panel out toward its side) on the shell during a transition. Shows use
 * `--split-animation-easing` (decelerating) and hides `--split-animation-easing-hide`
 * (accelerating); the `easing` option sets both.
 */
export const SPLIT_CSS_ANIMATION_STYLES = `
:where(:root) {
  --split-animation-duration: 200ms;
  --split-animation-easing: cubic-bezier(0.2, 0, 0, 1);
  --split-animation-easing-hide: cubic-bezier(0.4, 0, 1, 1);
  --split-animation-delay: 0ms;
}
[data-split-animation='slide'] { --split-animation-property: transform; }
[data-split-animation='fade'] { --split-animation-property: opacity; }
:is([data-split-animation='slide'], [data-split-animation='fade']).split-showing {
  transition: var(--split-animation-property) var(--split-animation-duration)
    var(--split-animation-easing) var(--split-animation-delay);
}
:is([data-split-animation='slide'], [data-split-animation='fade']).split-hiding {
  transition: var(--split-animation-property) var(--split-animation-duration)
    var(--split-animation-easing-hide) var(--split-animation-delay);
}
[data-split-animation='slide']:is(.split-enter-from, .split-hiding) { transform: var(--split-slide); }
[data-split-animation='fade']:is(.split-enter-from, .split-hiding) { opacity: 0; }
`;

/** `id` of the injected `<style>`. */
export const SPLIT_CSS_ANIMATION_STYLE_ID = 'split-css-animation-styles';
