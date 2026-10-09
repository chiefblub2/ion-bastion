import type { GameState } from "./types";
/** Shared income (kill rewards, wave bonus): split evenly, the remainder rotates between players. */
export function earn(state: GameState, amount: number) {
  const n = state.wallets.length;
  if (!Number.isInteger(amount)) {
    for (let i = 0; i < n; i++) state.wallets[i] += amount / n;
    return;
  }
  const share = Math.floor(amount / n);
  let rest = amount - share * n;
  for (let i = 0; i < n; i++) state.wallets[i] += share;
  while (rest-- > 0) {
    state.wallets[state.splitCursor] += 1;
    state.splitCursor = (state.splitCursor + 1) % n;
  }
}
/** Income of a single player, e.g. a refinery payout or a sale. */
export function credit(state: GameState, player: number, amount: number) {
  state.wallets[player] += amount;
}
export const balance = (state: GameState, player = 0) => state.wallets[player] ?? 0;
/** Splits the starting credits; the first player gets any remainder. */
export function startingWallets(credits: number, players: number) {
  const share = Math.floor(credits / players);
  return Array.from({ length: players }, (_, i) => share + (i === 0 ? credits - share * players : 0));
}
