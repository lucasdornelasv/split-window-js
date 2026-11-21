import type { Routes } from '@angular/router';

export const DEMO_PAGES = [
  { path: 'inicio', title: 'Início rápido', load: () => import('./pages/quick-start.page') },
  { path: 'containers', title: 'Containers', load: () => import('./pages/containers.page') },
  { path: 'body', title: 'Containers do body', load: () => import('./pages/body.page') },
  { path: 'modos', title: 'Modos e animação', load: () => import('./pages/modes.page') },
  { path: 'abas', title: 'Abas e numeração', load: () => import('./pages/tabs.page') },
  { path: 'limite', title: 'Limite de abas', load: () => import('./pages/limits.page') },
  { path: 'fechamento', title: 'Fechamento', load: () => import('./pages/closing.page') },
  { path: 'arraste', title: 'Drag and drop', load: () => import('./pages/drag.page') },
  { path: 'tela-cheia', title: 'Tela cheia', load: () => import('./pages/fullscreen.page') },
  { path: 'eventos', title: 'Eventos', load: () => import('./pages/events.page') },
  { path: 'erros', title: 'Erros', load: () => import('./pages/errors.page') },
  { path: 'playground', title: 'Playground', load: () => import('./pages/playground.page') },
] as const;

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  ...DEMO_PAGES.map((page) => ({
    path: page.path,
    title: `${page.title} — SplitWindow`,
    loadComponent: () => page.load().then((m) => m.default),
  })),
  { path: '**', redirectTo: 'inicio' },
];
