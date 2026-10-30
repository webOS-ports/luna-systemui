// Checks that one USB cable shows one storage alert. At start-up the MSMAvail
// signal and the hostIsConnected reply both report the same cable, moments
// apart; a popup still opening is not yet found by fetchWindow, so before
// this each opened its own. Run with: node tests/storagedservice-once.test.js
//
// StoragedService.js is loaded into a sandbox with just enough of enyo to
// capture the kind it declares; the methods are then called on a fake
// instance, with fetchWindow never finding the popup, as while it opens.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load() {
	const kinds = {};
	const opened = [];
	const sandbox = {
		enyo: {
			kind: (def) => { kinds[def.name] = def; },
			application: {
				getTelephonyService: () => ({ getOnActiveCall: () => false }),
				getSysUpdateService: () => ({ getUpdateAvailable: () => false }),
			},
			windows: {
				fetchWindow: () => null,
				openPopup: (url, name) => { opened.push(["popup", name]); },
				openDashboard: (url, name) => { opened.push(["dashboard", name]); },
			},
			g11n: { currentLocale: () => ({ locale: "en_us" }) },
			PalmService: function () {},
		},
	};
	vm.createContext(sandbox);
	const src = fs.readFileSync(path.join(__dirname, "..", "data", "StoragedService.js"), "utf8");
	vm.runInContext(src, sandbox);
	const def = Object.values(kinds)[0];
	const obj = Object.assign(Object.create(def), { isUSBConnected: false });
	return { obj, opened };
}

let failed = 0;
function test(name, fn) {
	try { fn(); console.log("ok   " + name); }
	catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message); }
}

test("signal then hostIsConnected reply: one alert", () => {
	const { obj, opened } = load();
	obj.storageHandleNotifications(null, { "mode-avail": true });
	obj.handleHostIsConnected(null, { result: true, hostIsConnected: true });
	assert.deepStrictEqual(opened, [["popup", "StorageModeAlert"]]);
});

test("hostIsConnected reply then signal: one alert", () => {
	const { obj, opened } = load();
	obj.handleHostIsConnected(null, { result: true, hostIsConnected: true });
	obj.storageHandleNotifications(null, { "mode-avail": true });
	assert.deepStrictEqual(opened, [["popup", "StorageModeAlert"]]);
});

test("a repeated signal (storaged restarted) shows no second alert", () => {
	const { obj, opened } = load();
	obj.storageHandleNotifications(null, { "mode-avail": true });
	obj.storageHandleNotifications(null, { "mode-avail": true });
	assert.strictEqual(opened.length, 1);
});

test("unplug and plug again shows the alert again", () => {
	const { obj, opened } = load();
	obj.closeUSBAlerts = () => {};
	obj.storageHandleNotifications(null, { "mode-avail": true });
	obj.storageHandleNotifications(null, { "mode-avail": false });
	obj.storageHandleNotifications(null, { "mode-avail": true });
	assert.strictEqual(opened.length, 2);
	assert.strictEqual(obj.isUSBConnected, true);
});

test("no cable: no alert", () => {
	const { obj, opened } = load();
	obj.handleHostIsConnected(null, { result: true, hostIsConnected: false });
	assert.deepStrictEqual(opened, []);
	assert.strictEqual(obj.isUSBConnected, false);
});

if (failed) {
	console.log(failed + " failed");
	process.exit(1);
}
console.log("all passed");
