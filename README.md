# ION BASTION

Spielbares Tower-Defense-Template: TypeScript, Phaser 3, Vite und Vitest. 30 Missionen in sechs Sektoren mit eigenen Maps, Wellen und Terrain-Stilen, dreizehn Türme und fünfzehn Gegnertypen (Boden und Luft). Komplett clientseitig; nur der optionale Mehrspieler-Modus braucht einen kleinen Relay-Server. Spielstände sind bewusst nur im Arbeitsspeicher; Neuladen startet eine neue Mission.

## Lokal starten

```sh
npm ci
npm run dev
npm test
npm run build
```

## Mehrspieler (2–4 Spieler)

In zwei Terminals im Projektordner starten:

```sh
npm run server   # Relay auf ws://0.0.0.0:4174 (PORT=… überschreibt den Port)
npm run dev      # Spiel auf http://0.0.0.0:4173
```

**Host**

1. `http://localhost:4173` öffnen.
2. Optional unter „Missionen“ eine Mission wählen; die Runde startet mit der aktuell geladenen Mission.
3. „Mehrspieler“ → „Raum erstellen“. Der vierstellige Raumcode (z. B. `KJSK`) erscheint; ihn den Mitspielern schicken.
4. Modus wählen und „Mission starten“, sobald genug Spieler im Raum sind.

**Mitspieler**

1. Das Spiel vom Rechner des Hosts öffnen: `http://<IP-des-Hosts>:4173` (auf demselben Rechner `http://localhost:4173`).
2. „Mehrspieler“ → Raumcode eingeben → „Beitreten“ (oder Enter).
3. Warten, bis der Host die Mission startet.

**Modi** (`core/modes.ts`)

| Modus | Spieler | Regeln |
|---|---|---|
| Koop | 2–4 | Gemeinsame Karte und Reaktorenergie, getrennte Credits. Start-Credits, Abschussprämien und Wellenbonus werden geteilt (ein unteilbarer Rest wechselt zwischen den Spielern), Raffinerien zahlen an ihren Besitzer. In Summe verdienen alle genau so viel wie ein Einzelspieler. Türme gehören dem Erbauer (farbige Ecke: blau, bernstein, grün, magenta); nur er verbessert und verkauft sie (`tower-foreign`). |
| Wettlauf | 2–4 | Jeder verteidigt eine eigene Kopie der Mission mit vollen Start-Credits. Die Wellen starten für alle gleichzeitig, sobald alle „Bereit“ gedrückt haben, spätestens nach 30 s. Keine Pause. Wer seinen Reaktor als Letzter hält, gewinnt; überstehen mehrere alle Wellen, entscheiden Reaktorenergie, dann Abschüsse. |
| Belagerung | 2–4 | Wie Wettlauf, zusätzlich schickt man unter „Schicken“ Gegner in das Feld des nächsten Mitspielers, der noch steht (Kosten: 4 × Abschussprämie). Nur Gegnertypen, die schon in einer Welle vorkamen. Geschickte Gegner bringen dem Verteidiger keine Prämie. |

Mission, Neustart und Tempo bestimmt in allen Modi der Host (`host-only`). Dialoge und Tabwechsel pausieren im Mehrspieler nicht.

**Probleme**

- „Kein Relay … erreichbar“: `npm run server` läuft nicht, oder eine Firewall blockiert Port 4174.
- Relay auf einem anderen Rechner oder Port: `http://<IP>:4173/?server=ws://<Relay-IP>:4174`. Standardmäßig verbindet sich das Spiel mit Port 4174 auf dem Host, der die Seite ausliefert.
- „Der Raum ist voll …“: Ein Raum hat vier Plätze, und nach dem Missionsstart kann niemand mehr beitreten.
- Verlässt ein Spieler den Raum, hält das Spiel an. Die übrigen rücken auf (geht der Host, wird der nächste Spieler Host), und der Host kann neu starten. „Raum verlassen“ setzt die Mission allein fort. Wiederverbinden gibt es noch nicht.

