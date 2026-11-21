import {
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  type ApplicationConfig,
} from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { SplitContainerRegistry, provideSplitWindows } from '@split-window/angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideSplitWindows(),
    provideAppInitializer(() => {
      // Minimal configuration: only body-right, no tab limit, as the default container.
      inject(SplitContainerRegistry).useBodyContainers();
    }),
  ],
};
