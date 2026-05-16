import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calcule les unités d'alcool.
 * 1 unité = 10g d'alcool pur. Densité alcool = 0.8 g/mL.
 * Formule : volume_cl × degré% × 0.8 / 10
 */
export function calculateAlcoholUnits(volumeCl: number, alcoholPct: number): number {
  return (volumeCl * 10 * (alcoholPct / 100) * 0.8) / 10;
}

/**
 * Calcule l'alcoolémie estimée (formule de Widmark simplifiée).
 * Résultat en g/L.
 * ⚠️ Estimation indicative uniquement.
 */
export function calculateBAC(
  totalGramsAlcohol: number,
  weightKg: number,
  sex: "M" | "F" | "other",
  hoursSinceFirstDrink: number
): number {
  const r = sex === "M" ? 0.68 : sex === "F" ? 0.55 : 0.615;
  const eliminationRate = 0.15;
  const bac = totalGramsAlcohol / (weightKg * r) - eliminationRate * hoursSinceFirstDrink;
  return Math.max(0, bac);
}

const PARTY_WORDS = [
  "BIERE", "SHOT", "VINO", "RHUM", "BOLS", "PINOT", "CAVA", "SAKE",
  "MALT", "PILS", "STOUT", "ROSE", "PORTO", "CIDRE",
];

/**
 * Génère un code de soirée lisible au format MOT-NN (ex: BIERE-42)
 */
export function generatePartyCode(): string {
  const word = PARTY_WORDS[Math.floor(Math.random() * PARTY_WORDS.length)];
  const num = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${word}-${num}`;
}