**Technik:** deterministischer Lockstep. `server/room.ts` sammelt Commands und gibt sie als nummerierte Frames aus (30 pro Sekunde, bei 2× zwei pro Takt), `server/relay.ts` verteilt sie per WebSocket und stempelt jeden Command mit dem Sender. Der Relay kennt keine Spiellogik, prüft aber, ob die Spielerzahl zum Modus passt. Im Client ersetzt `LockstepDriver` (`net/lockstep.ts`) den lokalen Takt: pro Frame die Commands anwenden, dann genau ein `tick()`. Im Koop treibt er das gemeinsame `Game` (`coopSim`), im Versus ein `Match` (`core/match.ts`) mit einem Solo-`Game` pro Spieler; jeder Client simuliert alle Felder und zeigt sein eigenes. Alle 30 Frames vergleicht der Relay den Hash aller Clients und meldet Abweichungen. Commands tragen optional `player` (Standard 0), `GameState.wallets` hat einen Eintrag pro Spieler; `core/economy.ts` verteilt Einnahmen.

## Architektur

- `src/core/`: Typen, Zustand, validierte Commands (Handler-Map mit Status-Guard), fester Simulationstakt (30 Hz), Inhaltsvalidierung mit Fehlerpfad (`ContentError`, z. B. „Mission kernfestung › Welle 7 › Gruppe 2: …“). Keine DOM- oder Phaser-Abhängigkeit. Commands liefern sprachneutrale Codes (`CommandResult.code`); die Texte stehen in `ui/messages.ts`.
- `src/content/`: Definitionen für Türme, Gegner, Maps, Wellen und Missionen; `content/index.ts` bündelt sie als `DEFAULT_CONTENT` (`ContentPack`). Sektor I steht in `maps.ts`/`waves.ts`/`missions.ts`, die Sektoren II–VI je in einem Modul unter `content/sectors/` (Maps, Wellen und Missionen zusammen).
- `src/systems/`: Simulationssysteme, alle mit dem Kontext `Sim` (`{ state, mission, content }`, von `Game` implementiert): Spawn, Status, Bewegung, Kampf, Wellen. `attacks/` enthält ein Modul je Angriffsart, `damage.ts` die einzige Schadenspipeline, `status.ts` Statuseffekte, `traits.ts` Gegnereigenschaften. Zielwahl: zuerst der Gegner mit dem größten Pfadfortschritt, stabile ID als Tie-Breaker.
- `src/render/`: Phaser-Szene plus Zeichen-Registries je Stil (`towers.ts`, `enemies.ts`, `projectiles.ts`, `effects.ts`). Grafikeffekte ändern niemals die Simulation.
- `src/ui/`: HTML-Oberfläche, Zustandsspiegel und Texte.
- `src/app/`: Eingaben (`input.ts`), Dialoge (`dialogs.ts`), Audio und optionale WebMCP-Integration.
- `src/main.ts`: Verdrahtung und Lebenszyklus.

`Game` nimmt optional ein eigenes `ContentPack` (`new Game(mission, content)`), z. B. für Tests oder Varianten. Reine Abfragen (`resolveUpgrades`, `effectiveTowerStats` …) haben `content` als letzten, optionalen Parameter. `resolveUpgrades` ist pro Content-Pack und Upgrade-Liste gecacht.

Events sind eine typisierte Union (`GameEvent`): `shot`, `chain`, `impact`, `damage`, `kill`, `leak`, `spawn`, `build`, `sell`, `upgrade`, `waveStart`, `waveEnd`, `end`.

Alle Änderungen gehen über `Game.command`. Events werden nach jedem Renderframe abgeholt. Schaden entsteht erst beim Einschlag: Projektile sind Teil des Simulationszustands (`GameState.projectiles`) und fliegen mit fester Geschwindigkeit pro Turm (`projectile.speed`). Impuls, Flak und Kryo verschießen Lenkgeschosse, die ihr Ziel verfolgen; stirbt das Ziel vorher, sucht das Geschoss ein neues im Umkreis von 1,5 Feldern, sonst verpufft es. Nova feuert Granaten auf die Position des Ziels beim Abschuss, schnelle Gegner können ausweichen. Tesla-Blitze treffen sofort. Projektile verkaufter Türme schlagen trotzdem ein. Mündungsfeuer und Einschlagseffekte sind ausschließlich Darstellung. Bewegung, Cooldowns und Verlangsamung verwenden Simulationszeit. Zeit wird mit einem Akkumulator verarbeitet; starke Tab-/Frame-Verzögerungen werden begrenzt. Tabwechsel pausiert automatisch.

