// Checks that systemui keeps asking com.palm.telephony/isTelephonyReady until
// the radio is connected, and then subscribes to platform and power state.
// The retry used to run with `this` unset and threw "this.checkTelephonyReady
// is not a function", so a modem not ready at the first check was never set
// up. Run with: node tests/telephonyservice-ready.test.js
//
// TelephonyService.js is loaded into a sandbox with just enough of enyo to
// capture the kind it declares; the methods are then called on a fake
// instance whose services only count calls, and timers are fired by hand.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load() {
	const kinds = {};
	const timers = [];
	const calls = [];
	const sandbox = {
		enyo: {
			kind: (def) => { kinds[def.name] = def; },
			// enyo 1.0 enyo.bind(scope, method): method may be a name
			bind: (scope, method) => {
				const fn = typeof method === "string" ? scope[method] : method;
				return function () { return fn.apply(scope, arguments); };
			},
			log: () => {},
			PalmService: function () {},
		},
		setTimeout: (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length; },
		clearTimeout: (id) => { if (id && timers[id - 1]) timers[id - 1].live = false; },
	};
	vm.createContext(sandbox);
	const src = fs.readFileSync(path.join(__dirname, "..", "data", "TelephonyService.js"), "utf8");
	vm.runInContext(src, sandbox);
	const def = kinds.TelephonyService;
	const svc = (name) => ({ call: () => { calls.push(name); } });
	const obj = Object.assign(Object.create(def), {
		$: {
			checkTelephonyReady: svc("isTelephonyReady"),
			platformQuery: svc("platformQuery"),
			powerQuery: svc("powerQuery"),
		},
	});
	// Fire pending timers as a browser does: plain call, `this` not the kind.
	const fire = () => {
		const due = timers.filter((t) => t.live);
		due.forEach((t) => { t.live = false; t.fn(); });
		return due.length;
	};
	const pending = () => timers.filter((t) => t.live);
	return { obj, calls, fire, pending };
}

const notReady = { returnValue: true, extended: { radioConnected: false } };
const ready = { returnValue: true, extended: { radioConnected: true } };

let failed = 0;
function test(name, fn) {
	try { fn(); console.log("ok   " + name); }
	catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message); }
}

test("radio connected at first check: platform and power queried, no retry", () => {
	const { obj, calls, pending } = load();
	obj.processServiceStatus(null, { connected: true });
	obj.processTelephonyReady(null, ready);
	assert.deepStrictEqual(calls, ["isTelephonyReady", "platformQuery", "powerQuery"]);
	assert.strictEqual(pending().length, 0);
});

test("radio not connected: isTelephonyReady asked again after 5 s", () => {
	const { obj, calls, fire, pending } = load();
	obj.processServiceStatus(null, { connected: true });
	obj.processTelephonyReady(null, notReady);
	assert.strictEqual(pending().length, 1);
	assert.strictEqual(pending()[0].ms, 5000);
	fire();
	assert.deepStrictEqual(calls, ["isTelephonyReady", "isTelephonyReady"]);
});

test("radio connects later: set up once it does", () => {
	const { obj, calls, fire } = load();
	obj.processServiceStatus(null, { connected: true });
	obj.processTelephonyReady(null, notReady);
	fire();
	obj.processTelephonyReady(null, notReady);
	fire();
	obj.processTelephonyReady(null, ready);
	assert.deepStrictEqual(calls, ["isTelephonyReady", "isTelephonyReady",
		"isTelephonyReady", "platformQuery", "powerQuery"]);
});

test("error reply (returnValue false): retried too", () => {
	const { obj, calls, fire } = load();
	obj.processTelephonyReady(null, { returnValue: false, errorText: "x" });
	fire();
	assert.deepStrictEqual(calls, ["isTelephonyReady"]);
});

test("telephonyd restarted while a retry is pending: still one retry", () => {
	const { obj, pending } = load();
	obj.processServiceStatus(null, { connected: true });
	obj.processTelephonyReady(null, notReady);
	obj.processServiceStatus(null, { connected: true });
	obj.processTelephonyReady(null, notReady);
	assert.strictEqual(pending().length, 1);
});

if (failed) {
	console.log(failed + " failed");
	process.exit(1);
}
console.log("all passed");
