# ION BASTION

Tower-Defense im Browser, gebaut mit TypeScript, Phaser 3 und Vite. 43 Missionen in neun Sektoren mit eigenen Maps, Wellen und Terrain-Stilen, über dreißig Türme und neunzehn Gegnertypen am Boden und in der Luft. Allein spielbar oder mit 2–4 Spielern im Koop- oder Versus-Modus.

Das Spiel läuft komplett im Browser; nur der Mehrspieler braucht einen kleinen Relay-Server. Spielstände liegen bewusst nur im Arbeitsspeicher: Neuladen startet eine neue Mission.

## Schnellstart

Voraussetzung: Node.js 22 oder neuer.

```sh
npm ci
npm run dev      # Spiel auf http://localhost:4173
npm test         # Tests
npm run build    # Produktionsbuild nach dist/
```

Hinweise für Entwickler und KI-Agenten (Architektur, Konventionen, Inhalte ergänzen) stehen in [CLAUDE.md](CLAUDE.md).

## Spielprinzip

Gegner laufen einen festen Pfad entlang zum Reaktor. Erreicht einer den Reaktor, kostet das Reaktorenergie; bei 0 ist die Mission verloren. Zwischen den Wellen baust du Türme neben dem Pfad und verbesserst sie. Besiegte Gegner bringen Credits, jede überstandene Welle einen Bonus. Ein Verkauf erstattet 70 % der gesamten Investition.

## Bedienung

`http://localhost:4173/?mission=<id>` öffnet eine Mission direkt, zum Beispiel `?mission=korallengraben`.

| Eingabe | Aktion |
| --- | --- |
| Turm wählen, freies Feld anklicken | Bauen. Danach endet der Baumodus; Shift+Klick baut weitere Türme desselben Typs. |
| Gebauten Turm anklicken | Verbessern, verkaufen oder Zielpriorität wählen |
| Gegner anklicken | Lebenspunkte, Schild, Eigenschaften und aktive Effekte anzeigen |
| `T` | Zielpriorität des ausgewählten Turms weiterschalten |
| Tabs Angriff · Kontrolle · Fallen · Unterstützung, `Shift`+`1`–`4` | Turmseite wechseln (ab zehn verfügbaren Türmen; auch Pfeiltasten auf den Tabs) |
| `1`–`9`, `0`, `Q`, `W` | Turm im offenen Tab wählen; jeder Tab beginnt wieder bei `1` (die Taste steht auf der Karte). Ohne Tabs zählen die Tasten über alle Türme. |
| Rechtsklick, `Esc` oder ✕ | Baumodus und Auswahl aufheben. Ohne Auswahl beendet `Esc` das Vollbild. |
| `N` | Nächste Welle starten (im Versus: „Bereit“) |
| Leertaste | Pause, nur während einer Welle und nicht im Versus |
| `F` oder ⛶ | Vollbild |
| Pfeiltasten + Enter | Tastaturbedienung auf dem fokussierten Spielfeld |

Ein Tabwechsel pausiert das Einzelspiel automatisch. Audio ist optional und standardmäßig aus.

## Mehrspieler (2–4 Spieler)

In zwei Terminals im Projektordner starten:

```sh
npm run server   # Relay auf ws://0.0.0.0:4174 (PORT=… überschreibt den Port)
npm run dev      # Spiel auf http://0.0.0.0:4173
```

**Host**

1. `http://localhost:4173` öffnen.
2. Optional unter „Missionen“ eine Mission wählen; die Runde startet mit der aktuell geladenen Mission.
3. „Mehrspieler“ → „Raum erstellen“. Den vierstelligen Raumcode (z. B. `KJSK`) den Mitspielern schicken.
4. Modus wählen und „Mission starten“, sobald genug Spieler im Raum sind.

**Mitspieler**

1. Das Spiel vom Rechner des Hosts öffnen: `http://<IP-des-Hosts>:4173`.
2. „Mehrspieler“ → Raumcode eingeben → „Beitreten“.
3. Warten, bis der Host die Mission startet. Den Modus sieht man mit dem Start.

