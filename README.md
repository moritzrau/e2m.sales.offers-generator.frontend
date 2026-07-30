# e2m Sales Tool — Frontend

React/TypeScript-Frontend des e2m Sales Tool: Angebotswizard, Pricing-Cockpit,
Backtesting-Visualisierung.

Teil eines Zwei-Repo-Setups (Frontend + [Backend](../e2m.sales.offers-generator.backend)).
Übergreifender Kontext (Architektur, Status, TODOs, Kontext-Files) liegt im
lokalen Überordner `e2m.sales.offers-generator/` (nicht auf GitLab), siehe
dessen `CLAUDE.md`.

## Stack

React 18 · TypeScript · Vite · TanStack Query · ECharts · react-router

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Läuft auf Port 5173, proxied `/api` auf das lokal laufende Backend
(Port 8000, siehe Backend-Repo).

## Build & Checks

```bash
npm run typecheck
npm run build
```
