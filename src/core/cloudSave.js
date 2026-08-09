export const CLOUD_SAVE_INTERVAL_MS = 10 * 60 * 1000;
/** After open / tab-back, block automatic cloud uploads so a restore can finish first. */
export const CLOUD_SAVE_RESUME_GRACE_MS = 2 * 60 * 1000;
export const CLOUD_RECOVERY_CODE_STORAGE_KEY = "lom-idle-v2-recovery-code";
export const CLOUD_LAST_SAVED_AT_STORAGE_KEY = "lom-idle-v2-cloud-saved-at";

export function nextCloudSaveSuppressUntil(
  now,
  currentSuppressUntil = 0,
  graceMs = CLOUD_SAVE_RESUME_GRACE_MS,
) {
  const current = Math.max(0, Number(currentSuppressUntil) || 0);
  const grace = Math.max(0, Math.trunc(Number(graceMs) || 0));
  return Math.max(current, (Number(now) || 0) + grace);
}

export function shouldSuppressAutomaticCloudSave(now, suppressUntil) {
  return (Number(now) || 0) < (Number(suppressUntil) || 0);
}

const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_CODE_LENGTH = 16;

export function normalizeRecoveryCode(value) {
  let compact = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.startsWith("MIR")) compact = compact.slice(3);
  if (compact.length !== RECOVERY_CODE_LENGTH) return "";
  if ([...compact].some((character) => !RECOVERY_CODE_ALPHABET.includes(character))) return "";
  return `MIR-${compact.match(/.{1,4}/g).join("-")}`;
}

/** Account-scoped Social / leaderboard id (no character `:suffix`). */
export function normalizeAccountPlayerId(value) {
  const id = String(value ?? "").trim();
  if (!id || id.includes(":")) return "";
  if (!/^[a-z0-9_-]{8,80}$/i.test(id)) return "";
  return id;
}

export function createRecoveryCode(cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.getRandomValues) throw new Error("Secure random values are unavailable.");
  const bytes = new Uint8Array(RECOVERY_CODE_LENGTH);
  cryptoApi.getRandomValues(bytes);
  const payload = [...bytes]
    .map((value) => RECOVERY_CODE_ALPHABET[value % RECOVERY_CODE_ALPHABET.length])
    .join("");
  return normalizeRecoveryCode(payload);
}

export function cloudSaveEndpointFromConfig(config = {}, statsEndpoint = "") {
  const explicit = typeof config.cloudSaveEndpoint === "string" ? config.cloudSaveEndpoint.trim() : "";
  if (explicit) return explicit.replace(/\/$/, "");
  const stats = String(statsEndpoint ?? "").trim();
  return stats ? stats.replace(/\/stats\/?$/i, "/cloud-save").replace(/\/$/, "") : "";
}

export function cloudRestoreEndpoint(cloudSaveEndpoint) {
  const base = String(cloudSaveEndpoint ?? "").replace(/\/$/, "");
  return base ? `${base}/restore` : "";
}