**Modi**

| Modus | Spieler | Regeln |
| --- | --- | --- |
| Koop | 2–4 | Gemeinsame Karte und Reaktorenergie, getrennte Credits. Start-Credits, Abschussprämien und Wellenbonus werden geteilt; Raffinerien zahlen an ihren Besitzer. Zusammen verdient ihr genau so viel wie ein Einzelspieler. Türme gehören dem Erbauer (farbige Ecke: blau, bernstein, grün, magenta); nur er kann sie verbessern und verkaufen. |
| Wettlauf | 2–4 | Jeder verteidigt eine eigene Kopie der Mission mit vollen Start-Credits. Die Wellen starten für alle gleichzeitig, sobald alle „Bereit“ gedrückt haben, spätestens nach 30 s. Es gibt keine Pause. Wer seinen Reaktor als Letzter hält, gewinnt. Überstehen mehrere alle Wellen, entscheidet die Reaktorenergie, danach die Zahl der Abschüsse. |
| Belagerung | 2–4 | Wie Wettlauf. Zusätzlich schickt man unter „Schicken“ Gegner in das Feld des nächsten Mitspielers, der noch im Spiel ist. Das kostet das Vierfache der Abschussprämie. Schicken kann man nur Gegnertypen, die schon in einer Welle vorkamen. Geschickte Gegner bringen dem Verteidiger keine Prämie. |

Kreislauf-Missionen (Sektor IX) laufen im Mehrspieler nur als Koop: Alle verteidigen denselben Ring, das Gegnerlimit gilt für alle zusammen, und jeder kann die nächste Welle früh rufen.

Mission, Neustart und Tempo bestimmt in allen Modi der Host. Dialoge und Tabwechsel pausieren im Mehrspieler nicht.

**Probleme**

- **„Kein Relay … erreichbar“:** `npm run server` läuft nicht, oder eine Firewall blockiert Port 4174.
- **Relay auf einem anderen Rechner oder Port:** `http://<IP>:4173/?server=ws://<Relay-IP>:4174`. Ohne diese Angabe verbindet sich das Spiel mit Port 4174 auf dem Rechner, der die Seite ausliefert.
- **„Der Raum ist voll …“:** Ein Raum hat vier Plätze. Nach dem Missionsstart kann niemand mehr beitreten.
- **Ein Spieler verlässt den Raum:**
  - Das Spiel hält an, und die übrigen Spieler rücken auf. Geht der Host, wird der nächste Spieler Host und kann neu starten.
  - „Raum verlassen“ setzt die Mission allein fort.
  - Wiederverbinden gibt es noch nicht.

## Missionen

