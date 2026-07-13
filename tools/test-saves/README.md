# Test saves

## Spirit Box (`spirit-box-test.json`)

Import via **Options → Import save**, or grant live in the browser console on localhost:

```js
__lomTest.setupSpiritBoxTest()
```

That gives RP, souls, bag items, and **400 local test tokens**.

If the token button still shows 0 (a balance refresh wiped them), run:

```js
__lomTest.grantLocalTokens(400)
```

The Spirit Box note will say `(local test)` when these tokens are active. They spend without the worker. Production token opens still need the redeployed stats-worker.
