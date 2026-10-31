// Checks that StoragedAlerts never starts File Transfer (MTP) while the
// device is locked. Run with: node tests/storagedalerts-lock.test.js
//
// StoragedAlerts.js is loaded into a sandbox with just enough of enyo to
// capture the kinds it declares; the methods are then called on fake
// instances that record which services were called.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(locked) {
	const kinds = {};
	const sandbox = {
		enyo: {
			kind: (def) => { kinds[def.name] = def; },
			application: { isDeviceLocked: () => locked.value },
			windows: { fetchWindow: () => null, openDashboard: () => {} },
			json: { stringify: JSON.stringify },
			PalmService: function () {},
		},
		$L: (s) => s,
		close: () => { sandbox.closed = true; },
		closed: false,
	};
	vm.createContext(sandbox);
	const src = fs.readFileSync(path.join(__dirname, "..", "app", "StoragedAlerts", "StoragedAlerts.js"), "utf8");
	vm.runInContext(src, sandbox);
	return { kinds, sandbox };
}

function instance(def, extra) {
	const calls = [];
	const svc = (name) => ({ call: (args) => calls.push([name, args]) });
	const obj = Object.assign(Object.create(def), {
		$: { enterMSMMode: svc("enterMSM"), exitMSMMode: svc("exitMSM"), unlock: svc("unlock") },
	}, extra || {});
	return { obj, calls };
}

const names = (calls) => calls.map((c) => c[0]);
let failed = 0;
function test(name, fn) {
	try { fn(); console.log("ok   " + name); }
	catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message); }
}

test("alert: locked device does not enter MTP, asks for unlock", () => {
	const locked = { value: true };
	const { kinds, sandbox } = load(locked);
	const { obj, calls } = instance(kinds.StorageAlert);
	obj.enterMSM();
	assert.deepStrictEqual(names(calls), ["unlock"]);
	assert.strictEqual(sandbox.closed, false, "alert must stay open so the user can retry");
});

test("alert: unlocked device enters MTP", () => {
	const { kinds, sandbox } = load({ value: false });
	const { obj, calls } = instance(kinds.StorageAlert);
	obj.enterMSM();
	assert.deepStrictEqual(names(calls), ["enterMSM"]);
	assert.strictEqual(sandbox.closed, true);
});

test("dashboard: locked device does not enter MTP", () => {
	const { kinds } = load({ value: true });
	const { obj, calls } = instance(kinds.USBDashboard, { inMSM: false });
	obj.clickHandler();
	assert.deepStrictEqual(names(calls), ["unlock"]);
});

test("dashboard: locked device can still stop MTP", () => {
	const { kinds } = load({ value: true });
	const { obj, calls } = instance(kinds.USBDashboard, { inMSM: true });
	obj.clickHandler();
	assert.deepStrictEqual(names(calls), ["exitMSM"]);
});

test("dashboard: unlocked device enters MTP", () => {
	const { kinds } = load({ value: false });
	const { obj, calls } = instance(kinds.USBDashboard, { inMSM: false });
	obj.clickHandler();
	assert.deepStrictEqual(names(calls), ["enterMSM"]);
});

process.exitCode = failed ? 1 : 0;