Alle Missionen sind über „Missionen“ direkt wählbar, mit einem Tab je Sektor. Nach einem Sieg führt „Nächste Mission“ weiter.

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
| 25 | Zitadelle | Finale: zwei Titanen zugleich | 20 × 13 | 16 | 580 | 90 % |
| **VI** | **Singularität** | | | | | |
| 26 | Ereignishorizont | Nur 10 Reaktorenergie | 18 × 12 | 16 | 520 | 90 % |
| 27 | Riss | Sehr kurzer Pfad, kompakte Karte | 15 × 10 | 16 | 560 | 95 % |
| 28 | Zeitschleife | Einzelne Wellen mit HP-Spitzen | 18 × 12 | 17 | 580 | 110 %¹ |
| 29 | Nullpunkt | Ohne Aura und Raffinerie, harte Panzer | 18 × 12 | 18 | 590 | 105 % |
| 30 | Kern der Singularität | Finale: 20 Wellen, drei Titanen | 20 × 13 | 20 | 650 | 110 % |
| **VII** | **Dünenmeer** | | | | | |
| 31 | Treibsand | Gepanzerte Skarabäen, Wucht statt Streufeuer | 16 × 10 | 16 | 600 | 110 % |
| 32 | Karawanenweg | Gräber tauchen ab, Fallen erwischen sie | 16 × 11 | 17 | 620 | 102 % |
| 33 | Glasebene | Nur Fallen, Nova, Kryo und Flak | 16 × 10 | 16 | 700 | 105 % |
| 34 | Sturmkamm | Nur 10 Reaktorenergie | 18 × 11 | 18 | 650 | 108 % |
| 35 | Oase Null | Finale: Echo-Wellen, zwei Titanen | 18 × 11 | 19 | 700 | 112 %¹ |
| **VIII** | **Tiefsee** | | | | | |
| 36 | Schelfkante | Panzerkrebse mit Burst, Henker und Fallgrube brechen | 16 × 9 | 17 | 650 | 110 % |
| 37 | Korallengraben | Heilende Quallen in der Luft, Flak | 15 × 11 | 18 | 670 | 110 % |
| 38 | Druckkammer | Enge Spirale, 10 Reaktorenergie, Echo-Wellen | 15 × 11 | 18 | 690 | 110 %¹ |
| 39 | Schwarzer Raucher | Phantome, ohne Aura und Raffinerie | 11 × 14 | 18 | 700 | 110 % |
| 40 | Abgrund | Finale: alle Tiefseegegner, drei Titanen | 20 × 13 | 20 | 750 | 110 %¹ |

| **IX** | **Kreislauf** | | | | | |
| 41 | Umlaufbahn | Einfacher Ring, max. 30 Gegner, Welle alle 22 s | 18 × 12 | 8 | 400 | 35 % |
| 42 | Doppelschleife | Einbuchtung bündelt zwei Bahnen, max. 30, alle 20 s | 20 × 12 | 9 | 450 | 45 % |
| 43 | Mahlstrom | Zwei Einbuchtungen, max. 35, alle 18 s | 20 × 13 | 10 | 500 | 30 % |

¹ Einzelne Wellen haben einen eigenen HP-Faktor statt des linearen Zuwachses.

### Kreislauf

Die Missionen in Sektor IX spielen auf geschlossenen Ringen ohne Reaktor:

- Die erste Welle startest du selbst. Danach startet ein Timer jede weitere Welle, auch wenn die vorige noch läuft.
- Gegner laufen im Kreis, bis sie fallen. Sie richten keinen Reaktorschaden an.
- Sind mehr Gegner gleichzeitig im Ring als das Limit erlaubt, ist die Mission verloren. Die Anzeige „IM RING“ ersetzt die Reaktorenergie.
- Mit „Welle ▶“ oder `N` rufst du die nächste Welle früher. Für jede gesparte Sekunde gibt es Credits; den Bonus zeigt der Button an.
- Wellenbonus und Raffinerie-Einkommen kommen, sobald die nächste Welle startet.
- Gewonnen ist die Mission, wenn alle Wellen gestartet und alle Gegner besiegt sind.

## Türme

Jeder Gegner bewegt sich am Boden oder in der Luft; jeder Angriffsturm trifft nur bestimmte Ebenen.

