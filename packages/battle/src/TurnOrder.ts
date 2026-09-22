import type { CombatantState } from "./CombatantState.js";

/**
 * Computes turn order for a round: all living combatants (party + enemies),
 * sorted by speed descending, then luck descending, then insertion order
 * ascending (stable tie-break for equal speed/luck). Pure function — takes a
 * snapshot of the current states and returns just the ordered id list.
 */
export function computeTurnOrder(
  party: Iterable<CombatantState>,
  enemies: Iterable<CombatantState>,
): string[] {
  const states: CombatantState[] = [...party, ...enemies].filter(
    (s) => s.hp > 0,
  );

  states.sort((a, b) => {
    if (b.speed !== a.speed) return b.speed - a.speed;
    if (b.luck !== a.luck) return b.luck - a.luck;
    return a.insertionOrder - b.insertionOrder;
  });

  return states.map((s) => s.id);
}
