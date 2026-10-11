# ION BASTION – Implementierungsspezifikation für Turm-Spezialisierungen

**Dokumentversion:** 2.0 · **Datum:** 10.10.2026 · **Sprache der Implementierung/UI:** Englisch · **Sprache dieses Dokuments:** Deutsch  
**Projekt:** [chiefblub2/ion-bastion](https://github.com/chiefblub2/ion-bastion) · **Geprüfter Referenzzweig:** `main` (Webansicht vom 10.10.2026)  
**Status:** fachlich und technisch detaillierter IMPLEMENTIERUNGSVORSCHLAG – **nicht** bereits umgesetzt, Balancezahlen noch nicht spielgetestet.  
**Zielgruppe:** Junior-TypeScript-Entwickler; Code-Review durch eine mit der Simulation vertraute Person ist vorgesehen.

> **So liest du dieses Dokument:** Kapitel 1–2 erklären die Regeln. Kapitel 3–5 sind die **vollständige Datenquelle für alle 162 Upgrades**. Kapitel 6–12 erklären, *was exakt in welcher Datei zu tun ist*, mit Beispielen, Testfällen und Edge-Case-Regeln. Kapitel 13–14 enthalten eine umsetzbare Ticketliste und die Definition of Done. Alle Bezeichnungen in Backticks sind TypeScript-IDs oder echte Projektdateien. Beispielcode ist ausdrücklich als Vorlage gekennzeichnet, falls er nicht unmittelbar kompilierbar ist.

## 1. Auftrag, Ergebnis und Grenzen

### 1.1 Gewünschtes Spielerlebnis

Jeder der derzeit 18 normalen offensiven Türme hat weiterhin die existierende Upgrade-Kette Level 2 → 3 → 4 → 5. Nach Kauf von `level-5` erscheinen **exakt drei Spezialisierungen** mit eigenem Namen, klar unterschiedlicher Rolle und drei kaufbaren Stufen: Stufe I = Level 6, Stufe II = Level 7, Stufe III = Level 8. Beim Kauf der ersten Stufe wird die Linie für genau diese Turminstanz festgelegt; danach bleiben die beiden anderen Linien auch bei genügend Credits nicht kaufbar.

**Zielumfang:** 18 Türme × 3 Pfade × 3 Stufen = **162 neue `UpgradeDefinition`-Einträge**; tatsächlich kann ein einzelner Turm nach Level 5 höchstens drei dieser neuen Einträge erwerben. Zwölf Türme stehen im UI-Reiter Attack, sechs im Reiter Control. Neun `trapTower(...)`-Fallen und reine Support-Türme (insbesondere Aura) sind **nicht** Teil dieses Features.

### 1.2 Nichtziele

Keine Änderungen an den bisherigen Level-2–5-Zahlen, Tower-IDs, Gegnerwerten, Karten, Missionsstart-Credits, Netzwerkprotokoll-Befehlsnamen oder der Struktur der bestehenden Missionen. Keine Wahl von zwei Pfaden für einen Turm, keine Respec-Taste, kein zufälliger Proc. Kein neues Save-System: Laut README bestehen Spielstände während der laufenden Mission im Speicher; Reload startet die Mission neu. Die neuen Upgrades müssen aber in Replays und Multiplayer deterministisch sein.

### 1.3 Referenzcode / Einstiegspunkte

| Datei | Funktion / Bedeutung | Vorgesehene Arbeit |
|---|---|---|
| `src/content/upgrades.ts` | `attackUpgrades`, `attackTower`, `ATTACK_LEVELS` | Normale Level 2–5 beibehalten; zusätzliche Pfad-Daten generieren |
| `src/content/towers.ts` | `TOWER_CONTENT` | Tower↔Pfad-Konfiguration, `visual.paths` |
| `src/core/types.ts` | `UpgradeDefinition`, `Tower`, `Projectile`, `StatusEffect`, `GameState`, `Hit` (in `damage.ts`) | Typisierte Spezialeffekte, optionaler Laufzeitzustand |
| `src/core/upgrades.ts` | `validateUpgradeDefinitions`, `upgradeOption`, `towerPath`, `resolveUpgrades`, `maxTowerLevel`, `purchaseUpgrade` | Pfadlose Voraussetzung zulassen, neue Spezialeffekte auflösen |
| `src/systems/combat.ts` | `attackEnemies`, `moveProjectiles`, `compareTargets` | Attacken-/Projektil-Snapshot, Triggerzählung, Zusatzziele |
| `src/systems/attacks/*.ts` | Angriffsarten pro Modul | Bestehende Parameter und neue Bonusmechaniken anwenden |
| `src/systems/damage.ts` | `Hit`, `hitOf`, `applyDamage` | Bedingter Schaden, Panzerung, Kill-/Overkill-Ergebnis |
| `src/systems/status.ts`, `src/systems/traits.ts` | Status-Merge, Immunität, Rüstung | Zusätzliche Effekte und sichere Schutzberechnung |
| `src/core/hash.ts` | `stateHash` | Neue zustandsrelevante Zähler/Queues deterministisch hashen |
| `src/ui/upgrade-tooltip.ts`, `src/ui/tower-details.ts` | Upgrade-Buttons, Vorschau, Levelanzeige | Pfadwahl ab L5, genau eine Folgeoption nach Festlegung |
| `src/render/towers.ts`, `src/render/effects.ts` | Turmoptik, VFX | Pfadfarbe/Motiv und verständliche Treffer-VFX |
| `src/core/`, `src/systems/` · `*.test.ts` | Vitest und Replay-Tests | Normale Upgrades, Spezialmechaniken, Lockstep absichern |

**Wichtige vorhandene Eigenschaften:** `UpgradeDefinition.path` und `towerPath(...)` implementieren schon exklusive Wege (Aura ist das Beispiel); `Tower.upgrades` speichert gekaufte Upgrade-IDs; `resolveUpgrades` führt `effects.stats` und `effects.attack` als **absolute Überschreibungen** aus; `Projectile.attack` und `Projectile.damage` speichern bereits die Parameter beim Abschuss. Änderungen dürfen diese Architektur ergänzen, nicht parallel nachbauen.

## 2. Gemeinsame, verbindliche Spielregeln

### 2.1 Kauf und Freischaltung

1. Stufe I jedes Pfades benötigt genau `['level-5']`; Stufe II benötigt `['<slug>-1']`; Stufe III benötigt `['<slug>-2']`.
2. Pfadwechsel nach erstem Kauf ist ausgeschlossen. Der Check findet im **Simulationscode**, nicht nur als deaktivierter Button, statt. Die vorhandene `upgradeOption(...)`-Prüfung auf `definition.path` und `towerPath(...)` bleibt maßgeblich.
3. Alle alten Upgrades bleiben beim Spezialisieren erhalten. Die Stufen 6/7/8 ersetzen nur die Werte der **früheren Stufe desselben Pfades**, nicht die ursprünglichen Level-5-Fähigkeiten.
4. Maximal angezeigtes Turmlevel = 8. Ohne Kauf steht ein Level-5-Turm bei `5 / 8` und bekommt eine Wegauswahl.
5. Kaufpreis je Pfadstufe: `Math.round(buildCost * multiplier)` mit `multiplier ∈ [2.5, 4, 6]`. Andere Boni/Rabatte ändern diesen Preis nicht. Beim Verkauf bleiben die existierenden 70 % von `tower.spent` gültig.
6. Multiplayer: nur Eigentümer kann kaufen; für das Upgrade wird der vorhandene Befehl `{type:'upgrade', id:tower.id, upgrade:'<slug>-1'}` verwendet. Kein neues Netzwerkkommando.

### 2.2 Zahlen, Zeit und Rundung

- Alle Pfadwerte in den folgenden Tabellen sind **Endwerte der betreffenden Stufe**. `+70 %` bedeutet 1,70 × den angegebenen Referenzwert, nicht `L5 × 1,25 × 1,45 × 1,70`.
- Angriffsintervall wird vom **effektiv aufgelösten L5-Wert vor Aura** berechnet: `interval_L6 = interval_L5 * (1 - 0.15)` usw. `+2.3 Reichweite` ist eine **absolute Addition in Map-Zellen** zum L5-Wert, keine Prozentzahl.
- Parameter wie `radius`, `jumps`, `strength`, `factor`, `duration`, `threshold`, `percent` überschreiben immer den entsprechenden aktuellen Angriffsparameter durch einen absoluten Wert.
- Alle Statusdauern beginnen beim **Einschlag bzw. Auslösen**, nicht beim Abschuss. Die Simulation verwendet 30 Ticks/s; Verzögerungen werden als `due = state.time + seconds` gespeichert und bei `time >= due` genau einmal ausgeführt. Kein `setTimeout`, `Math.random`, Phaser oder DOM in `src/core/` und `src/systems/`.
- Schwellen sind **streng kleiner als** (`hp / maxHp < threshold`) für Executioner und Final Decay. Exakt 35 % ist bei einer 35-%-Grenze noch nicht darunter. Radiusprüfungen sind `distance <= radius`.
- Rundung des Schadens: float intern wie bisher; erst Anzeige in UI mit bestehendem `number(...)` formatieren. `Math.floor(...)` ausschließlich dort, wo dies explizit gefordert ist (z. B. Fokus-Stacks).

### 2.3 Gegnerfilter und Status

- **Schweres Ziel:** `enemy.maxHp >= 1000` ODER `enemy.type === 'titan'` (sofern diese ID in `content.enemies` existiert); dieser Trait ist eine Spezifikationsentscheidung, nicht eine bestehende Eigenschaft. Für gepanzerte Gegner gilt stattdessen der tatsächliche `armor`-Trait.
- Primärziel: `canAcquire(...)`, inkl. Ziel-Layer, Tarnung, Reichweite und Taunt, wie bisher. Zusätzliche **gezielte** Treffer (Ricochet, weitere Flak-Ziele, zweite Tesla-Kette, Prism usw.) brauchen dieselbe Akquisitions- und Layerprüfung. **Flächeneffekte** prüfen `canTarget(...)`, wie die vorhandenen AoE-Module, sodass Tarn-/Burrow-Regeln für AoE erhalten bleiben.
- Gezielte Sekundärziele in der geltenden Zielpriorität auswählen (`compareTargets(...)`), bei Distanz-Mechaniken zuerst Distanz und danach stabile Gegner-ID. Immer den bereits getroffenen Gegner sowie tote Gegner ausschließen.
- Kein Pfad erzeugt automatisch Stealth-Erkennung oder neue Ground/Air-Ziellayer. Besonders wichtig: Nova/Mortar/Quake treffen weiterhin nur Boden, Flak/Snare Net nur Luft, **Gravitron nur Boden**.
- Schadensbonus gegen Rüstung umgeht nur den `armor`-Trait, **nicht** `mirror`, `blastproof`, `refract`, `shield`, `link`, `insulated`, `evade` oder eigene Immunitäten. Alle Treffer einschließlich Sekundärtreffer durchlaufen `applyDamage(...)`.
- Effekte der Art `vulnerable` behalten das bestehende **Maximum-statt-Addition**-Verhalten (`damageTaken` liest den stärksten Wert). Stärkere erneuern nur ihre eigene Restlaufzeit entsprechend der vorhandenen Merge-Regeln. Ein neuer Panzerungsstatus erhält analog nur den stärksten Wert.
- Sekundärtreffer lösen keinen weiteren Treffer-Proc desselben Angriffs aus. Pro Salve und Pfad gelten die angegebenen Maximalzahlen, sonst entstehen Endlosschleifen.

### 2.4 Vorhandenes Level 5 bleibt Referenz

| Turm-ID | Anzeigename | Relevantes Verhalten auf Level 5 |
|---|---|---|
| `pulse` | Pulse | Standard-Einzelprojektil |
| `blast` | Nova | Explosion 1,25 Radius (kein Radius-Upgrade in L4/L5 ersichtlich) |
| `flak` | Flak | Nur Luftziele |
| `tesla` | Tesla | 5 Sprünge, Reichweite je Sprung 2,0 |
| `lance` | Lance | Strahl-Halbbreite 0,5, Falloff 1 |
| `inferno` | Ember | Brand-Faktor 3,5 über 3,5 s |
| `decay` | Decay | +6 % der maximalen Gegner-HP pro Treffer |
| `focus` | Focus | +30 % pro Stapel, maximal 12 Stapel |
| `mortar` | Mortar | Einschlagsradius 1,7, tote Zone 1,2 |
| `quake` | Quake | Voller Schaden am Rand (`edge:1`) |
| `executioner` | Executioner | 5× unter 35 % HP |
| `shrapnel` | Shrapnel | 5 verschiedene Ziele je Salve |
| `frost` | Cryo | Geschwindigkeitsfaktor 0,35; 2,8 s |
| `stasis` | Stasis | 1,2 s Stun, 1,5 s Recovery, Pulsradius 1,3 |
| `acid` | Corrosion | +40 % Schaden, Radius 1,0, 3 s |
| `gravity` | Gravitron | Stärke 2,2, Radius 1,4, Dauer 0,7 s |
| `jammer` | Jammer | Radius 1,5, 4,5 s |
| `net` | Snare Net | Faktor 0,60, Dauer 4,5 s |

**Hinweis zur Nova:** Laut `src/content/towers.ts` ist der Level-5-Radius weiterhin **1,25**. Damit ist die vorgeschlagene Supernova-I (1,5) eine echte Erhöhung. Frühere Spiel-Darstellungen können einen anderen Wert suggerieren; vor Implementierung den Code als Quelle nehmen.

---

## 3. Attack – zwölf Türme

### 3.1 Pulse (`pulse`) – Präzision, Frequenz oder Zielwechsel

| Pfad | Level 6 · Stufe I | Level 7 · Stufe II | Level 8 · Stufe III |
|---|---|---|---|
| **A · Sharpshooter** (schwere Einzelziele) | Gegen schwere Ziele +25 % Direktschaden | +45 % gegen schwere Ziele | +70 % gegen schwere Ziele |
| **B · Overclock** (Dauerfeuer) | Feuerintervall −15 % | Feuerintervall −25 % | Feuerintervall −35 % |
| **C · Ricochet** (Zielwechsel) | Jeder 4. Treffer springt auf einen zweiten gültigen Feind innerhalb 1,3 Feldern; 35 % Zusatzschaden | Jeder 3. Treffer, 50 %, Radius 1,5 | Jeder 2. Treffer, 65 %, Radius 1,7 |

### 3.2 Nova (`blast`) – Flächenräumung, Belagerung oder Kettenexplosion

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Supernova** (große Gruppen) | Explosionsradius 1,5 Felder | Radius 1,75 | Radius 2,0 |
| **B · Siegebreaker** (gepanzert) | Direkter Einschlags- und Explosionsschaden +20 % gegen Gegner mit Rüstung | +40 % | +60 % |
| **C · Chain Reaction** (Kill-Belohnung) | Kill durch Haupt-Explosion erzeugt genau eine Folgeexplosion: Radius 0,75, 25 % des Haupttrefferschadens; höchstens 1 pro Salve | Radius 0,9, 40 %, höchstens 2 pro Salve | Radius 1,1, 55 %, höchstens 3 pro Salve |

Folgeexplosionen wählen die Position der zuerst gestorbenen gültigen Ziele in stabiler Reihenfolge; sie können keine weiteren Folgeexplosionen auslösen.

### 3.3 Flak (`flak`) – Fliegerjagd, Mehrfachbeschuss oder Luftkontrolle

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Skyhunter** (schwere Flieger) | +25 % Schaden gegen Luftziele mit mindestens 1.000 max. HP | +45 % | +70 % |
| **B · Flak Curtain** (Fliegerschwärme) | Pro Salve ein weiterer Luftgegner im Bereich: 45 % Hauptschaden | Zwei weitere Ziele: je 45 % | Drei weitere Ziele: je 45 % |
| **C · Wingclip** (Abfangen) | Getroffene Flieger 1,5 s lang 15 % langsamer | 2 s lang 22 % langsamer | 2,5 s lang 30 % langsamer |

### 3.4 Tesla (`tesla`) – Ketten, Überladung oder Doppelentladung

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Storm Network** (Schwarmkette) | Max. 6 Sprünge, Sprungdistanz 2,2 | Max. 7, Distanz 2,4 | Max. 8, Distanz 2,6 |
| **B · Overload** (isolierte Ziele) | Wenn beim Schuss nur ein gültiger Feind in Turmreichweite ist: +30 % Schaden | +55 % | +85 % |
| **C · Twin Arc** (getrennte Gruppen) | Jeder 4. Schuss startet zusätzlich eine zweite Kette mit 45 % Schaden an einem bisher nicht getroffenen Ziel | Jeder 3. Schuss, 55 % | Jeder 2. Schuss, 65 % |

Zweitketten besitzen dieselbe maximale Sprungzahl und dieselbe maximale Sprungdistanz wie Tesla L5. Es wird kein Gegner zweimal in derselben Salve getroffen.

### 3.5 Lance (`lance`) – Distanz, Korridor oder Panzerbrecher

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Longshot** (weite Schusslinien) | Reichweite +0,8 Felder gegenüber L5 | Reichweite +1,5 | Reichweite +2,3 |
| **B · Broadbeam** (breite Reihen) | Halbbreite des Strahls von 0,5 auf 0,65 | Halbbreite 0,8 | Halbbreite 0,95 |
| **C · Rail Penetrator** (Panzerung) | Ignoriert 20 % der vorhandenen Rüstungsreduktion | Ignoriert 40 % | Ignoriert 60 % |

Panzerungsdurchdringung wirkt **nur auf den Rüstungs-Trait**; weder `mirror`/`refract` noch andere Schutzmechanismen werden umgangen.

### 3.6 Ember (`inferno`) – Brenndauer, Ausbreitung oder Hitzedruck

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Incinerator** (dauerhafter Brandschaden) | Brand-Gesamtschaden = 4,25× Haupttreffer über 3,5 s | 5× über 3,5 s | 6× über 4 s |
| **B · Wildfire** (Brand-Ausbreitung) | Wenn ein brennendes Ziel stirbt: Brand mit 40 % seiner verbleibenden Schadensmenge auf 1 nahes Ziel innerhalb 1,0 Feld | 55 % auf max. 2 Ziele, Radius 1,2 | 70 % auf max. 3 Ziele, Radius 1,4 |
| **C · Searing Heat** (Synergie) | Treffer dieses Ember verursachen +15 % Schaden gegen bereits brennende Feinde | +25 % | +40 % |

Brandimmunität bleibt wirksam. Übertragene Brände erzeugen keine erneute Ausbreitung; gestapelte Brände folgen den bisherigen Status-Merge-Regeln.

### 3.7 Decay (`decay`) – Boss-Killer, Exekution oder Seuche

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Entropy Beam** (maximale HP) | Zusätzlicher Schaden pro Treffer: 6,5 % max. HP statt 6 % | 7 % | 7,5 % |
| **B · Final Decay** (angeschlagene Ziele) | Gegen Ziele unter 35 % aktuellen HP zusätzlich +1,0 Prozentpunkt max.-HP-Schaden | Unter 45 %: +1,5 Punkte | Unter 55 %: +2,0 Punkte |
| **C · Contagion** (mehrere Ziele) | Pro Treffer erhält 1 anderer Gegner innerhalb 1,0 Feld zusätzlich Schaden = min(1,0 % seiner max. HP, 40 % des Haupttrefferschadens) | 2 Gegner im Radius 1,2: min(1,25 % max. HP, 50 % Hauptschaden) | 3 Gegner im Radius 1,4: min(1,5 % max. HP, 60 % Hauptschaden) |

`Final Decay` addiert seine Prozentpunkte zum Level-5-Wert von 6 %, also maximal 8 % für Ziele unter 55 % HP. Die HP-Schwelle wird beim Einschlag geprüft.

### 3.8 Focus (`focus`) – Langzeitfokus, flexibler Fokus oder Durchschuss

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Deep Focus** (ein Boss) | Schaden pro Folgetreffer +35 % pro Stack statt +30 % | +40 % | +45 %; maximal 12 Stacks wie L5 |
| **B · Adaptive Lens** (häufige Wechsel) | Beim Wechsel auf ein neues Ziel bleiben 25 % der bisher aufgebauten Stacks (abgerundet) erhalten | 50 % | 75 % |
| **C · Prism Beam** (Linienziele) | Der Strahl trifft zusätzlich das erste weitere Ziel hinter dem Hauptziel innerhalb einer Halbbreite von 0,3 Feldern für 30 % aktuellen Haupttrefferschaden | Halbbreite 0,4; 45 % | Halbbreite 0,5; 60 % |

Stapel werden ausschließlich durch Treffer auf das eigentliche Hauptziel aufgebaut, niemals durch Prism-Sekundärtreffer.

### 3.9 Mortar (`mortar`) – Radius, Belagerung oder Schnelllader

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Saturation** (große Felder) | Einschlagsradius 1,9 | Radius 2,1 | Radius 2,3 |
| **B · Bunker Buster** (Panzerung) | +25 % Schaden gegen gepanzerte Bodenziele | +50 % | +75 % |
| **C · Mobile Artillery** (tote Zone beseitigen) | Mindestreichweite sinkt von 1,2 auf 0,9; Intervall −10 % | Mindestreichweite 0,6; Intervall −20 % | Mindestreichweite 0; Intervall −30 % |

Die Einschlagposition bleibt wie bisher eine feste Position; schnelle Gegner können Artillerie weiterhin ausweichen.

### 3.10 Quake (`quake`) – Schwächung, Pulsfrequenz oder Nachbeben

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Fracture** (Team-Synergie) | Betroffene Gegner erleiden 2 s lang 10 % mehr Schaden | 2,5 s / 15 % | 3 s / 20 % |
| **B · Resonance** (Nahbereich-DPS) | Feuerintervall −15 % | −25 % | −35 % |
| **C · Aftershock** (Doppelwelle) | 0,35 s nach Hauptwelle zweite Welle mit 25 % ihres Schadens | 40 % | 55 % |

Nachbeben nutzt den Standort und Radius der ursprünglichen Quake-Welle. Status `vulnerable` aus Fracture konkurriert nach der bestehenden Stärkeregel mit Corrosion.

### 3.11 Executioner (`executioner`) – frühe Hinrichtung, härtere Hinrichtung oder Überschussschaden

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Hunter's Mark** (frühere Exekution) | Die 5×-Exekution greift unter 40 % HP statt 35 % | Unter 45 % | Unter 50 % |
| **B · Guillotine** (maximaler Finisher) | Exekutions-Multiplikator 6× bei unverändert unter 35 % HP | 7× | 8× |
| **C · Blood Transfer** (Schwarmabschluss) | Tötet ein Haupttreffer: 25 % des rechnerischen Überkills als Sekundärschaden an das nächste gültige Ziel innerhalb 1,5 Feldern | 40 %, Radius 1,75 | 60 %, Radius 2,0 |

Überkill = `max(0, berechneter Haupttrefferschaden − noch vorhandene HP vor dem Hit)`. Sekundärtreffer können kein weiteres Blood Transfer auslösen; übertragener Schaden maximal so hoch wie der ursprüngliche Haupttrefferschaden.

### 3.12 Shrapnel (`shrapnel`) – breite Salve, Panzerbrecher oder konzentrierte Salve

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Scatterstorm** (Schwärme) | 6 verschiedene Ziele pro Salve statt 5 | 7 Ziele | 8 Ziele |
| **B · Tungsten Shards** (Panzerung) | Jede Kugel ignoriert 20 % der Rüstungsreduktion des Ziels | 40 % | 60 % |
| **C · Concentrated Volley** (wenige Ziele) | Pro ungenutztem der 5 Basis-Projektile erhält das Hauptziel einmalig +20 % Schaden | +35 % je ungenutztem Projektil | +50 % je ungenutztem Projektil |

Beispiel Concentrated Volley L8: Nur ein Ziel in Reichweite → vier ungenutzte Projektile → Hauptziel nimmt seinen normalen Schaden plus 4 × 50 % = insgesamt 3× Hauptschaden. Die zusätzliche Menge wird als ein Zusatztreffer aggregiert (nicht vier separate Rüstungs-/Spiegelungsprüfungen).

## 4. Control – sechs offensive Kontrolltürme

Auch diese Türme werden durch `attackTower(...)` erzeugt und erhalten dieselbe Freischaltung. Ihre Pfade priorisieren Kontrolle/Synergie statt reinen Schaden.

### 4.1 Cryo (`frost`)

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Permafrost** (stärker bremsen) | Bewegung auf 30 % statt 35 % | Auf 25 % | Auf 20 %; Dauer bleibt 2,8 s |
| **B · Brittle Ice** (verwundbar machen) | Cryo-verlangsamte Feinde nehmen 8 % mehr Schaden aus allen Quellen | 12 % | 16 % |
| **C · Frostburst** (Gruppen bremsen) | Bei Treffer zusätzlich Verlangsamung im Radius 0,7: 50 % Bewegung für 1,5 s | Radius 1,0; 45 % Bewegung für 1,8 s | Radius 1,3; 40 % Bewegung für 2 s |

Frostburst wirkt auf die normalen Ziel-Layer von Cryo und erzeugt nicht weitere Frostbursts.

### 4.2 Stasis (`stasis`)

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Deep Stasis** (Einzelkontrolle) | Stillstand 1,4 s | 1,6 s | 1,8 s; bestehende Immunitäts-/Erholungszeit bleibt 1,5 s |
| **B · Time Field** (größeres Feld) | Pulsradius 1,5 statt 1,3 | 1,7 | 1,9 |
| **C · Temporal Exposure** (Schadensfenster) | Nach Ende der Betäubung 1,5 s lang +10 % eingehender Schaden | 2 s / +15 % | 2,5 s / +20 % |

Temporal Exposure entsteht nur bei tatsächlich erfolgreicher Betäubung und nicht bei immunen Gegnern.

### 4.3 Corrosion (`acid`)

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Superacid** (Verwundbarkeit) | +45 % eingehender Schaden statt +40 % | +50 % | +55 %; normale Effektdauer bleibt 3 s |
| **B · Acid Fog** (breiter Bereich) | Säureradius 1,2 statt 1,0 | 1,4 | 1,6 |
| **C · Armor Dissolver** (Rüstung knacken) | Ziele unter dem Säureeffekt verlieren zusätzlich 10 % ihrer Rüstungsreduktion | 20 % | 30 % |

Armor Dissolver verringert ausschließlich die Rüstungsreduktion, nicht andere Resistenz-Traits. Gilt für Schäden aller Türme am betroffenen Feind, solange der Säurestatus aktiv ist.

### 4.4 Gravitron (`gravity`)

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Reverse Drive** (weiter zurückwerfen) | Rückzugstärke 2,6× eigene Geschwindigkeit statt 2,2× | 3,0× | 3,4× |
| **B · Gravity Well** (größere Gruppe) | Pulsradius 1,6 statt 1,4 | 1,8 | 2,0 |
| **C · Compression** (Schadensfenster) | Nach erfolgreichem Rückzug 2 s lang +10 % eingehender Schaden | 2,5 s / +15 % | 3 s / +20 % |

Die bestehende Pull-Immunität sowie die Resistenz von Berserkern/unstoppable-Einheiten bleiben gültig. Compression entsteht nur bei tatsächlich erfolgreichem Rückzug.

### 4.5 Jammer (`jammer`)

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Wideband** (viele Gegner) | Impulsradius 1,7 statt 1,5 | 1,9 | 2,1 |
| **B · Blackout** (lange Abschaltung) | Störungsdauer 5,2 s statt 4,5 s | 6 s | 7 s |
| **C · Weak Signal** (Kooperationsschaden) | Gestörte Feinde erleiden zusätzlich +8 % Schaden aus allen Quellen | +12 % | +16 % |

Die bisherigen abschaltbaren Traits des Jammers bleiben unverändert, einschließlich Schildbruch.

### 4.6 Snare Net (`net`)

| Pfad | Level 6 | Level 7 | Level 8 |
|---|---|---|---|
| **A · Anchor Net** (sehr langsam) | Eingenetzte Flieger fliegen mit 50 % ihrer Geschwindigkeit statt 60 % | 40 % | 30 %; Dauer bleibt 4,5 s |
| **B · Net Cloud** (mehrere Flieger) | Projektil netzt zusätzlich 1 gültigen Flieger innerhalb 0,7 Feldern ein | 2 zusätzliche im Radius 0,9 | 3 zusätzliche im Radius 1,1 |
| **C · Exposed Target** (Anti-Luft-Synergie) | Eingenetzte Flieger erleiden +10 % Schaden aus allen Quellen | +15 % | +20 % |

Eingenetzte Flieger gelten weiterhin auch als Bodenziele, wie bereits auf Level 5. Net Cloud kann keine Bodengegner einnetzen.

## 5. Kosten und Darstellung

Die Kosten sind zunächst pfadunabhängig. Alle Angaben in Credits.

| Turm | Baukosten | Level 6 | Level 7 | Level 8 | Zusatzkosten Level 6–8 |
|---|---:|---:|---:|---:|---:|
| Pulse | 80 | 200 | 320 | 480 | 1.000 |
| Nova | 130 | 325 | 520 | 780 | 1.625 |
| Cryo | 100 | 250 | 400 | 600 | 1.250 |
| Flak | 90 | 225 | 360 | 540 | 1.125 |
| Tesla | 150 | 375 | 600 | 900 | 1.875 |
| Lance | 170 | 425 | 680 | 1.020 | 2.125 |
| Ember | 120 | 300 | 480 | 720 | 1.500 |
| Stasis | 140 | 350 | 560 | 840 | 1.750 |
| Corrosion | 110 | 275 | 440 | 660 | 1.375 |
| Decay | 160 | 400 | 640 | 960 | 2.000 |
| Focus | 150 | 375 | 600 | 900 | 1.875 |
| Mortar | 160 | 400 | 640 | 960 | 2.000 |
| Quake | 140 | 350 | 560 | 840 | 1.750 |
| Executioner | 150 | 375 | 600 | 900 | 1.875 |
| Shrapnel | 130 | 325 | 520 | 780 | 1.625 |
| Jammer | 130 | 325 | 520 | 780 | 1.625 |
| Snare Net | 110 | 275 | 440 | 660 | 1.375 |
| Gravitron | 170 | 425 | 680 | 1.020 | 2.125 |

### UI/UX

- Unter Level 5 zeigt das Auswahlpanel nur die bekannten verfügbaren Upgrades.
- Auf Level 5 werden drei Pfadkarten nebeneinander angezeigt, jeweils mit Name, taktischer Rolle (z. B. „Boss“, „Schwarm“, „Synergie“), Live-Vorschau, Stufenkosten und **„Weg festlegen“** als Kaufaktion.
- Beim ersten Kauf erscheint ein einmaliger, klarer Hinweis, dass die beiden anderen Pfade gesperrt werden.
- Nach der Wahl zeigt das Panel **nur die gekaufte Linie plus die nächste kaufbare Stufe**; gesperrte Alternativen sind zur Orientierung optional ausgegraut.
- Der Turm erhält pro Weg eine eindeutig erkennbare Farbe und Silhouette/Partikeleffekt. Nicht ausschließlich Farbe zur Pfaderkennung benutzen: Namenskurzform bzw. Symbol ergänzen.
- Tooltips geben **Endwerte statt nur unklarer Prozentzahlen** an. Beispiel: `Lance · Broadbeam II – Strahl-Halbbreite: 0,8 Felder`.
- Levelanzeige ergänzt den Pfadnamen, z. B. `Level 8 · Storm Network`. Die Turmkarte im Baumenü bleibt neutral.
- Solo/Co-op/Versus erhalten dieselben Spielregeln und Preise, sofern Balancing-Tests keinen triftigen Grund für modusspezifische Werte ergeben.



---

## 6. Technischer Ansatz: ein Datenmodell, kein Sonderfall pro Upgrade

### 6.1 Architekturentscheidung (verbindlich)

**Normale Attack-Parameter** (z. B. Tesla-Sprünge, Brand-Faktor, Flächenradius, Exekutionsschwelle) nutzen weiter `effects.attack`; **normale Stats** (`damage`, `range`, `interval`) nutzen `effects.stats`. Die Fähigkeiten, die nicht durch diese Werte abbildbar sind, werden als **eigene, typisierte `effects.specialization`** ergänzt. Dieses Feld wird beim Auflösen wie ein kompletter aktueller Snapshot der gewählten Fähigkeit ersetzt – nicht kumuliert.

Neue Dateien (Vorschlag):

```text
src/content/specializations.ts       # 18 × 3 × 3: benannte, typisierte Daten
src/core/specialization-types.ts     # Discriminated union und Konfigurations-Typen
src/systems/specializations.ts       # gemeinsame Trigger/Filter/Procs ohne Rendercode
src/systems/specializations.test.ts  # Kernmechanik-Tests
src/content/specializations.test.ts  # Vollständigkeit, Preise, Pfad-Verknüpfung
```

Folgende **Kategorien** reichen für die neuen Fähigkeiten. Sie sind als konkrete Union-Varianten oder als klar typisierte Untertypen zu implementieren; der `kind`-String ist hier festgelegt, damit Content und Simulation zusammenpassen:

| `specialization.kind` | Einsatz | Felder (Endwerte pro Stufe) |
|---|---|---|
| `conditional-damage` | Sharpshooter, Skyhunter, Siegebreaker, Bunker Buster, Overload, Searing Heat | `predicate: 'heavy' / 'heavy-air' / 'armored' / 'isolated' / 'burning'`, `bonus:number` |
| `armor-pierce` | Rail Penetrator, Tungsten Shards | `fraction:number` |
| `ricochet` | Pulse C | `every:number, radius:number, factor:number` |
| `extra-air-targets` | Flak B | `count:number, factor:number` |
| `wingclip` | Flak C | `slow:number, duration:number` (`slow` = Geschwindigkeitseinbuße) |
| `twin-arc` | Tesla C | `every:number, factor:number` |
| `chain-reaction` | Nova C | `factor:number, radius:number, maxPerSalvo:number` |
| `wildfire` | Ember B | `remainingFactor:number, radius:number, count:number` |
| `max-hp-execute` | Decay B | `threshold:number, extraPercent:number` |
| `contagion` | Decay C | `count:number, radius:number, maxHpPercent:number, hitCapFactor:number` |
| `focus-carry` | Focus B | `carry:number` |
| `prism-beam` | Focus C | `width:number, factor:number` |
| `fracture` | Quake A | `bonus:number, duration:number` |
| `aftershock` | Quake C | `delay:number, factor:number` |
| `overkill-transfer` | Executioner C | `factor:number, radius:number` |
| `unused-volley` | Shrapnel C | `bonusPerUnused:number` |
| `brittle-ice` | Cryo B | `bonus:number` |
| `frostburst` | Cryo C | `radius:number, factor:number, duration:number` |
| `temporal-exposure` | Stasis C | `bonus:number, duration:number` |
| `armor-dissolver` | Corrosion C | `fraction:number` |
| `compression` | Gravitron C | `bonus:number, duration:number` |
| `weak-signal` | Jammer C | `bonus:number` |
| `net-cloud` | Snare Net B | `radius:number, count:number` |
| `exposed-target` | Snare Net C | `bonus:number` |

**Nur Standard-Overrides, kein Spezialkind nötig:** Pulse Overclock; Nova Supernova; Tesla Storm Network; Lance Longshot/Broadbeam; Ember Incinerator; Decay Entropy Beam; Focus Deep Focus; Mortar Saturation/Mobile Artillery; Quake Resonance; Executioner Hunter's Mark/Guillotine; Shrapnel Scatterstorm; Cryo Permafrost; Stasis Deep Stasis/Time Field; Corrosion Superacid/Acid Fog; Gravitron Reverse Drive/Gravity Well; Jammer Wideband/Blackout; Snare Net Anchor Net. **Für `flak-curtain`/`extra-air-targets` kein globales Upgrade von `volley` am Flak einführen**, sonst wäre dessen `direct`-Angriffsart inhaltlich falsch und alle Salven hätten ungewollt 100-%-Schaden.

### 6.2 Typbeispiel – so erweiterst du `core/types.ts`

**Vorlage, bewusst nur Teilmenge der Union; alle Varianten aus Tabelle 6.1 anschließend ergänzen:**

```ts
// src/core/specialization-types.ts
export type SpecializationSpec =
  | { kind: 'conditional-damage'; predicate: 'heavy' | 'heavy-air' | 'armored' | 'isolated' | 'burning'; bonus: number }
  | { kind: 'armor-pierce'; fraction: number }
  | { kind: 'ricochet'; every: number; radius: number; factor: number }
  | { kind: 'aftershock'; delay: number; factor: number };
  // TODO: übrige Varianten aus Kapitel 6.1 implementieren.

// Ergänzung in src/core/types.ts (Typ importieren):
// UpgradeDefinition.effects.specialization?: SpecializationSpec;
// ResolvedTower.specialization?: Readonly<SpecializationSpec>; // in core/upgrades.ts
// Projectile.specialization?: SpecializationSpec;            // Snapshot bei Abschuss
```

Bei `computeUpgrades` in `src/core/upgrades.ts` eine Variable `let specialization: SpecializationSpec | undefined;` vorsehen. Wenn `upgrade.effects.specialization !== undefined`, die Variable **ersetzen**; im zurückgegebenen `ResolvedTower` als readonly bereitstellen. Für spätere Stufen desselben Pfades gilt: immer die **vollständige** neue Konfiguration übergeben. Bei Standard-Overrides wird `specialization` nicht gelöscht (diese Pfade besitzen ohnehin entweder nur Standard-Overrides oder ihre eigene Spec).

> Kein beliebiges Dictionary `Record<string, any>` verwenden. Ein vergessenes Feld, eine Tippfehler-ID oder ein negativer Radius sollen zur Build-/Validierungszeit auffallen.

### 6.3 Datenformat / IDs / Vollständigkeit

Die verbindliche ID lautet `<path-slug>-<tier>` und der gemeinsame `path` lautet exakt `<path-slug>`. Die Pfad-Slugs sind lowercase kebab-case und pro Tower eindeutig. Diese Namen gelten als API für Replays und Tests.

| Tower-ID | A-Pfad | B-Pfad | C-Pfad |
|---|---|---|---|
| `pulse` | `sharpshooter` | `overclock` | `ricochet` |
| `blast` | `supernova` | `siegebreaker` | `chain-reaction` |
| `flak` | `skyhunter` | `flak-curtain` | `wingclip` |
| `tesla` | `storm-network` | `overload` | `twin-arc` |
| `lance` | `longshot` | `broadbeam` | `rail-penetrator` |
| `inferno` | `incinerator` | `wildfire` | `searing-heat` |
| `decay` | `entropy-beam` | `final-decay` | `contagion` |
| `focus` | `deep-focus` | `adaptive-lens` | `prism-beam` |
| `mortar` | `saturation` | `bunker-buster` | `mobile-artillery` |
| `quake` | `fracture` | `resonance` | `aftershock` |
| `executioner` | `hunters-mark` | `guillotine` | `blood-transfer` |
| `shrapnel` | `scatterstorm` | `tungsten-shards` | `concentrated-volley` |
| `frost` | `permafrost` | `brittle-ice` | `frostburst` |
| `stasis` | `deep-stasis` | `time-field` | `temporal-exposure` |
| `acid` | `superacid` | `acid-fog` | `armor-dissolver` |
| `gravity` | `reverse-drive` | `gravity-well` | `compression` |
| `jammer` | `wideband` | `blackout` | `weak-signal` |
| `net` | `anchor-net` | `net-cloud` | `exposed-target` |

**Vorlage für ein tatsächlich bestehendes `attack`-Feld:**

```ts
const stormNetworkI: UpgradeDefinition = {
  id: 'storm-network-1',
  label: 'Storm Network I',
  description: 'The chain jumps to 6 extra enemies within 2.2 cells.',
  cost: 375,
  path: 'storm-network',
  requires: ['level-5'],
  effects: {
    level: 6,
    attack: { jumps: 6, range: 2.2 },
  },
};
```

Stufe II: `id:'storm-network-2'`, `requires:['storm-network-1']`, `effects.level:7`, `cost:600`, `attack:{jumps:7,range:2.4}`; Stufe III analog Level 8, 900 Credits, 8 Sprünge/Reichweite 2,6. Der Generator macht daraus 9 Definitionen je Tower. **Hinweis:** `attackTower(...)` wird auch für die 18 Attack/Control-Türme verwendet, `trapTower(...)` soll unverändert vier Standard-Upgrades erzeugen.

### 6.4 Bestehender Validator: erforderliche Korrektur

`validateUpgradeDefinitions` lehnt heute eine Voraussetzung mit abweichendem `path` grundsätzlich ab. Die erste Pfadstufe muss aber `level-5` (ohne Pfad) voraussetzen können. Im `visit`-Block nach Prüfung der Voraussetzung an Stelle des bisherigen strikten Vergleichs die folgende Bedingung verwenden:

```ts
const parentPath = definitions.get(prerequisite)!.path;
const childPath = upgrade.path;
if (parentPath && parentPath !== childPath)
  throw new ContentError(`${path} › Upgrade ${id}`, 'Requirement from another path.');
```

Damit sind ein pfadloser Vorläufer → Pfad A erlaubt, Pfad A → Pfad B verboten und Pfad A → pfadlos verboten. IDs, fehlende Vorgänger, Zyklen und positive Kosten weiter validieren. Außerdem `effects.specialization` als gültigen Effekt in die „Upgrade without effect“-Bedingung aufnehmen und jede Union-Variante gegen zulässige Werte testen: `every,count,maxPerSalvo` positive Ganzzahlen, Faktoren endlich und im vorgesehenen Intervall, `radius,delay,duration > 0`, `bonus >= 0`.

**Pflicht-Contenttests:** Jede der 18 Tower-IDs liefert **13 Upgrades** (4 alte + 9 neue), 3 exklusive `path`-Werte und maximal Level 8. Eine Falle liefert weiterhin 4. Aura- und sonstige Support-Türme dürfen nicht verändert werden.

### 6.5 Warum `effects.stats` nicht als relative Multiplikatoren gespeichert werden

Der Resolver verwendet `Object.assign(stats, upgrade.effects.stats)` und erwartet echte Endwerte. Für Overclock beispielsweise: `intervalL5 = base.interval * 0.6` (aus `ATTACK_LEVELS`), dann `intervalL7 = intervalL5 * 0.75`. Schreibe diesen absoluten `interval`-Wert in `effects.stats`, nicht `-0.25` und nicht `0.75`; ein negativer Wert würde sogar am Validator scheitern.

Beispiel Pulse: Basisintervall 0,55 s → Level 5 = 0,33 s → Overclock I = 0,2805 s; II = 0,2475 s; III = 0,2145 s **ohne Aura**. Die Berechnung erfolgt beim Erzeugen der Content-Definitionen. Reichweite und Schaden aus L5 bleiben erhalten, sofern der Pfad sie nicht ändert.

## 7. Laufzeit-Semantik jeder neuen Mechanik

### 7.1 Grundvertrag für alle Effekte

1. **On fire:** Wähle ein Primärziel, löse die bereits berechneten L5-Stats/Angriffsparameter auf, erhöhe bei Bedarf den persistenten **Schusszähler** und speichere Schaden, Angriffsart, Spezialisierung und eventuelle Triggerbits im Projektil.
2. **On impact:** Verwende den bereits gespeicherten Schuss-Snapshot. Berechne bedingte Boni am Gegner zum Einschlagszeitpunkt (HP/Armor/Status können sich inzwischen geändert haben), führe den Haupttreffer aus, sammle das Treffer-/Kill-Ergebnis und führe höchstens die erlaubten Nachtreffer aus.
3. **Instant attacks:** Führe genau dieselbe Wirkung ohne Projektil unmittelbar über das Angriffsmodul aus. Pfadspezifische Laufzeitfelder dürfen weder Aura-Werte doppelt multiplizieren noch Renderzustand abfragen.
4. **Kill credit:** Jeder Sekundärtreffer nutzt als `DamageSource` die ursprüngliche Tower-ID. Bereits verkaufte Türme bekommen kein nachträglich inkrementiertes `tower.kills`, der globale Kill und Reward bleiben aber gültig wie bisher.
5. **Determinismus:** Kandidaten und vorberechnete Sekundärereignisse stabil sortieren, Kopie der Gegnerliste bei AoE verwenden; alle Fälligkeiten und Counters müssen im synchronisierten `GameState` stehen.

### 7.2 Schadens- und Rüstungsregeln (exakte Formeln)

- **Bedingter Bonus:** `rawHit = originalRawHit * (1 + bonus)`. Beispielsweise Sharpshooter III gegen ein schweres Ziel: `rawHit × 1.70`; gegen andere `rawHit × 1`.
- **Gepanzert:** nur falls `armor`-Trait vorhanden; Treffer auf Schilde, `mirror` usw. bleiben durch `applyDamage` geschützt.
- **Armor Pierce:** Für ein ursprüngliches `armor.reduction = r` und Turmpenetration `p` sowie aktiven Armor Dissolver `d` gilt **effektive Rüstungsreduktion** `rEff = r * (1 - p) * (1 - d)`. Ein Treffer mit 50 % Armor, 40 % Pierce und 20 % Dissolver behält `0.5 × 0.6 × 0.8 = 0.24` Reduktion (76 % Schaden nach Rüstung). Hier nie `p + d` addieren.
- **Vulnerable:** `damageTaken(...) = 1 + max(activeVulnerabilityBonuses)`. Eine Corrosion-Wirkung von 40 % und Fracture 20 % ergeben +40 %, **nicht +60 %**.
- **Max-HP-Schaden:** Für Decay gilt `rawHit = towerDamage + effectivePercent * enemy.maxHp`; der Prozentteil geht wie der Rest durch Schild/Armor/Mirror. Final Decay III: unter 55 % HP = `6 % + 2 Prozentpunkte = 8 %`; sonst 6 %. Contagion hat eine **eigene** Deckelung pro Ziel (siehe unten).
- **Statusvorbereitung:** Corrosion, Jammer, Net, Cryo werden gemäß vorhandenen Modulen vor/nach dem Haupttreffer verarbeitet. Alle neuen Status müssen ihre Auswirkung so markieren, dass genau definiert ist, ob bereits der verursachende Treffer profitiert (unten angegeben).

**Konsequenz für `src/systems/traits.ts`:** Armor-Pierce-Parameter gehören in `Hit` bzw. einen minimalen `DamageContext`, **nicht** als Änderung am Gegner-Trait. Der Armor-Trait berechnet seinen Wert anhand von Hit-Penetration und aktivem Dissolver. `applyDamage` darf dafür einen erweiterten Rückgabewert haben, muss aber ältere Aufrufer ohne Änderung ihres Verhaltens unterstützen.

### 7.3 Einzelne Fähigkeitskategorien – exakte Reihenfolge und Randfälle

| Pfad / Effekt | Auslösezeitpunkt und verbindliche Umsetzung |
|---|---|
| **Pulse Ricochet** | Zähle abgefeuerte *gültige* Pulse-Schüsse dieser Turminstanz (1-basiert). Ein Flag am Projektil markiert Schuss `n % every === 0`; nur bei wirklichem Einschlag: einen weiteren lebenden akquirierbaren Gegner im angegebenen Radius **um das getroffene Ziel** wählen, 35/50/65 % des gespeicherten Hauptschadens als einen eigenen Treffer über die Pipeline verursachen. Kein weiteres Ricochet. Bei Verkauf bleibt der markierte Projektil-Proc erhalten. |
| **Nova Chain Reaction** | Nach der Haupt-AoE die in diesem Haupttreffer **getöteten** Gegner in aufsteigender ID sammeln. Für höchstens `maxPerSalvo` Kills jeweils eine Explosion um die Tod-Position, zu `factor × gespeichertem Hauptschaden`, nur erlaubte Layer, keine weitere Chain Reaction und keine weitere `onDeath`-Proc-Auslösung dieser Fähigkeit. Kill-Reihenfolge nicht abhängig von Animationen. |
| **Flak Curtain** | Pro Salve zusätzlich 1/2/3 unterschiedliche akquirierbare Luftgegner aus der gültigen Ziel-Liste in Prioritätsreihenfolge. Jeder erhält einen separaten Treffer mit 45 % des Primärschadens; nicht die Hauptsalve mit 100 % an weitere Gegner kopieren. Projektil-Snapshot je Zusatzziel. |
| **Flak Wingclip** | Nach erfolgreichem Haupttreffer auf lebendes Luftziel eine normale `slow`-Statuswirkung mit Faktor `1 - slow` und Dauer aus Tabellen anwenden. Immunitäten gegen Slow gelten. Verwende beim Nachtreffer ebenfalls keine Triggerkette. |
| **Tesla Overload** | Beim **Auslösen der Salve** genau ein akquirierbarer Gegner innerhalb der aktuellen effektiven Turmreichweite? Dann `1 + bonus` auf die gesamte erste Kette (inkl. Falloff) anwenden. Das `isolated`-Ergebnis für diesen Schuss einfrieren; nachträglich eintreffende Gegner ändern es nicht. |
| **Tesla Twin Arc** | Jede 4./3./2. gültige Salve startet sofort eine zweite unabhängige Kette am besten akquirierbaren, von Kette 1 nicht getroffenen Gegner. Zweitkette hat **L5-Werte** (5 Sprünge, 2,0 Distanz, 0,75 Falloff) und 45/55/65 % des normalen Primärschadens. Gegner darf innerhalb derselben Salve insgesamt nur in einer der zwei Ketten vorkommen. `insulated` verhindert Kettenfortsetzung wie bisher. |
| **Ember Wildfire** | Nur Brände, die von einem Ember mit diesem Pfad erzeugt wurden, besitzen `spread`-Metadaten. Beim Tod des brennenden Ziels: `remainingDamage = max(0, until - time) * dps`. Vergib pro gewähltem Sekundärziel einen Brand mit Gesamtbudget `remainingDamage × remainingFactor` und einer Restdauer `max(BURN_TICK, until - time)`; der Brand wird mit `BURN_TICK` getickt. Sekundärbrand trägt `canSpread:false` und kann keinen weiteren Wildfire auslösen. `heatshield` bleibt immun. |
| **Ember Searing Heat** | Bonus auf den **direkten** Treffer, wenn das Ziel bereits **vor diesem Treffer** einen aktiven `burn`-Status hat; zusätzlicher Burn-DOT wird nicht multipliziert. Der neu verursachte eigene Brand zählt für denselben direkten Treffer nicht. |
| **Decay Contagion** | Beim Haupttreffer bis zu 1/2/3 weitere akquirierbare Ziele im Radius um das Ziel. Rohschaden je Ziel = `min(enemy.maxHp × maxHpPercent, Haupttreffer-Rohschaden × hitCapFactor)`; Armor und Shield wirken danach. Keine weiteren Seuchensprünge. |
| **Focus Adaptive Lens** | Bei Zielwechsel: `newStacks = floor(oldStacks × carry)` als Anfangsstand **vor** dem ersten Treffer auf neues Ziel. Nur echte Haupttreffer bauen Stacks auf; bei unverändertem Ziel bleibt die alte Regel. Kein Stack-Transfer von einem nicht mehr existierenden Turm. |
| **Focus Prism Beam** | Nach Haupttreffer genau einen weiteren Gegner hinter dem Primärziel auf dem Strahl auswählen: Zentrum in Strahlrichtung, seitlicher Abstand `<= width`, positive Projektion hinter Ziel, höchstens effektive Reichweite. `factor × tatsächlich berechneter Focus-Haupttreffer-Rohschaden` als eigener Treffer; der Zweittreffer baut keine Stacks auf. |
| **Quake Fracture** | Erst die ursprüngliche Quake-Welle auf alle gültigen Bodenziele, **danach** `vulnerable` 10/15/20 % für 2/2,5/3 s auf alle lebenden tatsächlich betroffenen Ziele. So profitiert der erste Quake-Treffer **nicht** von seiner gerade selbst gesetzten Schwächung. |
| **Quake Aftershock** | Beim Ursprungs-Puls Position, effektiven Radius, Schadenswert und `Hit(area=true, instant=true)` einfrieren. Genau eine weitere Welle zu `time + 0.35` über 25/40/55 %; **dann lebende** erlaubte Ziele treffen, mit derselben radialen Logik wie Quake L5. Nachbeben darf kein weiteres Nachbeben einplanen. |
| **Executioner Blood Transfer** | Nur wenn der **primäre** direkte Treffer das tatsächliche Hauptziel tötet. Overkill = `max(0, endgültiger Schaden nach Abwehr - HP des Hauptziels vor Treffer)`; erzeugter Transfer-Rohschaden `min(overkill × factor, ursprünglicher Haupttreffer-Rohschaden)`. Ein anderes akquirierbares Ziel im Radius um das getötete Ziel wählen, dort einmal `applyDamage`. Kein Transfer durch sekundäre Kills; 0 Overkill => kein Treffer. Achtung `link`-Trait: nur primäres Opfer löst aus, nicht Gruppennachbarn. |
| **Shrapnel Concentrated Volley** | Berechne `unused = max(0, 5 - tatsächliche Anzahl verschiedener in dieser Salve angegriffener Ziele)` **auf Basis der fünf L5-Basisprojektile**. Primärziel bekommt genau **einen** zusätzlichen Schadenshit `unused × bonusPerUnused × primärer Rohschaden`, solange es bei Einschlag noch lebt; der ursprüngliche Haupttreffer bleibt unverändert. Mehrere ungenutzte Splitter bedeuten nicht mehrere Armor-/Mirror-Procs. |
| **Cryo Brittle Ice** | Nach **erfolgreich** angewandter Cryo-Verlangsamung zusätzlich `vulnerable` +8/12/16 % mit gleicher Endzeit setzen. Immunität gegen `slow` => **kein** Brittle-Ice-Bonus. Schwächung bleibt bis zur regulären Status-Endzeit, auch wenn ein anderer Turm danach einen stärkeren Slow setzt. |
| **Cryo Frostburst** | Primärtreffer wie normal; beim Einschlag einmal zusätzliche `slow`-Zone um Primärziel (0,7/1,0/1,3). Andere gültige Ziele darin nur verlangsamen, **kein** zusätzlicher Cryo-Direktschaden. Faktor 0,50/0,45/0,40 und 1,5/1,8/2,0 s; Slow-Immunität beachten. |
| **Stasis Temporal Exposure** | Nur falls die Stun-Applikation **wirklich erfolgreich** war: im Stun-Status einmalige pending-Exposure speichern; wenn `time >= release`, `vulnerable` +10/15/20 % für 1,5/2/2,5 s vergeben, pending entfernen. Nicht schon beim Aufschlag. Resistente oder während Recovery immune Ziele bekommen keine Exposure. |
| **Corrosion Armor Dissolver** | Zusammen mit erfolgreichem Corrosion-Puls vor dem Eigenschaden `armorDissolved`-Status mit `fraction` 0,10/0,20/0,30 für dieselben 3 s setzen. Alle Türme profitieren. Bei Gegnern ohne Armor ist der Status wirkungslos (optional trotzdem anzeigbar). Nur stärkster Dissolver aktiv. |
| **Gravitron Compression** | Nach **erfolgreichem** Pull-Status beim Ziel sofort `vulnerable` +10/15/20 % für 2/2,5/3 s setzen. Stun-/Pull-Immunität und Recovery lassen Compression nicht entstehen. |
| **Jammer Weak Signal** | Nach erfolgreichem Jammer-Status, vor dessen eigener Schadenberechnung `vulnerable` +8/12/16 % mit gleicher Dauer wie `disrupted` setzen. Stärkste Vulnerability zählt. |
| **Snare Net Cloud** | Wenn primäres Netz trifft, 1/2/3 **andere** erlaubte Flieger im Umkreis 0,7/0,9/1,1 mit demselben netted-Faktor und derselben Restdauer einfangen; Nebenziele erleiden **keinen** zusätzlichen direkten Net-Schaden. |
| **Snare Net Exposed Target** | Wenn ein neuer Net-Status wirksam ist, zusätzlich `vulnerable` +10/15/20 % bis zu dessen Ablauf setzen. Es gilt auch für Schaden durch fremde Türme. |

**Regeln für Folgeeffekte:** Die Triggerauswertung liegt nach oder vor dem `applyDamage(...)`-Aufruf wie oben ausdrücklich definiert. Falls ein bestehendes Angriffsmodul `void` zurückgibt, genügt nicht „nachher `e.hp <= 0` prüfen“: wegen Link/Schutz/Split braucht `applyDamage` eine sichere Kill-/HP-Differenz-Rückgabe oder das Modul muss ein entsprechendes Ergebnis sammeln. Alte Aufrufer dürfen Rückgabewerte ignorieren.

### 7.4 Status-Änderungen: Implementierungsschema

Eine mögliche sichere Typ-Erweiterung ist:

```ts
// Skizze in StatusEffect union, exakt ins bestehende Schema integrieren:
| { kind: 'armorDissolved'; fraction: number; until: number }
// Stun kann optionale einmalige Folgeaktion bekommen:
// exposure?: { bonus: number; duration: number; pending: boolean }
```

`STATUSES` in `src/systems/status.ts` um `armorDissolved` ergänzen (`merge: strongest(s => s.fraction)`). `damageTaken` bleibt auf `vulnerable` beschränkt; in `traits.ts` gibt es einen eigenen Helfer `armorDissolvedFraction(enemy,time)`, der den stärksten aktiven Wert liefert. Für die Stun-Folgeaktion einen dedizierten Tick-Hook oder eine spezielle Funktion `tickTemporalExposure` innerhalb des Statussystems hinzufügen. Die eigene `stun`-Anwendung muss vor dem Statusaufruf zuverlässig ermitteln können, ob eine echte neue Stun-Wirkung gesetzt wurde; dafür kann `applyStatus` einen booleschen Rückgabewert `applied` erhalten. **Wichtig:** „Merge abgelehnt“ ist kein Erfolg.

`wildfire` benötigt optionale Burn-Metadaten, ohne die existierenden Brände zu verändern. Verwende zusätzliche Felder **nur bei Wildfire-Bränden**, damit bestehende State-Hashes/Replays auf Missionen ohne neue Pfade unverändert bleiben. Werte beim Status-Merge ausdrücklich testen, wenn zwei Ember-Türme verschiedene Stärken haben.

### 7.5 Projektil-Snapshots, Schusszähler und spätere Ereignisse

- Ergänze `Projectile.specialization?: SpecializationSpec` und `Projectile.specialTrigger?: boolean` (oder ähnlich). Direkt beim Abschuss kopieren; **nicht** am Einschlag über den eventuell inzwischen verkauften Turm neu auflösen.
- Für Ricochet/Twin Arc einen `Tower.specialShots?: number` speichern. Erst wenn ein gültiger Schuss bzw. eine gültige Salve wirklich gestartet wird, auf +1 setzen; der erste auslösende Schuss ist `specialShots === every`. Für Tesla wird je **Salve**, nicht je Kettensprung gezählt. Für Pulse je abgefeuertem Hauptprojektil. Wenn ein markiertes Projektil keinen gültigen Treffer mehr erzielt, verfällt der Proc; die Zählung bleibt erhalten.
- Für Aftershock optional `GameState.pendingSpecialHits?: PendingSpecialHit[]` (mit `due`, `originShotId`, `source`, `point`, `damage`, `radius`, `hitFlags`, `specializationSnapshot`). Eingetragen **beim Primär-Puls**, abgearbeitet deterministisch **einmal je Tick vor dem nächsten Angriffsdurchlauf**. In `stateHash` jede ausstehende Impact-ID, Fälligkeit, Position, Radius und Schaden einbeziehen (nur bei vorhandener Queue, damit alte Goldens ohne neue Upgrades unverändert bleiben).
- `stateHash` außerdem um `specialShots` erweitern, **nur wenn definiert**. Multi-Client-Simulation vergleicht dadurch auch die Proc-Zähler. Ein korrektes Netzwerkereignis darf keinen unsichtbaren oder nicht gehashten Zufallszustand benötigen.

### 7.6 Schadenspipeline – Beispiel für kleine Rückgabe

Die folgende Signatur ist **Pseudocode**, nicht einsatzbereiter Drop-in-Patch. Sie macht die gewünschten Informationen für Blood Transfer und Chain Reaction deutlich:

```ts
type DamageOutcome = {
  enemyId: number;
  hpBefore: number;
  hpAfter: number;
  effectiveDamage: number; // nach Status, Schild und Traits
  killed: boolean;
  overkill: number;       // max(0, effectiveDamage - hpBefore)
};

// Für die Link-Gruppe liefert der Wrapper ein Array; bisherige Aufrufer
// dürfen das Ergebnis weiter ignorieren.
function applyDamage(/* existing args */): readonly DamageOutcome[] { /* ... */ }
```

Für `shield` und `evade` muss `effectiveDamage` der **tatsächlich auf HP durchkommende** Wert nach Abwehr sein; ein vollständig absorbierter Schuss erzeugt keinen Overkill. Im `link`-Fall bleiben alle Gruppenmitglieder ein eigenes Outcome; den primären `enemyId` separat prüfen. Das **existierende** Verhalten von Belohnung, Ereignissen und Killzähler unverändert lassen.

## 8. Konkrete Änderungen an UI, UX und Darstellung

### 8.1 Zustände des Upgrade-Panels

| Tower-Zustand | Darstellung | Klickverhalten |
|---|---|---|
| Level 1–4 | Nur nächste Level-2–5-Option | wie bisher |
| Level 5, noch ohne Pfad | Drei gleichwertige Karten A/B/C mit Namen, Rolle, Kosten von Stufe I, Vorschau, optischer Kennung und eindeutigem Hinweis „Locks the other two paths“ | Ein Kauf von Stufe I legt Pfad fest |
| Pfad gewählt, Level 6 | `PATH <Name> · Level 6 / 8`; Button für Stufe II und Preis | kauft nur `<slug>-2` |
| Pfad gewählt, Level 7 | Pfadname, Button für Stufe III | kauft nur `<slug>-3` |
| Level 8 | `Level 8 / 8 · <Name>`, Hinweis „Max level“ | kein Upgrade mehr |
| Credits zu niedrig | Kauftaste deaktiviert, echter Betrag weiterhin sichtbar | `upgradeOption` meldet `unaffordable` |
| Fremder Tower in Co-op | keine Kaufaktion, lesbare Stats/Pfadname | Simulationskommando wird abgelehnt |

`upgradeControl` in `src/ui/upgrade-tooltip.ts` blendet heute alle gekauften normalen Level teilweise noch ein und verbirgt `locked`-Optionen. Daher **nicht nur den neun Einträgen vertrauen**: Für Attack-/Control-Türme einen eigenen **View-Filter** einbauen: vor L5 nur nächsten normalen Schritt; auf L5 drei Stufe-I-Karten; nach Pfadwahl nächste Stufe (optional bisher gekaufte Stufe als Status), alle Alternativen nicht klickbar. Die Aura-Darstellung bleibt unverändert.

### 8.2 Tooltips und Vorschau

- **Englisch**, wie der restliche Spielcode. In der Beschreibung `Sharpshooter I – +25% damage against heavy targets` statt nur `Upgrade`.
- Vorschau aus `previewUpgrade` und `resolveUpgrades` liest **auch** `specialization` und zeigt Änderung `before → after`. Für reine Proc-Effekte die veränderten Sonderparameter darstellen (z. B. `Ricochet: every 4th shot, 35%, 1.3 cells`).
- Aura-Boni in bestehenden Stats einbeziehen, aber nicht doppelt; die Beschreibung erläutert, ob ein Wert L5-Basis oder aktueller Effektivwert ist.
- Für Smartphones Karten untereinander, für Desktop in drei Spalten. Vollständig per Keyboard/Fokus bedienbar, Touch-Info-Knopf bleibt getrennt vom Kaufknopf.
- Farben & Symbole nach jedem Pfad eindeutig. Die bereits definierte `TowerVisual.paths`-Form (`color`, `motif` mit `blades`/`vortex`/`rings`) nutzen. Als **Default-Vorschlag für alle Türme:** A `0xff765c/blades`, B `0x66b6ff/vortex`, C `0x79e3a1/rings`; spätere Art-Pässe dürfen pro Turm differenzieren. Pfadname ist neben Farbe sichtbar.

### 8.3 VFX – Leistungs- und Qualitätsgrenzen

Primäres Ziel: Feedback ohne Simulationsänderung. Für Kettensprünge vorhandenes `chain`-Event nutzen, für neue AoE `pulse`, für Strahlen `beam` und für Geschoss-Treffer `impact`. Zusätzliche Assets sind nicht Voraussetzung für den ersten Merge. Bonus-Effekte sollen maximal **ein optisches Ereignis je beteiligtem sekundären Ziel** erzeugen; Rendering darf kein neues `applyDamage` auslösen. Teste 10 voll spezialisierte Mehrziel-Türme gleichzeitig ohne störendes VFX-Spamming.

## 9. Junior-Developer-Runbook: Schritt für Schritt

### Schritt 0 – Projekt lokal starten (noch keine Codeänderung)

```bash
git clone https://github.com/chiefblub2/ion-bastion.git
cd ion-bastion
npm ci
npm test
npm run build
npm run dev
```

Erwartung: Node.js **22+**, Game unter `http://localhost:4173`. Die bestehende Testbaseline muss grün sein; andernfalls die Ursache vor Feature-Code im Ticket dokumentieren.

### Schritt 1 – nur Content-Modell und Pfade ohne neue Spezialeffekte

1. Branch `feature/tower-specializations` erstellen.
2. `SpecializationSpec` und `effects.specialization` als optionales Feld typisieren. Ein kleiner erster Union-Fall genügt, danach schrittweise erweitern.
3. `validateUpgradeDefinitions` gemäß 6.4 so ändern, dass `level-5` der Startpunkt eines Pfads sein kann; Tests für zulässige und unzulässige Abhängigkeiten schreiben.
4. `src/content/specializations.ts` mit der Datenstruktur für alle 54 Pfade anlegen. Generator schreibt IDs, Path, Kosten und Requires. Um inhaltlich nicht von 162 Handkopien abhängig zu werden, drei Tier-Zeilen pro Pfad deklarieren, Generator bauen.
5. `attackTower` um **zusätzliche** Upgrade-Liste erweitern; **nicht** `trapTower`. Falls `attackTower` aktuell keine Tower-ID-Typen zur Verfügung stellt, ist `definition.id` der Lookup-Schlüssel. Optional `attackUpgrades` bleibt unverändert und der Wrapper returnt `[...attackUpgrades(...), ...specializationUpgrades(...)]`.
6. `resolveUpgrades` erweitert auf optionales Specialization-Ergebnis. Mindestens für Tesla Storm Network (einfacher `attack`-Override) end-to-end grüne Tests herstellen.
7. Alle 18 `visual.paths` hinzufügen. Content-Validierung muss auch `path`↔`visual.paths` prüfen.

**Definition dieses Schritts:** keine veränderte Kampflogik ohne Level-6+-Kauf, jeder spezialisierbare Turm hat 13 Definitionen, erste Pfadstufe kann gekauft werden, der andere Pfad ist ausgeschlossen.

### Schritt 2 – Upgrade-Menü und Kaufzustände

1. UI für Level 1–4 / Level 5 / gewählten Pfad / Level 8 anhand Tabelle 8.1 ausgeben; `data-upgrade` enthält die echte Upgrade-ID.
2. Pfad wird **durch den Kauf** festgelegt – keine zusätzliche rein lokale „Ausgewählt“-Variable.
3. `towerDetails` zeigt statt bloß `LEVEL 6 / 8` den Pfadnamen. Tooltips aus den echten Daten generieren, gekaufte Stufen nicht mehrfach als Buttons darstellen.
4. Im geöffneten UI nach erfolgreichem Kauf neu rendern. Fehlversuch wegen fehlender Credits oder Fremdturm darf nichts verändern.

**Definition dieses Schritts:** Gameplay-UI zeigt exakt drei Pfade bei L5, danach nur einen, und die Simulationsprüfung schützt vor illegalen direkten Upgrade-Befehlen.

### Schritt 3 – Standardmechaniken zuerst (ohne neue Laufzeitsysteme)

Implementiere und teste in dieser Reihenfolge: Tesla Storm Network → Nova Supernova → Mortar Saturation → Stasis Time Field → Cryo Permafrost → Shrapnel Scatterstorm → Ember Incinerator → Lance Longshot/Broadbeam → Executioner Hunter's Mark/Guillotine → übrige reine `attack`-Overrides → Intervall-/Reichweiten-Upgrades. Dadurch lernst du den vorhandenen Code und überprüfst die Content-Pipeline, bevor komplexe Procs hinzukommen.

### Schritt 4 – bedingte Treffer, Rüstung, Status

1. `conditional-damage` mit Test für `heavy`, `heavy-air`, `armored`, `isolated`, `burning` implementieren. Isoliertheit am Abschuss prüfen, restliche Eigenschaften beim Einschlag.
2. `armor-pierce` und `armorDissolved` in Damage/Traits ergänzen; Testmatrix gegen Rüstung + Schild + Mirror.
3. `wingclip`, `brittle-ice`, `frostburst`, `compression`, `weak-signal`, `exposed-target`, `temporal-exposure` implementieren. `applyStatus`-Erfolg korrekt erkennen; Statuskombinationen testen.
4. Focus Adaptive Lens und Prism Beam ergänzen; Stacks und Zielwechsel testen.

### Schritt 5 – Mehrfachtreffer, Procs und Timer

1. Persistent `specialShots` mit `stateHash` und Projektil-Snapshot einführen.
2. Pulse Ricochet, Flak Curtain, Tesla Twin Arc, Decay Contagion, Snare Net Cloud und Shrapnel Concentrated Volley umsetzen.
3. `DamageOutcome` für Kill-bedingte Mechaniken ergänzen; Chain Reaction und Blood Transfer implementieren.
4. Wildfire mit Burn-Status-Metadaten und Aftershock mit einmaliger simulierter Queue einbauen.
5. Pro neue Fähigkeit mindestens einen isolierten Test, einen Schutz-Trait-Test und einen deterministischen Zwei-Simulations-Test.

### Schritt 6 – Endabnahme und Balancing

Tests, TypeScript-Build, Golden-Replays, echte Missionen und Co-op/Race/Siege durchlaufen. VFX und Tooltips prüfen, Dokumentation aktualisieren, den PR anhand der Akzeptanzkriterien aus Kapitel 12 reviewen. **Nicht** alle 162 Upgradeeffekte in einem ungeprüften Commit landen lassen; kleine nachvollziehbare Commits erleichtern Reviews.

## 10. Testplan mit konkreten Testfällen

### 10.1 Content- und Kauf-Tests (automatisiert)

| ID | Setup | Erwartung |
|---|---|---|
| T-001 | Jeder der 18 Tower direkt nach Bau | 4 bestehende normale + 9 neue Upgrades, drei Pfade, gültige IDs/Kosten |
| T-002 | `pulse`, `upgrades=['level-2','level-3','level-4']` | `ricochet-1` = `locked` |
| T-003 | Dasselbe plus `'level-5'`, genügend Credits | Drei `*-1` = `available` |
| T-004 | Nach Kauf `ricochet-1` | `sharpshooter-1` und `overclock-1` = `excluded`, auch direkt über Kommando |
| T-005 | `ricochet-2` vor `ricochet-1` | `locked`; nach Stufe I kaufbar |
| T-006 | `ricochet-3` nach Stufe II | Level 8; keine weiteren verfügbaren Optionen |
| T-007 | Genug Credits, `pulse` von L5 auf L6 | Wallet sinkt um 200; `tower.spent` steigt um 200 |
| T-008 | `pulse` alle neuen Stufen gekauft | 1.000 Zusatz-Credits ausgegeben; 70-%-Rückerstattung auf **gesamten** Wert gemäß `sellValue` |
| T-009 | Aura/Refinery/Falle | Definitionen, Level und Pfade exakt wie vorher |
| T-010 | Content mit Pfad A→B-Voraussetzung oder Zyklus | Validator wirft `ContentError` mit nachvollziehbarem Pfad |
| T-011 | Gegnerprojektile in Flugzeit, Tower wird vor Einschlag verkauft | Projektil wirkt mit alter Spezialisierungs-Snapshot, keine Exception |
| T-012 | Co-op: Spieler B kauft an Tower von A | Command wird abgelehnt; Wallet/Upgrades bleiben identisch |

### 10.2 Mechanik-Testmatrix (automatisiert)

| ID | Testaufbau | Exakte Aussage |
|---|---|---|
| M-001 | Pulse Overclock II, Basisintervall 0,55 | Effektives Intervall ohne Aura 0,2475 s |
| M-002 | Tesla Storm Network III | Bis 8 zusätzliche Sprünge, Reichweite pro Sprung 2,6; `insulated` stoppt unverändert |
| M-003 | `armor.reduction=0.5`, Rail Penetrator II `p=0.4` | Vor übrigen Traits Reduktion = 0,30 |
| M-004 | M-003 + Armor Dissolver II `d=0.2` | Reduktion = 0,24 |
| M-005 | 1000 maxHP, Decay Final Decay III bei 549 aktuellen HP | Zusatzanteil = 80 Rohschaden; bei exakt 550 HP = 60 |
| M-006 | Executioner Hunter's Mark III bei exakt 50 % HP | Kein Exekutionsbonus; unter 50 % exakt 5× |
| M-007 | Pulse Ricochet II, 3 volle gültige Schüsse | Genau auf Schuss 3 ein Nachtreffer, kein Nachtreffer bei 1/2 |
| M-008 | Flak Curtain III, vier weitere Luftziele | Maximal 3 zusätzliche Treffer mit je 45 % Rohschaden |
| M-009 | Nova Chain Reaction III, zehn Kills in der Primär-Explosion | Höchstens drei Folgeexplosionen; sekundäre Kills erzeugen keine neuen |
| M-010 | Quake Aftershock II | Genau eine Welle nach frühestens 0,35 s mit 40 % des gespeicherten Hauptschadens |
| M-011 | Wildfire I, Brand mit dps 20 und noch 2,0 s | Ausbreitungs-Budget = 16 Schaden (=20×2×0,40) je Ziel |
| M-012 | Cryo Brittle Ice auf `slowImmune` | Weder neuer Slow noch Brittle-Ice-Vulnerable |
| M-013 | Stasis Temporal Exposure II | +15 % für 2,0 s beginnt erst **nach** erfolgreichem Stun-Ende |
| M-014 | `vulnerable 0.40` und Weak Signal III `0.16` | Gesamte Vulnerability weiterhin 0.40, nicht 0.56 |
| M-015 | Shrapnel Concentrated Volley III nur 1 Ziel | `unused=4`, zusätzlicher Treffer=2× Primärrohschaden; insgesamt 3× vor Trait-Abwehr |
| M-016 | Gravitron Compression mit `unstoppable` | Keine Compression, Pull wird abgelehnt |
| M-017 | Snare Net Cloud auf drei Flieger | Sekundärziele erhalten nur Net-Status, keinen Extra-Direktschaden |
| M-018 | Mirror+Link+Shield gegen Blood Transfer | Nur realer Primärkill mit realem Overkill erzeugt Transfer, keine Rekursion |
| M-019 | 2 identische Game-States, gleiche Befehle/ticks | Identische `stateHash`-Reihe inkl. neuer Zähler, Projektile, Timer |
| M-020 | Level-5-Turm ohne neuen Pfad auf Goldenen Replays | Ergebnis und `stateHash` gleich wie vor Feature |

### 10.3 Konkretes Vitest-Beispiel (Vorlage)

Die folgenden Tests müssen an die bestehenden Test-Factorys im Repo angepasst werden; insbesondere nicht die komplette `GameState`-Struktur selbst fälschen, wenn es bereits Fixtures gibt.

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONTENT } from '../content';
import { upgradeOption, resolveUpgrades } from './upgrades';