| Turm | Kosten | Angriff | Ziele |
| --- | --- | --- | --- |
| Impuls | 80 | Einzelziel | Boden · Luft |
| Nova | 130 | Flächenschaden | nur Boden (auch der Explosionsradius) |
| Kryo | 100 | Verlangsamung | Boden · Luft |
| Aura | 160 | Unterstützung, verstärkt Türme im Radius 3 | – |
| Flak | 90 | Einzelziel, schnell | nur Luft |
| Tesla | 150 | Kettenblitz: springt bis zu 3× auf Gegner im Umkreis von 1,6 Feldern, je Sprung 75 % Schaden | Boden · Luft |
| Lanze | 170 | Durchschlag: Strahl bis Reichweite 4,4, trifft alle Gegner auf der Linie, je weiterem Treffer 85 % | Boden · Luft |
| Glut | 120 | Brand: zusätzlich das 2,5-Fache des Treffers über 3 s | Boden · Luft |
| Stasis | 140 | Betäubung: Puls im Radius 0,9 hält Gegner 0,8 s an, danach 1,5 s immun | Boden · Luft |
| Korrosion | 110 | Schwächung: Gegner im Radius 0,8 nehmen 3 s lang 25 % mehr Schaden | Boden · Luft |
| Zerfall | 160 | Anti-Boss: Treffer plus 4 % der maximalen HP | Boden · Luft |
| Fokus | 150 | Aufladung: Dauerstrahl hält sein Ziel, jeder Folgetreffer +20 % Schaden, bis zum Dreifachen | Boden · Luft |
| Mörser | 160 | Artillerie: Reichweite 5, Explosionsradius 1,3, kann Gegner näher als 1,5 Felder nicht beschießen | nur Boden |
| Beben | 140 | Nahbereich: Schockwelle trifft alle Gegner in Reichweite 1,8, am Rand noch 50 % | nur Boden |
| Henker | 150 | Hinrichtung: Gegner unter 25 % HP erleiden beim Einschlag den vierfachen Schaden | Boden · Luft |
| Schrapnell | 130 | Mehrfachziel: jede Salve trifft bis zu 3 verschiedene Gegner | Boden · Luft |
| Störsender | 130 | Störung: Puls im Radius 1,1 schaltet 3 s lang Schild, Regeneration, Heilung, Tarnung, Ausweichen und Anführer-Bonus ab; Schilde brechen sofort | Boden · Luft |
| Fangnetz | 110 | Luftfalle: Flieger 3 s lang 30 % langsamer und für Bodentürme wie Nova angreifbar | nur Luft |
| Gravitron | 170 | Rückstoß: Puls im Radius 1 zieht Gegner 0,6 s lang mit 1,5-fachem Tempo zurück, danach 2,5 s immun; Berserker widerstehen | nur Boden |
| Raffinerie | 120 | 25 Credits nach jeder Welle, kein Angriff | – |
| Detektor | 90 | Deckt getarnte Gegner im Radius 3,5 auf, kein eigener Angriff | – |
| Prämienbake | 100 | Abschüsse im Radius 2,5 zahlen 50 % mehr Credits (mehrere Baken zählen nicht doppelt), kein Angriff | – |
| Reparaturdock | 150 | Stellt nach jeder Welle 1 Reaktorenergie wieder her, bis zum Startwert; nicht im Kreislauf | – |
| Peilsender | 140 | Gegner im Radius 2,2 erleiden 15 % mehr Schaden, zusätzlich zu Korrosion, kein Angriff | – |

Nova, Mörser, Flak, Kryo, Henker, Schrapnell und Fangnetz verschießen Geschosse, die Zeit brauchen; schnelle Gegner können Nova-Granaten ausweichen. Tesla, Lanze, Fokus, Beben, Gravitron und Störsender treffen sofort.

### Fallen

Fallen baust du direkt auf freie Wegfelder (nicht auf Eingang oder Reaktor). Sie lösen aus, sobald ein Bodengegner auf ihr Feld läuft, auch ein getarnter. Flieger fliegen darüber hinweg. Nach dem Auslösen laden sie nach; ein Licht zeigt, wann sie wieder scharf sind. Fallen haben die fünf Stufen der Angriffstürme, ihr Auslöseradius bleibt aber gleich.