## Inhalte ergänzen

**Missionen:** `content/missions.ts` listet alle Missionen (`MissionDefinition`) in Spielreihenfolge, gruppiert in `SECTORS` (`MissionSector`: id, Name, Missionen); `MISSIONS` ist die flache Liste daraus, die Missionsnummer ergibt sich aus der Position. Felder: Map, Wellen, Start-Credits, Reaktorenergie, optional `hpGrowth` (HP-Zuwachs pro Welle, Standard 14 %) und `availableTowers` (baubare Türme; Standard alle). Alle Missionen sind über „Missionen“ direkt wählbar: Der Dialog zeigt je Sektor einen Tab (Pfeiltasten wechseln) und öffnet auf dem Sektor der aktiven Mission; nach einem Sieg führt „Nächste Mission“ weiter, auch über Sektorgrenzen. Der Wechsel läuft über den Command `{ type: "mission", id }`, `restart` bleibt in der aktuellen Mission. `ContentPack.sectors` ist optional; ohne Sektoren zeigt der Dialog eine flache Liste. Die Validierung prüft, dass die Sektoren genau `missions` in derselben Reihenfolge enthalten.

| Nr. | Mission | Schwerpunkt | Map | Wellen | Credits | HP/Welle |
| --- | --- | --- | --- | --- | --- | --- |
| **I** | **Grenzzone** | | | | | |
| 01 | Außenposten 07 | An Kurven bauen | 18 × 12 | 10 | 240 | 14 % |
| 02 | Schleusenring | Innenkurven, Türme mehrfach feuern lassen | 18 × 12 | 10 | 280 | 45 % |
| 03 | Splitterfeld | Bauinseln, Reichweiten überlappen | 18 × 12 | 12 | 320 | 60 % |
| 04 | Glutpass | Schnelle Gegner mit Kryo bremsen | 18 × 12 | 12 | 340 | 45 % |
| 05 | Kernfestung | Spirale mit drei Verteidigungszonen | 18 × 12 | 15 | 400 | 65 % |
| **II** | **Frostgürtel** | | | | | |
| 06 | Eisbrecher | Lange Geraden für die Lanze | 22 × 11 | 13 | 380 | 72 %¹ |
| 07 | Kryotal | Kryo verlangsamt, Glut brennt nach | 18 × 12 | 13 | 400 | 58 % |
| 08 | Gletscherspalte | Enges Zickzack für Tesla | 18 × 12 | 14 | 420 | 66 %¹ |
| 09 | Polarnacht | Gleiterschwärme, Luftabwehr | 18 × 12 | 14 | 440 | 75 % |
| 10 | Frostwall | Finale: zwei Titanen, Zerfall | 18 × 13 | 15 | 460 | 72 % |
| **III** | **Säuremoor** | | | | | |
| 11 | Sickergrube | Korrosion verstärkt alle Türme | 18 × 12 | 13 | 420 | 70 % |
| 12 | Nebelsumpf | Stasis hält Gruppen an | 21 × 12 | 13 | 440 | 80 % |
| 13 | Brackwasser | Nur Impuls, Kryo, Korrosion, Flak | 16 × 12 | 14 | 440 | 86 % |
| 14 | Faulturm | Spirale um den Reaktor, Aura-Cluster | 17 × 13 | 14 | 480 | 86 % |
| 15 | Giftkessel | Finale: Panzerwellen, Korrosion und Zerfall | 20 × 12 | 15 | 500 | 88 % |
| **IV** | **Orbitaldeck** | | | | | |
| 16 | Andockring | Raffinerien früh bauen | 18 × 12 | 14 | 460 | 80 % |
| 17 | Frachtschleuse | Knappe Start-Credits | 16 × 11 | 14 | 290 | 82 % |
| 18 | Schwerelos | Überwiegend Luftangriffe | 18 × 12 | 15 | 480 | 83 % |
| 19 | Solarsegel | Breite Station, lange Strecke | 22 × 10 | 15 | 510 | 90 % |
| 20 | Kommandobrücke | Finale mit vollem Gegnermix | 20 × 12 | 16 | 540 | 90 % |
| **V** | **Ruinenstadt** | | | | | |
| 21 | Trümmerallee | Wenige Bauplätze zwischen Trümmern | 18 × 12 | 15 | 480 | 80 % |
| 22 | Bunkerlinie | Nur Impuls, Nova, Kryo, Flak | 18 × 11 | 15 | 500 | 92 % |
| 23 | Kathedrale | Kurzer Pfad, 15 Reaktorenergie | 18 × 12 | 15 | 520 | 88 % |
| 24 | Hochbahn | Sprinterschwärme auf langen Geraden | 22 × 11 | 16 | 540 | 92 % |
| 25 | Zitadelle | Finale: zwei Titanen zugleich | 20 × 13 | 16 | 560 | 90 % |
| **VI** | **Singularität** | | | | | |
| 26 | Ereignishorizont | Nur 10 Reaktorenergie | 18 × 12 | 16 | 520 | 90 % |
| 27 | Riss | Sehr kurzer Pfad, kompakte Karte | 15 × 10 | 16 | 560 | 95 % |
| 28 | Zeitschleife | Einzelne Wellen mit HP-Spitzen | 18 × 12 | 17 | 580 | 110 %¹ |
| 29 | Nullpunkt | Ohne Aura und Raffinerie, harte Panzer | 18 × 12 | 18 | 590 | 105 % |
| 30 | Kern der Singularität | Finale: 20 Wellen, drei Titanen | 20 × 13 | 20 | 650 | 110 % |

