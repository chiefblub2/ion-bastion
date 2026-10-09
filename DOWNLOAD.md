# ION BASTION – Quellcode

Stand: veröffentlichte Version mit gemeinsamem Upgrade-System, Aura-Turm, Upgrade-Tooltips und der Überschrift „Türme“.
Quellcode-Commit: f6e0a90653ebcf5c6524ac956bbd375fc8f756cd

## Starten

Voraussetzung: Node.js 22 oder neuer und npm.
ZIP entpacken und im Terminal ausführen:

```sh
cd ion-bastion
npm ci
npm run dev
```

Danach http://localhost:4173 im Browser öffnen.

Tests: `npm test`
Produktionsbuild: `npm run build` (Ausgabe in `dist/`)

Spielübersicht: README.md. Architektur und Erweiterung: CLAUDE.md.

Enthalten sind Quellcode, Tests, Assets, Konfiguration und die Paket-Lockdatei.
Abhängigkeiten werden mit npm ci installiert. Git-Historie, lokale Abhängigkeiten
und die Identität der gehosteten Site sind nicht Teil dieses portablen Exports.
