import type { Ink } from "./render/shapes";
import { mulberry32 } from "./render/terrain-themes/kit";
import * as O from "./render/terrain-themes/outpost-props";
import * as L from "./render/terrain-themes/lock-props";
import * as S from "./render/terrain-themes/shard-props";
import * as E from "./render/terrain-themes/ember-props";
import * as C from "./render/terrain-themes/core-props";
import * as F from "./render/terrain-themes/frost-props";
import * as T from "./render/terrain-themes/toxic-props";
import * as B from "./render/terrain-themes/orbit-props";
import * as R from "./render/terrain-themes/ruin-props";
import * as G from "./render/terrain-themes/gear-props";
import * as V from "./render/terrain-themes/rift-props";
import * as Gd from "./render/terrain-themes/geode-props";
import * as D from "./render/terrain-themes/dune-props";
import * as W from "./render/terrain-themes/storm-props";
import * as A from "./render/terrain-themes/abyss-props";
import * as T2 from "./render/terrain-themes/tide-props";
// Dev-only prop sheets for `/gallery.html?terrain&props` (`terrain-review.ts`): every prop of a theme on its own tile,
// shadow first, so a prop can be judged at a glance. One list per theme that has one.

export interface SheetItem {
  label: string;
  /** Tile width in cells (landmarks take two). */
  span?: number;
  shadow: (g: Ink, gx: number, gy: number) => void;
  draw: (g: Ink, gx: number, gy: number) => void;
}
/** Draws a landmark (built around 0, 0 at full 2×2 size) at (gx, gy) shrunk by k. */
const at = (g: Ink, gx: number, gy: number, k: number, draw: () => void) => {
  g.save();
  g.translateCanvas(gx, gy);
  g.scaleCanvas(k, k);
  draw();
  g.restore();
};
const r = (n: number) => mulberry32(n);
export const SHEETS: Partial<Record<string, SheetItem[]>> = {
  outpost: [
    ...[1, 2, 3].map((n) => {
      const c = O.cratesOf(r(100 + n));
      return { label: "crates", shadow: (g: Ink, x: number, y: number) => c.forEach((q) => O.crateShadow(g, x, y, q)), draw: (g: Ink, x: number, y: number) => O.drawCrates(g, x, y, c) };
    }),
    ...[1, 2].map((n) => {
      const d = O.drumsOf(r(200 + n));
      return { label: "drums", shadow: (g: Ink, x: number, y: number) => O.drumsShadow(g, x, y, d), draw: (g: Ink, x: number, y: number) => O.drawDrums(g, x, y, d) };
    }),
    ...[1, 2].map((n) => {
      const w = O.sandbagsOf(r(300 + n));
      return { label: "sandbags", shadow: (g: Ink, x: number, y: number) => O.sandbagsShadow(g, x, y, w), draw: (g: Ink, x: number, y: number) => O.drawSandbags(g, x, y, w) };
    }),
    (() => {
      const b = O.barriersOf(r(401));
      return { label: "barriers", shadow: (g: Ink, x: number, y: number) => O.barriersShadow(g, x, y, b), draw: (g: Ink, x: number, y: number) => O.drawBarriers(g, x, y, b) };
    })(),
    { label: "mast", shadow: (g, x, y) => O.mastShadow(g, x, y), draw: (g, x, y) => O.drawMast(g, x, y, 0.8) },
    ...[0.2, Math.PI - 0.35].map((a) => {
      const c = { ...O.containerOf(r(500)), a };
      return { label: "container", shadow: (g: Ink, x: number, y: number) => O.containerShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => O.drawContainer(g, x, y, c) };
    }),
    { label: "generator", shadow: (g, x, y) => O.generatorShadow(g, x, y, 0.5), draw: (g, x, y) => O.drawGenerator(g, x, y, 0.5) },
    { label: "hedgehog", shadow: (g, x, y) => O.hedgehogShadow(g, x, y), draw: (g, x, y) => O.drawHedgehog(g, x, y, 0.4) },
    { label: "fence", shadow: (g, x, y) => O.fenceShadow(g, x - 26, y, x + 26, y), draw: (g, x, y) => O.drawFence(g, x - 26, y, x + 26, y) },
    { label: "watchtower", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => O.watchtowerShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => O.drawWatchtower(g)) },
    { label: "helipad", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => O.helipadShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => O.drawHelipad(g)) },
  ],
  lock: [
    ...[1, 2, 3].map((n) => {
      const m = L.mooringOf(r(600 + n));
      return { label: "mooring", shadow: (g: Ink, x: number, y: number) => L.mooringShadow(g, x, y, m), draw: (g: Ink, x: number, y: number) => L.drawMooring(g, x, y, m) };
    }),
    { label: "capstan", shadow: (g, x, y) => L.capstanShadow(g, x, y, 0.6), draw: (g, x, y) => L.drawCapstan(g, x, y, 0.6) },
    ...[1, 2].map((n) => {
      const p = L.pipesOf(r(700 + n));
      return { label: "pipes", shadow: (g: Ink, x: number, y: number) => L.pipesShadow(g, x, y, p), draw: (g: Ink, x: number, y: number) => L.drawPipes(g, x, y, p) };
    }),
    ...[1, 2].map((n) => {
      const p = L.palletsOf(r(800 + n));
      return { label: "pallets", shadow: (g: Ink, x: number, y: number) => L.palletsShadow(g, x, y, p), draw: (g: Ink, x: number, y: number) => L.drawPallets(g, x, y, p) };
    }),
    { label: "cylinders", shadow: (g, x, y) => L.cylindersShadow(g, x, y, 0.2), draw: (g, x, y) => L.drawCylinders(g, x, y, 0.2) },
    { label: "lantern", shadow: (g, x, y) => L.lanternShadow(g, x, y), draw: (g, x, y) => L.drawLantern(g, x, y) },
    { label: "kiosk", shadow: (g, x, y) => L.kioskShadow(g, x, y, 0.3), draw: (g, x, y) => L.drawKiosk(g, x, y, 0.3) },
    { label: "fender", shadow: () => undefined, draw: (g, x, y) => L.fender(g, x, y - 10) },
    { label: "barge", span: 2, shadow: (g, x, y) => L.bargeShadow(g, x, y), draw: (g, x, y) => L.drawBarge(g, x, y) },
    { label: "crane", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => L.craneShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => L.drawCrane(g)) },
    { label: "control tower", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => L.controlTowerShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => L.drawControlTower(g)) },
  ],
  shard: [
    ...[1, 2, 3, 4].map((n) => {
      const c = S.clusterOf(r(900 + n));
      return { label: "cluster", shadow: (g: Ink, x: number, y: number) => S.clusterShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => S.drawCluster(g, x, y, c) };
    }),
    (() => {
      const q = S.geodeOf(r(950));
      return { label: "geode", shadow: (g: Ink, x: number, y: number) => S.geodeShadow(g, x, y, q), draw: (g: Ink, x: number, y: number) => S.drawGeode(g, x, y, q) };
    })(),
    { label: "floater", shadow: (g, x, y) => S.floaterShadow(g, x, y), draw: (g, x, y) => S.drawFloater(g, x, y, 0x7fd8ff, 0.5) },
    { label: "sensor", shadow: (g, x, y) => S.sensorShadow(g, x, y), draw: (g, x, y) => S.drawSensor(g, x, y, 0.6) },
    { label: "pylon", shadow: (g, x, y) => S.pylonShadow(g, x, y), draw: (g, x, y) => S.drawPylon(g, x, y, 0.2, 0xf0a6d8) },
    { label: "crystal", shadow: (g, x, y) => S.crystalShadow(g, x, y, { u: 0, v: 0, a: 0.8, lean: 0.3, len: 30, r: 7, color: 0x9d8cff }), draw: (g, x, y) => S.crystal(g, x, y, { u: 0, v: 0, a: 0.8, lean: 0.3, len: 30, r: 7, color: 0x9d8cff }) },
    { label: "monolith", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => S.monolithShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => S.drawMonolith(g, 0xb8a6ff)) },
    { label: "split geode", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => S.splitGeodeShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => S.drawSplitGeode(g, 0x9d8cff)) },
  ],
  ember: [
    ...[1, 2].map((n) => {
      const c = E.columnsOf(r(1000 + n));
      return { label: "columns", shadow: (g: Ink, x: number, y: number) => E.columnsShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => E.drawColumns(g, x, y, c) };
    }),
    (() => {
      const b = E.boulderOf(r(1010));
      return { label: "boulder", shadow: (g: Ink, x: number, y: number) => E.boulderShadow(g, x, y, b), draw: (g: Ink, x: number, y: number) => E.drawBoulder(g, x, y, b) };
    })(),
    { label: "fumarole", shadow: (g, x, y) => E.fumaroleShadow(g, x, y, 1), draw: (g, x, y) => E.drawFumarole(g, x, y, 1) },
    (() => {
      const t = E.treeOf(r(1020));
      return { label: "tree", shadow: (g: Ink, x: number, y: number) => E.treeShadow(g, x, y, t), draw: (g: Ink, x: number, y: number) => E.drawTree(g, x, y, t) };
    })(),
    (() => {
      const o = E.obsidianOf(r(1030));
      return { label: "obsidian", shadow: (g: Ink, x: number, y: number) => E.obsidianShadow(g, x, y, o), draw: (g: Ink, x: number, y: number) => E.drawObsidian(g, x, y, o) };
    })(),
    { label: "brazier", shadow: (g, x, y) => E.brazierShadow(g, x, y), draw: (g, x, y) => E.drawBrazier(g, x, y) },
    { label: "cinder cone", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => E.coneShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => E.drawCone(g)) },
    { label: "shrine", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => E.shrineShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => E.drawShrine(g)) },
  ],
  core: [
    ...[1, 2].map((n) => {
      const t = C.transformerOf(r(2000 + n));
      return { label: "transformer", shadow: (g: Ink, x: number, y: number) => C.transformerShadow(g, x, y, t), draw: (g: Ink, x: number, y: number) => C.drawTransformer(g, x, y, t) };
    }),
    ...[1, 2].map((n) => {
      const c = C.capacitorsOf(r(2010 + n));
      return { label: "capacitors", shadow: (g: Ink, x: number, y: number) => C.capacitorsShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => C.drawCapacitors(g, x, y, c) };
    }),
    ...[1, 2].map((n) => {
      const c = { a: 0.15 * (n - 1.5), count: n };
      return { label: "cabinets", shadow: (g: Ink, x: number, y: number) => C.cabinetsShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => C.drawCabinets(g, x, y, c) };
    }),
    (() => {
      const t = { flip: false, gauge: true };
      return { label: "tanks", shadow: (g: Ink, x: number, y: number) => C.tanksShadow(g, x, y, t), draw: (g: Ink, x: number, y: number) => C.drawTanks(g, x, y, t) };
    })(),
    { label: "vent", shadow: (g, x, y) => C.ventShadow(g, x, y), draw: (g, x, y) => { C.drawVent(g, x, y); C.ventFan(g, x, y, 0, 0); } },
    { label: "mast", shadow: (g, x, y) => C.mastShadow(g, x, y), draw: (g, x, y) => C.drawMast(g, x, y) },
    { label: "cooling tower", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => C.coolingTowerShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => C.drawCoolingTower(g)) },
    { label: "shield spire", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => C.spireShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => C.drawSpire(g)) },
  ],
  frost: [
    ...[1, 2, 3].map((n) => {
      const p = F.pinesOf(r(3000 + n));
      return { label: "pines", shadow: (g: Ink, x: number, y: number) => F.pinesShadow(g, x, y, p), draw: (g: Ink, x: number, y: number) => F.drawPines(g, x, y, p) };
    }),
    (() => {
      const c = F.shardsOf(r(3010));
      return { label: "ice shards", shadow: (g: Ink, x: number, y: number) => F.shardsShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => F.drawShards(g, x, y, c) };
    })(),
    ...[1, 2].map((n) => {
      const k = F.rocksOf(r(3020 + n));
      return { label: "rocks", shadow: (g: Ink, x: number, y: number) => F.rocksShadow(g, x, y, k), draw: (g: Ink, x: number, y: number) => F.drawRocks(g, x, y, k) };
    }),
    { label: "weather station", shadow: (g, x, y) => F.stationShadow(g, x, y), draw: (g, x, y) => { F.drawStation(g, x, y); F.anemometer(g, x, y, 0, 0); } },
    (() => {
      const c = F.cacheOf(r(3030));
      return { label: "cache", shadow: (g: Ink, x: number, y: number) => F.cacheShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => F.drawCache(g, x, y, c) };
    })(),
    { label: "research dome", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => F.domeShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => F.drawDome(g)) },
    { label: "ice serac", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => F.seracShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => F.drawSerac(g)) },
  ],
  toxic: [
    ...[1, 2, 3].map((n) => {
      const b = T.barrelsOf(r(4000 + n));
      return { label: "barrels", shadow: (g: Ink, x: number, y: number) => T.barrelsShadow(g, x, y, b), draw: (g: Ink, x: number, y: number) => T.drawBarrels(g, x, y, b) };
    }),
    (() => {
      const t = T.treeOf(r(4010));
      return { label: "dead tree", shadow: (g: Ink, x: number, y: number) => T.treeShadow(g, x, y, t), draw: (g: Ink, x: number, y: number) => T.drawTree(g, x, y, t) };
    })(),
    ...[1, 2].map((n) => {
      const c = T.fungusOf(r(4020 + n));
      return { label: "fungus", shadow: (g: Ink, x: number, y: number) => T.fungusShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => T.drawFungus(g, x, y, c) };
    }),
    (() => {
      const t = T.tankOf(r(4030));
      return { label: "tank", shadow: (g: Ink, x: number, y: number) => T.tankShadow(g, x, y, t), draw: (g: Ink, x: number, y: number) => T.drawTank(g, x, y, t) };
    })(),
    (() => {
      const k = T.reedsOf(r(4040));
      return { label: "cattails", shadow: (g: Ink, x: number, y: number) => T.reedsShadow(g, x, y), draw: (g: Ink, x: number, y: number) => T.drawReeds(g, x, y, k) };
    })(),
    { label: "digester", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => T.digesterShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => T.drawDigester(g)) },
    { label: "pump house", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => T.pumpHouseShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => T.drawPumpHouse(g)) },
  ],
  orbit: [
    ...[1, 2].map((n) => {
      const s = B.solarOf(r(5000 + n));
      return { label: "collector", shadow: (g: Ink, x: number, y: number) => B.solarShadow(g, x, y, s), draw: (g: Ink, x: number, y: number) => B.drawSolar(g, x, y, s) };
    }),
    ...[1, 2].map((n) => {
      const c = B.cargoOf(r(5010 + n));
      return { label: "cargo modules", shadow: (g: Ink, x: number, y: number) => B.cargoShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => B.drawCargo(g, x, y, c) };
    }),
    (() => {
      const s = B.spheresOf(r(5020));
      return { label: "plasma cells", shadow: (g: Ink, x: number, y: number) => B.spheresShadow(g, x, y, s), draw: (g: Ink, x: number, y: number) => B.drawSpheres(g, x, y, s) };
    })(),
    (() => {
      const a = B.armOf(r(5030));
      return { label: "arm", shadow: (g: Ink, x: number, y: number) => B.armShadow(g, x, y, a), draw: (g: Ink, x: number, y: number) => B.drawArm(g, x, y, a) };
    })(),
    { label: "sensor dish", shadow: (g, x, y) => B.dishShadow(g, x, y), draw: (g, x, y) => B.drawDish(g, x, y, 0.6) },
    { label: "hydroponics", shadow: (g, x, y) => B.hydroShadow(g, x, y), draw: (g, x, y) => B.drawHydro(g, x, y) },
    { label: "dropship", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => B.shuttleShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => B.drawShuttle(g)) },
    { label: "sensor spire", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => B.commsShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => B.drawComms(g)) },
  ],
  ruin: [
    ...[1, 2].map((n) => {
      const w = R.wallOf(r(6000 + n));
      return { label: "wall", shadow: (g: Ink, x: number, y: number) => R.wallShadow(g, x, y, w), draw: (g: Ink, x: number, y: number) => R.drawWall(g, x, y, w) };
    }),
    (() => {
      const c = R.columnOf(r(6010));
      return { label: "column", shadow: (g: Ink, x: number, y: number) => R.columnShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => R.drawColumn(g, x, y, c) };
    })(),
    ...[1, 2].map((n) => {
      const c = R.carOf(r(6020 + n));
      return { label: "car", shadow: (g: Ink, x: number, y: number) => R.carShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => R.drawCar(g, x, y, c) };
    }),
    (() => {
      const h = { ...R.heapOf(r(6030)), barrel: true };
      return { label: "rubble", shadow: (g: Ink, x: number, y: number) => R.heapShadow(g, x, y, h), draw: (g: Ink, x: number, y: number) => R.drawHeap(g, x, y, h) };
    })(),
    (() => {
      const l = R.lampOf(r(6040));
      return { label: "streetlamp", shadow: (g: Ink, x: number, y: number) => R.lampShadow(g, x, y), draw: (g: Ink, x: number, y: number) => R.drawLamp(g, x, y, l) };
    })(),
    { label: "apartment", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => R.apartmentShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => R.drawApartment(g)) },
    { label: "billboard", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => R.billboardShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => R.drawBillboard(g)) },
  ],
  gear: [
    ...[1, 2].map((n) => {
      const s = G.standingOf(r(7000 + n));
      return { label: "standing cog", shadow: (g: Ink, x: number, y: number) => G.standingShadow(g, x, y, s), draw: (g: Ink, x: number, y: number) => G.drawStanding(g, x, y, s) };
    }),
    ...[1, 2].map((n) => {
      const s = G.stackOf(r(7010 + n));
      return { label: "gear stack", shadow: (g: Ink, x: number, y: number) => G.stackShadow(g, x, y, s), draw: (g: Ink, x: number, y: number) => G.drawStack(g, x, y, s) };
    }),
    (() => {
      const e = G.engineOf(r(7020));
      return { label: "piston engine", shadow: (g: Ink, x: number, y: number) => G.engineShadow(g, x, y, e), draw: (g: Ink, x: number, y: number) => G.drawEngine(g, x, y, e) };
    })(),
    (() => {
      const b = G.boilerOf(r(7030));
      return { label: "boiler", shadow: (g: Ink, x: number, y: number) => G.boilerShadow(g, x, y, b), draw: (g: Ink, x: number, y: number) => G.drawBoiler(g, x, y, b) };
    })(),
    (() => {
      const p = G.pipesOf(r(7040));
      return { label: "steam pipes", shadow: (g: Ink, x: number, y: number) => G.pipesShadow(g, x, y, p), draw: (g: Ink, x: number, y: number) => G.drawPipes(g, x, y, p) };
    })(),
    { label: "clock tower", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => G.clockTowerShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => G.drawClockTower(g)) },
    { label: "escapement", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => G.escapementShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => { G.drawEscapement(g); G.pendulum(g, 0, 0, 1, 0.2); }) },
  ],
  rift: [
    ...[1, 2].map((n) => {
      const d = V.debrisOf(r(7000 + n));
      return { label: "debris", shadow: (g: Ink, x: number, y: number) => V.debrisShadow(g, x, y, d), draw: (g: Ink, x: number, y: number) => V.drawDebris(g, x, y, d) };
    }),
    { label: "tear", shadow: (g, x, y) => V.tearShadow(g, x, y), draw: (g, x, y) => V.drawTear(g, x, y, 0.1) },
    (() => {
      const p = V.pylonOf(r(7010));
      return { label: "pylon", shadow: (g: Ink, x: number, y: number) => V.pylonShadow(g, x, y, p), draw: (g: Ink, x: number, y: number) => V.drawPylon(g, x, y, p) };
    })(),
    { label: "cage", shadow: (g, x, y) => V.cageShadow(g, x, y), draw: (g, x, y) => V.drawCage(g, x, y) },
    (() => {
      const s = V.slabsOf(r(7020));
      return { label: "slabs", shadow: (g: Ink, x: number, y: number) => V.slabsShadow(g, x, y, s), draw: (g: Ink, x: number, y: number) => V.drawSlabs(g, x, y, s) };
    })(),
    { label: "portal", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => V.portalShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => V.drawPortal(g)) },
    { label: "monolith", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => V.monolithShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => V.drawMonolith(g)) },
  ],
  geode: [
    ...[1, 2].map((n) => {
      const o = { ...Gd.geodeOf(r(8000 + n)), tint: n - 1 };
      return { label: "geode", shadow: (g: Ink, x: number, y: number) => Gd.geodeShadow(g, x, y, o), draw: (g: Ink, x: number, y: number) => Gd.drawGeode(g, x, y, o) };
    }),
    (() => {
      const c = Gd.clusterOf(r(8010));
      return { label: "quartz", shadow: (g: Ink, x: number, y: number) => Gd.clusterShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => Gd.drawCluster(g, x, y, c) };
    })(),
    (() => {
      const m = Gd.mitesOf(r(8020));
      return { label: "stalagmites", shadow: (g: Ink, x: number, y: number) => Gd.mitesShadow(g, x, y, m), draw: (g: Ink, x: number, y: number) => Gd.drawMites(g, x, y, m) };
    })(),
    ...[false, true].map((tipped) => {
      const c = { ...Gd.cartOf(r(8030)), tipped };
      return { label: "ore cart", shadow: (g: Ink, x: number, y: number) => Gd.cartShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => Gd.drawCart(g, x, y, c) };
    }),
    { label: "lantern", shadow: (g, x, y) => Gd.lanternShadow(g, x, y), draw: (g, x, y) => Gd.drawLantern(g, x, y) },
    { label: "giant geode", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => Gd.giantShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => Gd.drawGiant(g)) },
    { label: "headframe", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => Gd.headframeShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => Gd.drawHeadframe(g)) },
  ],
  dune: [
    ...[1, 2].map((n) => {
      const h = D.hoodooOf(r(7000 + n));
      return { label: "hoodoo", shadow: (g: Ink, x: number, y: number) => D.hoodooShadow(g, x, y, h), draw: (g: Ink, x: number, y: number) => D.drawHoodoo(g, x, y, h) };
    }),
    (() => {
      const h = D.hullOf(r(7010));
      return { label: "hull", shadow: (g: Ink, x: number, y: number) => D.hullShadow(g, x, y, h), draw: (g: Ink, x: number, y: number) => D.drawHull(g, x, y, h) };
    })(),
    (() => {
      const b = { ...D.ribsOf(r(7020)), skull: true };
      return { label: "rib cage", shadow: (g: Ink, x: number, y: number) => D.ribsShadow(g, x, y, b), draw: (g: Ink, x: number, y: number) => D.drawRibs(g, x, y, b) };
    })(),
    (() => {
      const c = D.glassOf(r(7030));
      return { label: "desert glass", shadow: (g: Ink, x: number, y: number) => D.glassShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => D.drawGlass(g, x, y, c) };
    })(),
    (() => {
      const b = D.bouldersOf(r(7040));
      return { label: "boulders", shadow: (g: Ink, x: number, y: number) => D.bouldersShadow(g, x, y, b), draw: (g: Ink, x: number, y: number) => D.drawBoulders(g, x, y, b) };
    })(),
    { label: "cache", shadow: (g, x, y) => D.cacheShadow(g, x, y), draw: (g, x, y) => D.drawCache(g, x, y, false) },
    { label: "rock arch", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => D.archShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => D.drawArch(g)) },
    { label: "colossus", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => D.colossusShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => D.drawColossus(g)) },
  ],
  storm: [
    ...[1, 2].map((n) => {
      const c = W.needlesOf(r(8000 + n));
      return { label: "basalt needles", shadow: (g: Ink, x: number, y: number) => W.needlesShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => W.drawNeedles(g, x, y, c) };
    }),
    { label: "lightning rod", shadow: (g, x, y) => W.rodShadow(g, x, y), draw: (g, x, y) => W.drawRod(g, x, y) },
    { label: "turbine", shadow: (g, x, y) => W.turbineShadow(g, x, y), draw: (g, x, y) => { W.drawTurbine(g, x, y); W.blades(g, x, y, 0.4); } },
    { label: "shelter", shadow: (g, x, y) => W.shelterShadow(g, x, y), draw: (g, x, y) => W.drawShelter(g, x, y) },
    (() => {
      const b = W.bouldersOf(r(8010));
      return { label: "boulders", shadow: (g: Ink, x: number, y: number) => W.bouldersShadow(g, x, y, b), draw: (g: Ink, x: number, y: number) => W.drawBoulders(g, x, y, b) };
    })(),
    (() => {
      const p = W.poleOf(r(8020));
      return { label: "power pole", shadow: (g: Ink, x: number, y: number) => W.poleShadow(g, x, y, p), draw: (g: Ink, x: number, y: number) => W.drawPole(g, x, y, p) };
    })(),
    { label: "tesla tower", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => W.teslaShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => W.drawTesla(g)) },
    { label: "observatory", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => W.observatoryShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => W.drawObservatory(g)) },
  ],
  abyss: [
    ...[1, 2].map((n) => {
      const c = A.coralOf(r(7000 + n));
      return { label: "coral", shadow: (g: Ink, x: number, y: number) => A.coralShadow(g, x, y), draw: (g: Ink, x: number, y: number) => A.drawCoral(g, x, y, c) };
    }),
    ...[1, 2].map((n) => {
      const v = A.ventsOf(r(7010 + n));
      return { label: "vents", shadow: (g: Ink, x: number, y: number) => A.ventsShadow(g, x, y, v), draw: (g: Ink, x: number, y: number) => A.drawVents(g, x, y, v) };
    }),
    (() => {
      const c = { ...A.clamOf(r(7020)), pearl: true };
      return { label: "giant clam", shadow: (g: Ink, x: number, y: number) => A.clamShadow(g, x, y), draw: (g: Ink, x: number, y: number) => A.drawClam(g, x, y, c) };
    })(),
    (() => {
      const w = A.wormsOf(r(7030));
      return { label: "tube worms", shadow: (g: Ink, x: number, y: number) => A.wormsShadow(g, x, y), draw: (g: Ink, x: number, y: number) => A.drawWorms(g, x, y, w) };
    })(),
    (() => {
      const k = A.kelpOf(r(7040));
      return { label: "kelp", shadow: (g: Ink, x: number, y: number) => A.kelpShadow(g, x, y), draw: (g: Ink, x: number, y: number) => A.drawKelp(g, x, y, k) };
    })(),
    { label: "shipwreck", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => A.wreckShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => A.drawWreck(g)) },
    { label: "black smoker", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => A.smokerShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => A.drawSmoker(g)) },
  ],
  tide: [
    ...[1, 2].map((n) => {
      const st = T2.stackOf(r(8000 + n));
      return { label: "sea stack", shadow: (g: Ink, x: number, y: number) => T2.stackShadow(g, x, y, st), draw: (g: Ink, x: number, y: number) => T2.drawStack(g, x, y, st) };
    }),
    (() => {
      const p = T2.poolOf(r(8010));
      return { label: "tidepool", shadow: (g: Ink, x: number, y: number) => T2.poolShadow(g, x, y), draw: (g: Ink, x: number, y: number) => T2.drawPool(g, x, y, p) };
    })(),
    (() => {
      const d = { ...T2.driftOf(r(8020)), branch: 1 };
      return { label: "driftwood", shadow: (g: Ink, x: number, y: number) => T2.driftShadow(g, x, y, d), draw: (g: Ink, x: number, y: number) => T2.drawDrift(g, x, y, d) };
    })(),
    (() => {
      const p = { ...T2.postsOf(r(8030)), lantern: true };
      return { label: "mooring posts", shadow: (g: Ink, x: number, y: number) => T2.postsShadow(g, x, y, p), draw: (g: Ink, x: number, y: number) => T2.drawPosts(g, x, y, p) };
    })(),
    (() => {
      const b = { ...T2.boatOf(r(8040)), creels: 2 };
      return { label: "rowboat", shadow: (g: Ink, x: number, y: number) => T2.boatShadow(g, x, y, b), draw: (g: Ink, x: number, y: number) => T2.drawBoat(g, x, y, b) };
    })(),
    { label: "lighthouse", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => T2.lighthouseShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => T2.drawLighthouse(g)) },
    { label: "stilt hut", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => T2.hutShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => T2.drawHut(g)) },
  ],
};
