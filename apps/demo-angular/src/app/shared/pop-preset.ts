import type { CssSplitAnimationPreset } from '@split-window/css-animation';
import type { KeyframesSplitAnimationPreset } from '@split-window/keyframes-animation';

/*
 * The "pop" preset of the demo, added to both engines in app.config.ts: the panel grows
 * from a little smaller while it fades in, and goes back the same way.
 */

/** For the CSS engine: the look is CSS, keyed by data-split-animation="pop". */
export const POP_CSS_PRESET: CssSplitAnimationPreset = {
  variables: { '--pop-scale': '0.92' },
  styles: `
[data-split-animation='pop']:is(.split-showing, .split-hiding) {
  transition-property: opacity, transform;
  transition-duration: var(--split-animation-duration);
  transition-timing-function: var(--split-animation-easing);
  transition-delay: var(--split-animation-delay);
}
[data-split-animation='pop'].split-hiding {
  transition-timing-function: var(--split-animation-easing-hide);
}
[data-split-animation='pop']:is(.split-enter-from, .split-hiding) {
  opacity: 0;
  transform: scale(var(--pop-scale));
}`,
};

/** For the keyframes engine: the same look as keyframes (the hide plays them backwards). */
export const POP_KEYFRAMES_PRESET: KeyframesSplitAnimationPreset = {
  show: [
    { opacity: 0, transform: 'scale(0.92)' },
    { opacity: 1, transform: 'none' },
  ],
};
