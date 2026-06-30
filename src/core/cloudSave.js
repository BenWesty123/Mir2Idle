export const CLOUD_SAVE_INTERVAL_MS = 10 * 60 * 1000;
export const CLOUD_RECOVERY_CODE_STORAGE_KEY = "lom-idle-v2-recovery-code";
export const CLOUD_LAST_SAVED_AT_STORAGE_KEY = "lom-idle-v2-cloud-saved-at";

const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_CODE_LENGTH = 16;

export function normalizeRecoveryCode(value) {
  let compact = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.startsWith("MIR")) compact = compact.slice(3);
  if (compact.length !== RECOVERY_CODE_LENGTH) return "";
  if ([...compact].some((character) => !RECOVERY_CODE_ALPHABET.includes(character))) return "";
  return `MIR-${compact.match(/.{1,4}/g).join("-")}`;
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
