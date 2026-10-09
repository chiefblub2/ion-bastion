import { towerLevel } from "../core/upgrades";
import { describeResult } from "../ui/messages";
import type { Game } from "../core/game";
import type { Command, CommandResult, TowerId } from "../core/types";
interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
}
export function registerTools(
  game: Game,
  execute: (c: Command) => CommandResult,
) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (
          tool: Tool,
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const tools: Tool[] = [
    {
      name: "read_defense_state",
      description: "Read mission status, credits, reactor energy and towers.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => {
        const s = game.state;
        return {
          mission: {
            id: game.mission.id,
            name: game.mission.name,
            columns: game.map.columns,
            rows: game.map.rows,
          },
          status: s.status,
          wave: s.wave,
          gold: s.wallets[0],
          lives: s.lives,
          towers: s.towers.map(tower => ({
            id: tower.id,
            type: tower.type,
            x: tower.x,
            y: tower.y,
            level: towerLevel(tower, game.content),
            upgrades: [...tower.upgrades],
          })),
          remainingEnemies: s.enemies.length + s.queue.length,
        };
      },
    },
    {
      name: "build_defense_tower",
      description:
        "Spend credits and build a tower on a free zero-indexed grid cell of the current mission's map.",
      inputSchema: {
        type: "object",
        properties: {
          tower: { type: "string", enum: Object.keys(game.content.towers) },
          // No upper bound: map sizes differ per mission; the build command checks the cell.
          x: { type: "integer", minimum: 0 },
          y: { type: "integer", minimum: 0 },
        },
        required: ["tower", "x", "y"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input: unknown) => {
        const v = input as { tower?: unknown; x?: unknown; y?: unknown } | null;
        if (
          !v ||
          !Object.hasOwn(game.content.towers, String(v.tower)) ||
          !Number.isInteger(v.x) ||
          !Number.isInteger(v.y)
        )
          throw new Error("Invalid tower or grid cell.");
        const r = execute({
          type: "build",
          tower: v.tower as TowerId,
          x: v.x as number,
          y: v.y as number,
        });
        if (!r.ok) throw new Error(describeResult(r));
        return r;
      },
    },
    {
      name: "start_defense_wave",
      description: "Start the next enemy wave in the current mission.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: () => {
        const r = execute({ type: "start" });
        if (!r.ok) throw new Error(describeResult(r));
        return r;
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional browser API. */
    }
  }
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
