import assert from "node:assert/strict";
import test from "node:test";

import {
  cloudRestoreEndpoint,
  cloudSaveEndpointFromConfig,
  createRecoveryCode,
  normalizeRecoveryCode,
} from "../src/core/cloudSave.js";

test("recovery codes normalize into a readable stable format", () => {
  assert.equal(normalizeRecoveryCode("mir-abcd-2345-efgh-6789"), "MIR-ABCD-2345-EFGH-6789");
  assert.equal(normalizeRecoveryCode("bad"), "");
  assert.equal(normalizeRecoveryCode("MIR-ABCI-2345-EFGH-6789"), "");
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
