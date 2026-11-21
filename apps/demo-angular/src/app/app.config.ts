import {
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { SplitContainerRegistry, provideSplitWindows } from '@split-window/angular';
import { SplitCssAnimationEngine } from '@split-window/css-animation';
import { SplitKeyframesAnimationEngine } from '@split-window/keyframes-animation';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideSplitWindows({
      // Animation engines by name; an animated container without `engine` uses the first.
      animationEngines: { css: SplitCssAnimationEngine, keyframes: SplitKeyframesAnimationEngine },
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
    provideAppInitializer(() => {
      // Minimal configuration: only body-right, no tab limit, as the default container.
      inject(SplitContainerRegistry).useBodyContainers();
    }),
  ],
};
