// Connector pool used when joining individual fixes inside a turn.
// Weights roughly mirror real-user frequencies extracted from
// `connector-patterns.json` — sentence boundaries dominate, prose connectors
// like "Also" / "Additionally" appear less often, and a few semicolon /
// newline variants round out the mix.
//
// Edit the pool below to tune turn phrasing — higher weight = more frequent.

export const CONNECTOR_POOL = [
  // Plain sentence boundary (most common in the wild)
  { connector: '. ',                weight: 8 },
  // Single newline (one fix per line)
  { connector: '\n',                weight: 5 },
  // Semicolon (legacy style — kept so users still see ";" sometimes)
  { connector: '; ',                weight: 4 },
  // Blank line between fixes
  { connector: '\n\n',              weight: 3 },
  // Prose connectors
  { connector: '. Also, ',          weight: 3 },
  { connector: '. Additionally, ',  weight: 2 },
  { connector: '. Next, ',          weight: 2 },
  { connector: '. Then, ',          weight: 2 },
  { connector: '. And ',            weight: 2 },
  { connector: '. Finally, ',       weight: 1 },
  { connector: '. Furthermore, ',   weight: 1 },
]

const totalWeight = CONNECTOR_POOL.reduce((sum, c) => sum + c.weight, 0)

/**
 * Pick a connector at random, weighted by `CONNECTOR_POOL`. If `previous` is
 * supplied, the same string won't be chosen back-to-back (avoids "Also … Also …").
 */
export function pickConnector(previous = null) {
  const pool = previous == null
    ? CONNECTOR_POOL
    : CONNECTOR_POOL.filter((c) => c.connector !== previous)
  // Fall back to the full pool if filtering left us empty (only possible if
  // someone shrinks CONNECTOR_POOL to a single entry).
  const useful = pool.length > 0 ? pool : CONNECTOR_POOL
  const total = useful.reduce((s, c) => s + c.weight, 0)
  let r = Math.random() * total
  for (const c of useful) {
    r -= c.weight
    if (r <= 0) return c.connector
  }
  return useful[useful.length - 1].connector
}

/** Default fallback when a turn was built before connectors existed. */
export const DEFAULT_CONNECTOR = '; '

// Re-export totalWeight for tests / debugging.
export { totalWeight as _totalWeight }
