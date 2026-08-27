// Keeping tool results inside Chrome's output budget.
//
// Chrome truncates a tool result at roughly 1.5K characters. A truncated JSON
// result is worse than a short one: it arrives at the agent as malformed text,
// and the agent has no way to tell that something was cut. So results that carry
// a list are trimmed here, deliberately, and the result says how many items were
// left out — the agent can then narrow its filters instead of guessing.

export const OUTPUT_BUDGET = 1500;

export function measure(value: unknown): number {
  return JSON.stringify(value).length;
}

/**
 * Builds the largest prefix of `items` whose serialised result still fits.
 *
 * `build` is called with the items to show and how many were dropped, so the
 * omission is reported inside the very result that omits them. Linear scan
 * rather than a binary search: the lists are at most a few dozen items, and this
 * cannot get the boundary wrong.
 */
export function fitList<Item, Result>(
  items: Item[],
  build: (shown: Item[], omitted: number) => Result
): Result {
  for (let count = items.length; count > 0; count -= 1) {
    const result = build(items.slice(0, count), items.length - count);
    if (measure(result) <= OUTPUT_BUDGET) return result;
  }
  return build([], items.length);
}