¹ Einzelne Wellen setzen `hpMultiplier` statt des linearen Zuwachses.

**Map:** Mit `parseMap(id, name, skizze, theme)` aus `content/maps.ts` anlegen. Die ASCII-Skizze ist die einzige Quelle: `S` Eintritt, `R` Reaktor, `=` Pfad, `#` Hindernis, `.` freie Baufläche. Größe und Pfadreihenfolge werden daraus abgeleitet; Verzweigungen, Sackgassen und lose Pfadfelder werden mit Koordinate abgelehnt. Andere Kartengrößen als 18 × 12 sind möglich (die Kampagne nutzt 15 × 10 bis 22 × 11), die Zeichenfläche passt sich beim Missionswechsel an. `theme` wählt den Terrain-Stil aus `THEMES` in `render/terrain.ts`: `outpost`, `lock`, `shard`, `ember`, `core` (Sektor I) sowie je Sektor `frost`, `toxic`, `orbit`, `ruin`, `rift`. Ein neuer Stil ist ein Eintrag dort (Farben, Hindernis, Bodendetails, animierte Ebene) plus ein Wert in `MapTheme`. Die Beschriftungen für Eintritt, Reaktor und Map-Namen richten sich nach deren Lage.

**Wellen:** Mit den Helfern `g(typ, anzahl, abstand, verzögerung)` und `wave(bonus, ...gruppen)` aus `content/waves.ts`; Gruppen nennen Gegnertyp, Anzahl, Spawn-Abstand und Verzögerung. Optional ersetzt `hpMultiplier` für eine Welle den linearen HP-Zuwachs.

**Balancing:** `core/missions.test.ts` spielt jede Mission deterministisch mit zwei unterschiedlichen Verteidigungen (`core/strategies/`: je Sektor ein Modul mit Bauliste, danach gierige Upgrades) bis zum Sieg, ohne Türme bis zur Niederlage, ab Mission 02 auch mit drei Türmen bis zur Niederlage (Mission 01 ist bewusst leicht), und bei Gleitern mit einer reinen Nova-Verteidigung bis zur Niederlage. `PENDING_BALANCE` im Test listet Strategien, die noch nicht gewinnen (aktuell Frostwall A/B); ihr Siegtest wird übersprungen, bis sie wieder gewinnen. `npx vite-node scripts/balance.ts -- src/content/sectors/frost.ts src/core/strategies/frost.ts` führt dieselben Prüfungen für einen Sektor aus und zeigt die Reaktorenergie nach jeder Welle (Sektor I: `-- src/content/missions.ts src/core/strategies/index.ts 0`). **Golden Replays** (`core/replay.test.ts`) halten den Verlauf jeder Mission × Strategie als Snapshot fest. Ändert sich ein Snapshot, hat sich die Simulation geändert: nur bewusst mit `npx vitest run -u` aktualisieren und den Diff prüfen.