| Falle | Kosten | Wirkung | Stufe 4 / 5 |
| --- | --- | --- | --- |
| Mine | 70 | Explosion mit 80 Schaden im Radius 1,1, 5 s Nachladen | Radius 1,3 / 1,5 |
| Krähenfüße | 60 | Blutung: 4 s lang 12 Schaden je weiter gelaufenem Feld; festgehaltene oder zurückgeworfene Gegner bluten nicht | 15 je Feld / 18 je Feld, 5 s |
| Teergrube | 60 | Gegner laufen 1,5 s mit 45 % Tempo | 40 % für 2 s / 30 % für 2,5 s |
| Fangeisen | 90 | Hält Gegner 1,5 s fest, danach 2,5 s immun, 4 s Nachladen | 1,8 s / 2,2 s, größerer Griff |
| Flammenrost | 80 | Brand: das Dreifache des Treffers über 3 s | 3,5-fach / 4-fach über 4 s |
| Sprungfeder | 100 | Wirft Gegner den Weg zurück, danach 3 s immun; Berserker widerstehen | weiter / noch weiter |
| Haftmine | 90 | Heftet eine Bombe an den Gegner: 70 Schaden im Radius 1,2 nach 2 s oder sofort, wenn der Träger stirbt; Kettenreaktionen möglich | Radius 1,4 / 1,6, Zünder 1,5 s |
| Fallgrube | 120 | Verschlingt kleine Gegner (Drohne, Läufer, Skater, Phantom, Blinker) sofort, egal wie viele HP; größere nehmen 60 Schaden; 6 s Abdecken | auch Heiler, Schildträger, Splitter, Schleim / auch Panzer |
| Alarmdraht | 110 | Lädt beim Auslösen alle Angriffstürme im Radius 2,5 sofort nach; 6 s Spannen | Radius 3 / 3,5 |

**Angriffstürme** haben fünf Stufen:

| Stufe | Kosten (× Baukosten) | Schaden | Reichweite | Schusstakt |
| --- | --- | --- | --- | --- |
| 2 | 0,9 | × 1,65 | + 0,3 | × 0,9 |
| 3 | 1,5 | × 2,72 | + 0,6 | × 0,81 |
| 4 | 3,0 | × 4,8 | + 0,8 | × 0,66 |
| 5 | 4,5 | × 7,0 | + 1,0 | × 0,6 |

Die Stufen 4 und 5 sind teuer, bringen aber mehr Schaden pro Credit als zusätzliche Türme. Spezialtürme verbessern dabei auch ihre Effekte:

| Turm | Stufe 4 | Stufe 5 |
| --- | --- | --- |
| Kryo | verlangsamt auf 45 % Tempo, 2,3 s | 35 % Tempo, 2,8 s |
| Tesla | 4 Sprünge, 1,8 Felder | 5 Sprünge, 2 Felder |
| Lanze | verliert je Durchschlag 10 % | 0 %, Strahlbreite 0,5 |
| Glut | brennt mit dem 3-Fachen | 3,5-Fachen, 3,5 s lang |
| Stasis | 1 s, Radius 1,1 | 1,2 s, Radius 1,3 |
| Korrosion | +30 % Schaden | +40 %, Radius 1 |
| Zerfall | 5 % der maximalen HP | 6 % |
| Fokus | +25 % je Folgetreffer | +30 %, bis zu 12 Stufen |
| Mörser | Explosionsradius 1,5 | 1,7, toter Winkel 1,2 |
| Beben | 70 % am Rand | volle Wucht bis zum Rand |
| Henker | schon unter 30 % HP | 5-facher Schaden unter 35 % HP |
| Schrapnell | 4 Ziele pro Salve | 5 Ziele |
| Störsender | 3,5 s, Radius 1,3 | 4,5 s, Radius 1,5 |
| Fangnetz | 3,5 s | 40 % langsamer, 4,5 s |
| Gravitron | Radius 1,2, 1,8-fache Zugkraft | Radius 1,4, 2,2-fach, 0,7 s |

Die **Raffinerie** hat drei Stufen und zahlt 25 / 40 / 60 Credits pro Welle (Ausbau für 100 und 160 Credits).

Weitere Unterstützungstürme mit drei Stufen:

| Turm | Stufe 2 | Stufe 3 |
| --- | --- | --- |
| Prämienbake | +75 % · 90 | +100 %, Radius 3 · 150 |
| Reparaturdock | 2 Energie pro Welle · 160 | 3 Energie · 260 |
| Peilsender | +20 %, Radius 2,5 · 120 | +25 %, Radius 2,8 · 200 |

