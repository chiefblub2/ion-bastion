import type { StatRow } from "../systems/attacks";
export const number = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
export const percent = (value: number) => `+${number(value * 100)} %`;
export const escape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export const statValue = (row: StatRow) => `${number(row.value)}${row.unit}`;
