import assert from "node:assert/strict";
import test from "node:test";

import {
  cloudRestoreEndpoint,
  cloudSaveEndpointFromConfig,
  createRecoveryCode,
  normalizeAccountPlayerId,
  normalizeRecoveryCode,
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