**Türme:** Definition in `content/towers.ts` ergänzen. `attack` beschreibt die Mechanik mit ihren Werten, z. B. `{ kind: "slow", factor: 0.55, duration: 1.9 }`; `visual` legt Symbol, Turmkopf, Projektil- und Einschlagstil fest (`icon`, `turret`, `projectile`, `muzzle`, `impact`). Menü, Tooltips, Detailwerte und Validierung entstehen daraus; die Tasten `1`–`9`, `0`, `Q` und `W` (`TOWER_KEYS` in `ui/interface.ts`) wählen die verfügbaren Türme in Listenreihenfolge. Unterstützungstürme ohne eigenen Angriff erkennt das Spiel an `aim: "none"` ihres Angriffsmoduls (`isSupport`): Sie haben keine `targets`, keinen Schaden und keinen Schusstakt, werden nie von einer Aura verstärkt und nur die Aura braucht eine Reichweite.

**Neue Angriffsmechanik:** Ein Modul in `systems/attacks/` (`aim`, `projectile`, `params` mit Label/Prüfung/Einheit, `apply`), ein Eintrag in `systems/attacks/index.ts` und ein Mitglied von `AttackSpec` in `core/types.ts`. Alle Werte aus `params` sind per `effects.attack` aufrüstbar und erscheinen automatisch in Tooltip und Turmdetails. Schaden immer über `applyDamage` (`systems/damage.ts`), Statuseffekte über `applyStatus` (`systems/status.ts`). Sofortangriffe (ohne Projektil) erhalten zusätzlich Turmposition und Reichweite (`Impact.from`, `Impact.reach`).

**Statuseffekte:** `slow`, `stun`, `burn` und `vulnerable`. Jede Art hat in `systems/status.ts` eine Merge-Regel und optionale Hooks für Tempo, erlittenen Schaden und Ticks. Verlangsamung, Brand und Schwächung: der stärkere Effekt ersetzt den schwächeren, ein gleich starker verlängert ihn. Eine Betäubung blockiert bis zum Ende ihrer Erholungszeit jede weitere, sodass mehrere Stasis-Türme einen Gegner nicht dauerhaft festhalten. Brand trifft alle 0,5 s über `applyDamage` und schreibt den Abschuss dem auslösenden Turm gut, auch nach dessen Verkauf. Schwächung wirkt vor Panzerung. Ein neuer Effekt ist ein Mitglied von `StatusEffect` plus ein Eintrag in `STATUSES`.

**Gegner:** Definition in `content/enemies.ts` mit `visual` (`{ shape: "polygon", sides, rotation }` oder `{ shape: "glider" }`) und optional `traits`: `armor` (Anteil absorbierten Schadens), `regen` (HP/s oder Anteil der maximalen HP je Sekunde), `splitOnDeath` (Gegnertyp und Anzahl), `slowImmune`, `shield` (Schild als Anteil der HP, lädt nach einer Pause von `delay` Sekunden ohne Treffer wieder auf), `sprint` (einmaliger Spurt, sobald die HP unter eine Schwelle fallen), `evade` (jeder n-te Treffer geht daneben), `healer` (heilt andere Gegner im Radius), `leader` (Tempo- und Resistenz-Bonus für andere Gegner im Radius), `stealth` (nicht anvisierbar, bis ein **Detektor** den Gegner aufdeckt; der Detektor ist das Gegenmittel), `unstoppable` (Betäubung und Verlangsamung wirken nicht) und `swift` (mehr Tempo bei weniger HP). Neue Eigenschaften sind ein Eintrag im Registry in `systems/traits.ts` (Hooks `onDamage`, `onTick`, `onDeath`, `resists`). Kein Vererbungsbaum und kein globaler Eventbus.

**Neue Gegner je Sektor:** Ab Sektor II kommen je Sektor zwei Gegnertypen mit Eigenschaften dazu; Sektor I bleibt bei den fünf Grundgegnern.

| Sektor | Neue Gegner |
| --- | --- |
| II Frostgürtel | Splitter (zerfällt in Drohnen), Eisläufer (immun gegen Verlangsamung, flink) |
| III Säuremoor | Schleimer (regeneriert), Sanitäter (heilt) |
| IV Orbitaldeck | Schildträger (Schild), Phantom (getarnt, braucht den Detektor) |
| V Ruinenstadt | Bollwerk (Rüstung), Kommandant (stärkt Gegner in der Nähe) |
| VI Singularität | Phasenläufer (weicht aus), Berserker (unaufhaltsam, Spurt) |