describe('attack tower specializations', () => {
  it('unlocks all three first tiers after level five', () => {
    const tower = {
      type: 'pulse' as const,
      upgrades: ['level-2', 'level-3', 'level-4', 'level-5'],
    };
    for (const id of ['sharpshooter-1', 'overclock-1', 'ricochet-1']) {
      expect(upgradeOption(tower, id, Infinity, DEFAULT_CONTENT).status).toBe('available');
    }
  });

  it('excludes the two other paths after choosing one', () => {
    const tower = {
      type: 'pulse' as const,
      upgrades: ['level-2', 'level-3', 'level-4', 'level-5', 'ricochet-1'],
    };
    expect(upgradeOption(tower, 'sharpshooter-1', Infinity, DEFAULT_CONTENT).status).toBe('excluded');
    expect(resolveUpgrades(tower, DEFAULT_CONTENT).level).toBe(6);
  });
});
```

### 10.4 Manuelle Abnahme

- Maus, Tastatur (`Tab`, `Enter`, `Esc`) und Touch: Die drei Pfade sind ab Level 5 sichtbar, kaufbar und erklärbar. Kein versehentlicher Kauf beim Öffnen des Tooltips.
- Level-4-Turm zeigt keine nutzbare Spezialisierung; Level-8-Turm zeigt „Max level“. Namen, Effekttexte, Tooltips und Level stimmen überein.
- Visuals: Ohne Pfad normale Turmoptik, mit Pfad eindeutiges Motiv + Textlabel. Screenreader-Name enthält Pfad und Level.
- Multiplayer mit zwei Clients: derselbe Kauf wird nur einmal ausgeführt, unerlaubter Fremdkauf führt zu keinen Divergenzen; Verkauf während eines fliegenden Spezialprojektils funktioniert.
- Performance mit mindestens 10 stark spezialisieren AoE/Chain-Türmen und >50 Gegnern: keine sichtbaren Hänger, keine Explosionen ohne feste Rekursionsgrenzen.
- Siege/Race/Circuit sowie Kampagnenmissionen mit `mirror`, `blastproof`, `insulated`, `heatshield`, `slowImmune`, `unstoppable`, `taunt`, `burrow`, `cloakField` durchführen.

**Offizielle Abschlussbefehle laut Repository:**

```bash
npm test
npm run test:full
npm run build
npx vitest run src/core/replay
npx vite-node scripts/snapshot-diff.ts -- --expect ""
```

`--expect ""` setzt voraus, dass die Tests **ohne Spezialkäufe** unveränderte Replay-Ergebnisse erzeugen. Sollten Golden-Replays bewusst Feature-Käufe enthalten, deren Änderungen separat prüfen und nur begründet Erwartungen anpassen. Goldens nie blind mit `-u` überschreiben.

## 11. Fehlerbehandlung und offene technische Entscheidungen

| Situation | Vorgabe |
|---|---|
| Kauf-ID existiert nicht | `upgrade-unknown`, keine Wallet-/Stateänderung |
| Stufe ohne Vorstufe | `upgrade-locked`, keine Änderungen |
| Alternative nach Pfadfestlegung | `upgrade-excluded`, keine Änderungen |
| Upgrade zu teuer | `upgrade-unaffordable`, Preis angezeigt, keine Änderungen |
| Turm wurde während der Flugzeit verkauft | Projektil bleibt gültig, Snapshots wirken, Tower-Statistik nicht nachträglich mutieren |
| Gegner stirbt vor Sekundärtreffer | Kein Treffer auf totes Ziel; ggf. nächstes gültiges Ziel wählen, sonst Proc verfällt |
| Status immun | Keine daran gekoppelte Vulnerability (Brittle Ice, Temporal Exposure, Compression etc.) |
| Zwei Treffer im selben Tick | Festgelegte Aufrufreihenfolge und ID-Sortierung, keine zufällige Iteration |
| Sehr viele AoE-Kills | `maxPerSalvo` strikt, keine rekursive Folgeauslösung |
| Mehrere Auren | Existierende Aura-Berechnung unverändert, nur auf den aktuellen Turmbasiswert |
| `Math.random` / Animationstimer | Nicht in Gameplay-Mechaniken erlaubt |
| Neue Union-Kombination versehentlich ungültig | Content-Validation wirft vor Spielstart nachvollziehbaren Fehler |

**Offene Entscheidungen für spätere Balance-Iteration (nicht als Blocker der ersten Implementierung):** Wie stark die Pfade gegenüber dem Bau weiterer Türme sein dürfen und ob Kosten nach Simulation angepasst werden müssen. **Bereits festgelegt und nicht offen** sind alle Zahlen, Maximalzahlen, Triggerbedingungen, Statusmerge-Regeln, Ziel- und Layerfilter in diesem Dokument.

## 12. Abnahmekriterien / Definition of Done

Das Feature ist nur dann **fertig**, wenn **alle** folgenden Punkte erfüllt sind:

- [ ] 18 Angriffstürme und Control-Angriffstürme besitzen je 3 Pfade × 3 Stufen; exakt **162 neue Definitionen**.
- [ ] Normale Level 2–5 und nicht betroffene Türme/Fallen sind in den Daten und im Verhalten unverändert.
- [ ] `level-5` schaltet exakt 3 Stufe-I-Upgrades frei. Kauf von A sperrt B/C – auch über direkte Commands und Multiplayer.
- [ ] Stufe I/II/III ergeben Level 6/7/8; Level 9 ist nicht möglich. Kosten, `spent`, Wallet und Rückerstattung stimmen.
- [ ] Jede in Kapitel 3–4 beschriebene Spezialisierung hat **tatsächlich** wirksame Spielmechanik (kein bloßer Tooltip).
- [ ] Spezialfähigkeit-Werte sind Endwerte je Stufe, nicht versehentlich multiplikativ gestapelt. Aura wird nur einmal berücksichtigt.
- [ ] Projektil-Snapshots, Sell-Edge-Cases, Trigger-Counters und Aftershock-Timer sind deterministisch und Teil des State-Hashes.
- [ ] Schaden, Schilde, Mirror, Armor, Link, Immunität, Tarnung, Ground/Air und Taunt entsprechen Kapitel 2 und 7.
- [ ] UI zeigt richtige Pfadwahl, verständliche englische Tooltips und Level, funktioniert via Touch/Tastatur.
- [ ] Jeder Spezialpfad hat einen sichtbaren Pfadindikator; VFX sind rein visuell.
- [ ] Alle relevanten neuen Unit-/Integrationstests bestehen, `npm run test:full` und `npm run build` sind grün.
- [ ] Bestehende Golden-Replays ohne Spezialisierung bleiben unverändert; Co-op und Versus verlieren keine Synchronität.
- [ ] `README.md` und interne Notizen/Tooltiptexte sind aktualisiert; alle Code-Kommentare sind Englisch.

## 13. Vorgeschlagene Tickets und Reihenfolge für Code-Reviews

| Ticket | Inhalt | Zielzustand / sichtbare Lieferung | Abhängigkeit |
|---|---|---|---|
| **IB-01** | Upgrade-Typ, Generator, Slugs, Validator | 13 Upgrades je Angriffsturm, Pfad A/B/C rechtsgültig | – |
| **IB-02** | Level-5-Pfadauswahl in UI | drei Karten, gekaufter Pfad/Level 8 | IB-01 |
| **IB-03** | Standardwerte/-Parameter | alle nur datenbasierten Pfade wirken | IB-01 |
| **IB-04** | Bedingter Schaden / Armor | Heavy/Armor/Burning/Isolated + Penetration | IB-01 |
| **IB-05** | Erweiterte Status / Immunität | Wingclip, Brittle, Exposure, Compression etc. | IB-04 |
| **IB-06** | Extra-/Sekundärtreffer + Snapshot | Ricochet, Curtain, Twin Arc, Contagion etc. | IB-01,04 |
| **IB-07** | Kill-Feedback + Scheduler | Chain Reaction, Wildfire, Blood Transfer, Aftershock | IB-06 |
| **IB-08** | VFX/Tooltips/Accessibility | sichtbare, verständliche Pfade | IB-02–07 |
| **IB-09** | Balance / Regression / Multiplayer | grüne Gates und Spieltests | IB-01–08 |

**Empfohlene PR-Größe:** erst Framework + ein einfacher Beispielpfad, danach jeweils 2–4 Mechanikfamilien. In jedem PR Screenshots nur für UI, Tests für Simulation und eine kurze Liste der geänderten Dateien beilegen. Das verringert das Fehlerrisiko für weniger erfahrene Entwickler deutlich.

## 14. Anhang: Originalquellen und Code-Navigation

- [Repository / README](https://github.com/chiefblub2/ion-bastion)
- [Architektur und Projektregeln (`CLAUDE.md`)](https://github.com/chiefblub2/ion-bastion/blob/main/CLAUDE.md)
- [`src/content/upgrades.ts`](https://github.com/chiefblub2/ion-bastion/blob/main/src/content/upgrades.ts)
- [`src/content/towers.ts`](https://github.com/chiefblub2/ion-bastion/blob/main/src/content/towers.ts)
- [`src/core/types.ts`](https://github.com/chiefblub2/ion-bastion/blob/main/src/core/types.ts)
- [`src/core/upgrades.ts`](https://github.com/chiefblub2/ion-bastion/blob/main/src/core/upgrades.ts)
- [`src/systems/combat.ts`](https://github.com/chiefblub2/ion-bastion/blob/main/src/systems/combat.ts)
- [`src/systems/damage.ts`](https://github.com/chiefblub2/ion-bastion/blob/main/src/systems/damage.ts)
- [`src/systems/status.ts`](https://github.com/chiefblub2/ion-bastion/blob/main/src/systems/status.ts)
- [`src/core/hash.ts`](https://github.com/chiefblub2/ion-bastion/blob/main/src/core/hash.ts)
- [`src/ui/upgrade-tooltip.ts`](https://github.com/chiefblub2/ion-bastion/blob/main/src/ui/upgrade-tooltip.ts)

**Versionsdisziplin:** Bevor Implementierungsarbeit beginnt, den Git-SHA von `main` notieren und diese Spezifikation bei Abweichungen anpassen. Dieses Dokument wurde anhand der am 10.10.2026 öffentlich sichtbaren Repository-Dateien erstellt, nicht anhand eines lokalen `git clone`; daher keine Zusicherung, dass zukünftige Branch- oder Commit-Versionen dieselben Interfaces besitzen.
