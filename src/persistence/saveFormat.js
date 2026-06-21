/** Save file version. Bump only with a migration path in sanitize/restore. */
export const SAVE_VERSION = 1;

/**
 * Parse pasted or stored save JSON. Pure — no localStorage, no game state.
 * @returns {{ ok: true, snapshot: object } | { ok: false, error: string }}
 */
export function parseSaveSnapshotText(rawText) {
  const trimmed = String(rawText ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Paste a save file or choose a JSON file first." };
  }
  let snapshot;
  try {
    snapshot = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "That text is not valid JSON." };
  }
  if (!snapshot || typeof snapshot !== "object") {
    return { ok: false, error: "Save data must be a JSON object." };
  }
  const version = Number(snapshot.version);
  if (!Number.isFinite(version)) {
    return { ok: false, error: "Save is missing a version number." };
  }
  if (version !== SAVE_VERSION) {
    return {
      ok: false,
      error: `Save version ${version} is not supported (expected ${SAVE_VERSION}).`,
    };
  }
  if (!snapshot.characters || typeof snapshot.characters !== "object") {
    return { ok: false, error: "Save is missing character data." };
  }
  return { ok: true, snapshot };
}
