# ION BASTION – Source code

State: published version with the shared upgrade system, Aura tower, upgrade tooltips and the "Towers" heading.
Source commit: f6e0a90653ebcf5c6524ac956bbd375fc8f756cd

## Getting started

Requirements: Node.js 22 or newer and npm.
Unzip and run in a terminal:

```sh
cd ion-bastion
npm ci
npm run dev
```

Then open http://localhost:4173 in a browser.

Tests: `npm test`
Production build: `npm run build` (output in `dist/`)

Game overview: README.md. Architecture and extending: CLAUDE.md.

Included are source code, tests, assets, configuration and the package lockfile.
Dependencies are installed with npm ci. Git history, local dependencies
and the identity of the hosted site are not part of this portable export.