Getarnte Gegner kommen nur in Missionen vor, in denen der Detektor baubar ist; Brackwasser, Bunkerlinie und Nullpunkt (ohne Detektor) haben keine Phantome.

**Verlangsamung:** Eine stärkere Verlangsamung ersetzt eine schwächere, eine gleich starke verlängert sie, eine schwächere überschreibt nie eine noch laufende stärkere.

**Upgrades:** Alle Türme verwenden `UpgradeDefinition` und denselben Kaufpfad. Angriffstürme haben fünf Stufen, Aura drei sich ausschließende Pfade mit je drei Stufen, die Raffinerie drei Stufen (25 / 40 / 60 Credits pro Welle für 120 + 100 + 160 Credits).

| Stufe | Kosten (× Baukosten) | Schaden | Reichweite | Schusstakt |
| --- | --- | --- | --- | --- |
| 2 | 0,9 | × 1,65 | + 0,3 | × 0,9 |
| 3 | 1,5 | × 2,72 | + 0,6 | × 0,81 |
| 4 | 3,0 | × 4,8 | + 0,8 | × 0,66 |
| 5 | 4,5 | × 7,0 | + 1,0 | × 0,6 |

Die Stufen 4 und 5 sind bewusst teuer, liefern aber mehr Schaden pro Credit als zusätzliche Türme: Ein hoch ausgebauter Turm schlägt mehrere kleine (Test in `core/upgrades.test.ts`). Kryo und Tesla bekommen zusätzlich Angriffswerte (`effects.attack`): Kryo verlangsamt auf Stufe 4/5 auf 45 % / 35 % Tempo für 2,3 / 2,8 s, Tesla springt 4 / 5 Mal mit 1,8 / 2 Feldern Sprungweite. Ebenso: Lanze verliert pro Durchschlag nur noch 10 % / 0 % (Stufe 5 mit 0,5 Feldern Strahlbreite), Glut brennt mit dem 3- / 3,5-Fachen des Treffers (Stufe 5 für 3,5 s), Stasis betäubt 1 / 1,2 s im Radius 1,1 / 1,3, Korrosion schwächt um 30 % / 40 % (Stufe 5 im Radius 1), Zerfall zieht 5 % / 6 % der maximalen HP ab. Verkäufe erstatten 70 % der gesamten Investition. Content und Laufzeitinstanzen sind getrennt; Upgrades verändern keine Definitionen.

## Bedienung

Turm wählen, freies Feld anklicken; danach endet der Baumodus (Shift+Klick baut weitere Türme desselben Typs). Gebauten Turm anklicken für Upgrade/Verkauf. Rechtsklick auf das Spielfeld oder ✕ im Auswahl-Panel hebt Baumodus und Auswahl auf (✕ auch auf Touch-Geräten). `1`–`9`, `0`, `Q`, `W`: Turmtyp; `Esc`: Auswahl aufheben (im Vollbild in Chrome/Edge per Keyboard Lock zuerst die Auswahl, ohne Auswahl dann das Vollbild; Firefox/Safari verlassen bei Esc immer zuerst das Vollbild); `N`: nächste Welle; Leertaste: Pause (nur während einer Welle); `F` oder Button ⛶ in der Spielfeldleiste: Vollbild (blendet Kopfzeile und Missionstitel aus, Spielfeld und Seitenleiste füllen den Bildschirm; `Esc` beendet). Spielfeld fokussieren, Pfeiltasten und Enter für Tastaturbedienung. Audio optional, standardmäßig aus.

## Bewusste Grenzen der ersten Version

Fester Pfad, keine Wegblockaden, kein Mehrspieler, kein Speichern von Missionsfortschritt, keine Physik-Engine. Die Simulation ist deterministisch ohne Zufall. Die Maps nutzen funktionale geometrische Spielmarkierungen statt externer Bildassets.


## Boden und Luft

Jeder Gegner hat eine Ebene (`layer: "ground" | "air"`), jeder Angriffsturm eine Liste `targets` mit den Ebenen, die er angreifen kann. Luftgegner folgen demselben Pfad wie Bodeneinheiten.