**Die Aura** hat keinen Grundbonus. Mit dem ersten Kauf legst du einen von drei Pfaden fest; die anderen beiden sind danach für diesen Turm gesperrt, umentscheiden geht nur über Verkaufen:

| Pfad | Stufe I | Stufe II | Stufe III |
| --- | --- | --- | --- |
| Schaden | +25 % · 100 | +40 % · 180 | +55 % · 300 |
| Angriffstempo | +20 % · 120 | +35 % · 200 | +50 % · 320 |
| Reichweite | +15 % · 100 | +25 % · 170 | +35 % · 280 |

Überlappen mehrere Auren, gilt je Eigenschaft der größte Bonus. Für mehrere Boni baust du mehrere Auren mit verschiedenen Pfaden. Aura-Türme und Raffinerien werden nie verstärkt.

### Zielprioritäten

Jeder Angriffsturm hat eine eigene Zielpriorität. Du stellst sie im Turm-Panel unter „Ziel“ ein oder schaltest sie mit `T` weiter. Sie gilt für alle Gegner in Reichweite, die der Turm treffen kann.

| Priorität | Zielt auf |
| --- | --- |
| Erster (Standard) | den Gegner, der dem Reaktor am nächsten ist |
| Letzter | den Gegner, der am weitesten zurückliegt |
| Stärkster | den Gegner mit den meisten aktuellen HP |
| Schwächster | den Gegner mit den wenigsten aktuellen HP |
| Nächster | den Gegner, der dem Turm am nächsten ist |

Bei Gleichstand gewinnt der Gegner, der weiter vorne liegt. Die Lanze zielt weiterhin auf die Linie mit den meisten Treffern; die Priorität entscheidet dort nur bei gleicher Trefferzahl. Stirbt das Ziel eines Impuls-, Flak- oder Kryo-Geschosses im Flug, sucht es sich wie bisher den nächsten Gegner. Raffinerie, Detektor und Aura haben keine Zielpriorität. Im Koop kannst du nur die Priorität deiner eigenen Türme ändern.

## Gegner

Sektor I nutzt fünf Grundgegner, darunter ab Mission 02 den **Gleiter**: schnell, wenig HP und in der Luft. Eine reine Nova-Verteidigung verliert deshalb jede Mission mit Gleitern. Ab Sektor II kommen je Sektor zwei Gegner mit Eigenschaften dazu:

| Sektor | Neue Gegner |
| --- | --- |
| II Frostgürtel | Splitter (zerfällt in Drohnen), Eisläufer (immun gegen Verlangsamung, flink) |
| III Säuremoor | Schleimer (regeneriert), Sanitäter (heilt andere) |
| IV Orbitaldeck | Schildträger (Schild lädt sich wieder auf), Phantom (getarnt, braucht den Detektor) |
| V Ruinenstadt | Bollwerk (Rüstung), Kommandant (stärkt Gegner in der Nähe) |
| VI Singularität | Phasenläufer (weicht jedem n-ten Treffer aus), Berserker (unaufhaltsam, spurtet bei wenig HP) |
| VII Dünenmeer | Skarabäus (gepanzert und flink), Gräber (taucht regelmäßig ab; dann treffen nur Fallen und Flächenschaden) |
| VIII Tiefsee | Panzerkrebs (verhärtet, je verletzter er ist), Qualle (fliegt und heilt Gegner in der Nähe) |

Getarnte Gegner kommen nur in Missionen vor, in denen der Detektor baubar ist.

## Grenzen

- Fester Pfad, Gegner lassen sich nicht umleiten.
- Kein gespeicherter Spielstand oder Missionsfortschritt.
- Keine Zielprioritäten für Türme.
- Im Mehrspieler kein Wiederverbinden und kein Beitritt nach dem Missionsstart.
- Die Simulation ist deterministisch und kommt ohne Zufall aus. Die Maps nutzen geometrische Markierungen statt Bildassets.
