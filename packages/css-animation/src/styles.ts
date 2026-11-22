import { SPLIT_DEFAULT_EASING, SPLIT_DEFAULT_HIDE_EASING, easingToCss } from '@split-window/core';

/**
 * Styles of the presets, injected once per document by `CssSplitAnimationEngine` (as the
 * first stylesheet of `<head>`, so the app CSS wins). Every value is a custom property.
 *
 * During a transition the engine sets on the shell `data-split-animation="<preset>"` (the
 * preset of that phase), `--split-slide` (the transform of `slide` out of view, from
 * `origin` and `distance`), `--split-scale` and `--split-transform-origin` (`scale`). Shows
 * use `--split-animation-easing` (decelerating) and hides `--split-animation-easing-hide`
 * (accelerating); the `easing` option sets both.
 */
export const SPLIT_CSS_ANIMATION_STYLES = `
:where(:root) {
  --split-animation-duration: 200ms;
  --split-animation-easing: ${easingToCss(SPLIT_DEFAULT_EASING)};
  --split-animation-easing-hide: ${easingToCss(SPLIT_DEFAULT_HIDE_EASING)};
  --split-animation-delay: 0ms;
}
:is([data-split-animation='slide'], [data-split-animation='scale']) { --split-animation-property: transform; }
[data-split-animation='fade'] { --split-animation-property: opacity; }
[data-split-animation='scale'] { transform-origin: var(--split-transform-origin, center); }
:is([data-split-animation='slide'], [data-split-animation='fade'], [data-split-animation='scale']).split-showing {
  transition: var(--split-animation-property) var(--split-animation-duration)
    var(--split-animation-easing) var(--split-animation-delay);
}
:is([data-split-animation='slide'], [data-split-animation='fade'], [data-split-animation='scale']).split-hiding {
  transition: var(--split-animation-property) var(--split-animation-duration)
    var(--split-animation-easing-hide) var(--split-animation-delay);
}
[data-split-animation='slide']:is(.split-enter-from, .split-hiding) { transform: var(--split-slide); }
[data-split-animation='scale']:is(.split-enter-from, .split-hiding) { transform: scale(var(--split-scale)); }
[data-split-animation='fade']:is(.split-enter-from, .split-hiding) { opacity: 0; }
`;

/** `id` of the injected `<style>`. */
export const SPLIT_CSS_ANIMATION_STYLE_ID = 'split-css-animation-styles';
