import { provideZoneChangeDetection } from '@angular/core';

/** Test environment with zone.js, used by `ng test angular -c zone`. */
export default [provideZoneChangeDetection()];