| Turm | Kosten | Angriff | Ziele |
| --- | --- | --- | --- |
| Impuls | 80 | Einzelziel | Boden · Luft |
| Nova | 130 | Flächenschaden | nur Boden (auch der Explosionsradius) |
| Kryo | 100 | Verlangsamung | Boden · Luft |
| Aura | 160 | Unterstützung | – |
| Flak | 90 | Einzelziel, schnell | nur Luft |
| Tesla | 150 | Kettenblitz: springt bis zu 3× auf Gegner im Umkreis von 1,6 Feldern, je Sprung 75 % Schaden | Boden · Luft |
| Lanze | 170 | Durchschlag: sofortiger Strahl bis zur Reichweite 4,4, trifft alle Gegner auf der Linie (Breite 0,35), je weiterem Treffer 85 % | Boden · Luft |
| Glut | 120 | Brand: zusätzlich das 2,5-Fache des Treffers über 3 s | Boden · Luft |
| Stasis | 140 | Betäubung: Puls um das Ziel (Radius 0,9) hält alle Gegner 0,8 s an, danach 1,5 s immun | Boden · Luft |
| Korrosion | 110 | Schwächung: Säure im Radius 0,8, getroffene Gegner nehmen 3 s lang 25 % mehr Schaden | Boden · Luft |
| Zerfall | 160 | Anti-Boss: Treffer plus 4 % der maximalen HP | Boden · Luft |
| Raffinerie | 120 | Credits: 25 nach jeder abgeschlossenen Welle, kein Angriff | – |
| Detektor | 90 | Aufklärung: deckt getarnte Gegner im Radius 3,5 auf, kein eigener Angriff | – |

Der **Gleiter** ist der erste Luftgegner: schnell, wenig HP. Er erscheint ab Mission 02 in den Wellen; Mission 01 bleibt reiner Bodenkampf. Eine reine Nova-Verteidigung verliert deshalb jede Mission mit Gleitern (Test in `core/missions.test.ts`).

## Aura-Turm

Baukosten: 160 Credits. Fester Radius: 3 Rasterfelder (Abstand der Mittelpunkte). Kein eigener Angriff. Kein Grundbonus: Eine Aura verstärkt erst, wenn ein Pfad gekauft ist.

Drei Upgrade-Pfade mit je drei Stufen. Der erste Kauf legt den Pfad fest; die anderen beiden Pfade sind für diesen Turm danach gesperrt (`upgrade-excluded`). Umentscheiden geht nur über Verkaufen. Stufe II setzt Stufe I voraus, Stufe III setzt Stufe II voraus:

| Pfad | Stufe I | Stufe II | Stufe III |
| --- | --- | --- | --- |
| Schaden | +25 % · 100 | +40 % · 180 | +55 % · 300 |
| Angriffstempo | +20 % · 120 | +35 % · 200 | +50 % · 320 |
| Reichweite | +15 % · 100 | +25 % · 170 | +35 % · 280 |

IDs: `damage`, `damage-2`, `damage-3` (analog `speed`, `range`). Für mehrere Boni baut man mehrere Auren mit verschiedenen Pfaden und lässt ihre Radien überlappen.

Optik je Pfad (`visual.paths`): Schaden glutrot mit rotierenden Klingen, Angriffstempo gelb mit Wirbel, Reichweite grün mit pulsierenden Ringen. Jede Stufe ergänzt das Motiv. Ohne Pfad ist die Aura gedimmt cyan und zeigt drei Farbpunkte. Radiuskreis, Verbindungslinien, Markierungen und Kaufeffekt nutzen die Pfadfarbe (`towerColor`).

`systems/auras.ts` liefert reine Abfragen für Simulation, Reichweitenzeichnung, UI und Upgrade-Vorschau. Erst werden eigene Turmlevel, dann Aura-Boni angewandt: Schaden und Reichweite mal `(1 + Bonus)`, Schussabstand geteilt durch `(1 + Tempobonus)`. Schaden behält Nachkommastellen; die Anzeige rundet auf höchstens zwei Stellen. Bei überlappenden Auren gilt je Eigenschaft der größte Bonus. Verschiedene Eigenschaften dürfen von verschiedenen Quellen kommen. Aura-Türme und Raffinerien werden nie verstärkt. Radius, Kryo-Verlangsamung und Nova-Explosionsradius ändern sich nicht.

