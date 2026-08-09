import assert from "node:assert/strict";
import test from "node:test";

import {
  CLOUD_SAVE_RESUME_GRACE_MS,
  cloudRestoreEndpoint,
  cloudSaveEndpointFromConfig,
  createRecoveryCode,
  nextCloudSaveSuppressUntil,
  normalizeAccountPlayerId,
  normalizeRecoveryCode,
  shouldSuppressAutomaticCloudSave,
} from "../src/core/cloudSave.js";

test("recovery codes normalize into a readable stable format", () => {
  assert.equal(normalizeRecoveryCode("mir-abcd-2345-efgh-6789"), "MIR-ABCD-2345-EFGH-6789");
  assert.equal(normalizeRecoveryCode("bad"), "");
  assert.equal(normalizeRecoveryCode("MIR-ABCI-2345-EFGH-6789"), "");
});

test("account player ids reject character suffixes and junk", () => {
  assert.equal(normalizeAccountPlayerId("11111111-2222-3333-4444-555555555555"), "11111111-2222-3333-4444-555555555555");
  assert.equal(normalizeAccountPlayerId("anon-abc12345"), "anon-abc12345");
  assert.equal(normalizeAccountPlayerId("11111111-2222-3333-4444-555555555555:Warrior"), "");
  assert.equal(normalizeAccountPlayerId("short"), "");
  assert.equal(normalizeAccountPlayerId(""), "");
});

test("recovery code generation uses supplied secure bytes", () => {
  const code = createRecoveryCode({
    getRandomValues(bytes) {
      bytes.forEach((_, index) => { bytes[index] = index; });
      return bytes;
    },
  });
  assert.match(code, /^MIR-(?:[A-HJ-NP-Z2-9]{4}-){3}[A-HJ-NP-Z2-9]{4}$/);
});

test("cloud endpoints support explicit config and stats fallback", () => {
  assert.equal(
    cloudSaveEndpointFromConfig({ cloudSaveEndpoint: "https://example.test/saves/" }, ""),
    "https://example.test/saves",
  );
  assert.equal(
    cloudSaveEndpointFromConfig({}, "https://example.test/stats"),
    "https://example.test/cloud-save",
  );
  assert.equal(cloudRestoreEndpoint("https://example.test/cloud-save/"), "https://example.test/cloud-save/restore");
});

test("resume grace suppresses automatic cloud uploads and extends existing deadlines", () => {
  assert.equal(CLOUD_SAVE_RESUME_GRACE_MS, 2 * 60 * 1000);
  assert.equal(nextCloudSaveSuppressUntil(1_000, 0, 5_000), 6_000);
  assert.equal(nextCloudSaveSuppressUntil(1_000, 9_000, 5_000), 9_000);
  assert.equal(shouldSuppressAutomaticCloudSave(5_999, 6_000), true);
  assert.equal(shouldSuppressAutomaticCloudSave(6_000, 6_000), false);
});
