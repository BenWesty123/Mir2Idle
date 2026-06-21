import test from "node:test";
import assert from "node:assert/strict";
import { splitPartyRewardAmount } from "../src/core/party.js";

test("splitPartyRewardAmount: floor division with minimum one member", () => {
  assert.equal(splitPartyRewardAmount(100, 3), 33);
  assert.equal(splitPartyRewardAmount(100, 0), 100);
  assert.equal(splitPartyRewardAmount(-50, 2), 0);
  assert.equal(splitPartyRewardAmount(10.9, 2), 5);
});