`Tower.upgrades` speichert die IDs aller Käufe. Der gemeinsame Command `upgrade` prüft Turm, Voraussetzungen, Kaufstatus und Credits. Verkauf erstattet 70 % inklusive gekaufter Upgrades. Boni werden aus aktuellen Türmen abgeleitet und verschwinden beim Verkauf sofort, ohne veralteten Cache. Angriffscooldowns speichern den übrigen Anteil eines Schusszyklus: Änderungen am Tempo erhalten den bisherigen Fortschritt und lösen keinen Gratis-Schuss aus.

Unterstützte Türme haben eine cyanfarbene Markierung; beim Auswählen oder Platzieren zeigt der Radius die betroffenen Türme. Taste `4` wählt Aura. Die Upgrade-Info ist per Hover, Tastaturfokus oder separatem Info-Button auf Touch-Geräten zugänglich.


## Gemeinsames Upgrade-System

- `content/upgrades.ts`: Daten für alle Verbesserungen. `attackTower` erzeugt den bisherigen Stufenpfad direkt aus den Basiswerten; `AURA_UPGRADES` beschreibt die drei Aura-Stränge mit je drei Stufen.
- `core/types.ts`: `UpgradeDefinition` enthält `id`, `label`, `description`, `cost`, `requires`, optional `path` und `effects`. Upgrades mit verschiedenem `path` schließen sich auf einem Turm aus; Voraussetzungen müssen im selben Pfad liegen. IDs sind innerhalb eines Turmtyps eindeutig.
- `core/upgrades.ts`: Gemeinsame Statusprüfung, Kauf, rein lesende Vorschau, Effektauflösung und Inhaltsvalidierung. `available`, `unaffordable`, `locked`, `excluded`, `purchased` und `unknown` werden von UI und Kauf gemeinsam verwendet.
- `Tower.upgrades: string[]` ist die einzige Quelle für Upgrade-Fortschritt. Stufe, eigene Kampfwerte und ausgesendete Aura-Boni werden daraus abgeleitet. Es gibt keine getrennten `level`-/`auraUpgrades`-Zustände oder Aura-Kaufbefehle mehr.

Ein Kauf verwendet für jeden Turm denselben Command:

```ts
game.command({ type: "upgrade", id: towerId, upgrade: "level-2" });
game.command({ type: "upgrade", id: auraTowerId, upgrade: "damage" });
```

Effekte setzen typisierte eigene Werte (`stats`), Angriffswerte (`attack`), ausgesendete Boni (`aura`) oder die angezeigte Stufe (`level`). Die Auflösung erfolgt in Abhängigkeitsreihenfolge. Bei unabhängigen Änderungen desselben Wertes gilt die Reihenfolge im Inhaltskatalog. Bestehende Aura-Stapelregeln bleiben separat unverändert. Eigene Upgrade-Werte werden zuerst aufgelöst, danach eingehende Aura-Boni.

`previewUpgrade` liefert eine Kopie mit dem zusätzlichen Kauf, ohne Gold, Investition, Cooldown oder echte Türme zu verändern. Sie nutzt dieselbe Effektauflösung wie das Spiel. Auch bei zu wenigen Credits bleibt eine strukturell erlaubte Verbesserung einsehbar. Kauf und Verkauf rechnen weiterhin über `spent`; ein Tempo-Upgrade erhält den Fortschritt des laufenden Schusszyklus.

Weitere Upgrades werden der Definition des jeweiligen Turms hinzugefügt. Voraussetzungen können auf andere IDs desselben Turms verweisen; doppelte IDs, fehlende Voraussetzungen, Zyklen, ungültige Kosten und Effekte werden beim Laden abgelehnt. Die Oberfläche erzeugt ihre Buttons aus dem Katalog und verwendet für alle den gleichen Klick-Handler.

Zielprioritäten und eine Speicherfunktion gibt es noch nicht; Statuseffekte und Gegnereigenschaften sind über `STATUSES` in `systems/status.ts` und `TRAITS` in `systems/traits.ts` erweiterbar. Es gibt weiterhin keinen persistenten Spielstand, der migriert werden müsste.
