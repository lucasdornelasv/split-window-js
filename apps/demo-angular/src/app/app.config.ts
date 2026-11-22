import { provideBrowserGlobalErrorListeners, type ApplicationConfig } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideSplitWindows } from '@split-window/angular';
import { CssSplitAnimationEngine } from '@split-window/css-animation';
import { KeyframesSplitAnimationEngine } from '@split-window/keyframes-animation';
import { routes } from './app.routes';
import { POP_CSS_PRESET, POP_KEYFRAMES_PRESET } from './shared/pop-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideSplitWindows({
      // Minimal configuration: only body-right, no tab limit, as the default container.
      bodyContainers: true,
      // Animation engines by name; an animated container without `engine` uses the first.
      // Both get a preset of their own, "pop", picked like the built-in ones.
      animationEngines: {
        css: new CssSplitAnimationEngine().addPreset('pop', POP_CSS_PRESET),
        keyframes: new KeyframesSplitAnimationEngine().addPreset('pop', POP_KEYFRAMES_PRESET),
      },
      // A global mode, used by the "Modos e animação" page as mode: 'drawer'.
      modes: {
        drawer: {
          extends: 'overlay',
          size: '300px',
          panelClass: 'demo-drawer',
          animation: { preset: 'slide', duration: 260 },
        },
      },
    }),
  ],
};
