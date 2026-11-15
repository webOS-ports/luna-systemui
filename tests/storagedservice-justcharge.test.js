// Just charge by default (Tweaks > System > USB, on by default): a cable plugged in goes
// straight to the USB dashboard, as if Charge only had been tapped, and the
// File Transfer / Charge only prompt is not shown. Until the Tweaks service
// answers, a prompt waits for the answer; no answer, or no such tweak, is on.
// Run with: node tests/storagedservice-justcharge.test.js
//
// As storagedservice-once.test.js: StoragedService.js in a sandbox with just
// enough of enyo, its methods called on a fake instance.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(options) {
	options = options || {};
	const kinds = {};
	const opened = [];
	const state = { onCall: !!options.onCall };
	const sandbox = {
		enyo: {
			kind: (def) => { kinds[def.name] = def; },
			application: {
				getTelephonyService: () => ({ getOnActiveCall: () => state.onCall }),
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
	if ("justCharge" in options)
		obj.justCharge = options.justCharge;
	obj.closeUSBAlerts = () => {};
	return { obj, opened, state };
}

const PLUG = { "mode-avail": true };
const UNPLUG = { "mode-avail": false };
const DASHBOARD = [["dashboard", "USBDashboard"]];
const PROMPT = [["popup", "StorageModeAlert"]];

let failed = 0;
function test(name, fn) {
	try { fn(); console.log("ok   " + name); }
	catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message); }
}

test("on: a cable goes to the dashboard, no prompt", () => {
	const { obj, opened } = load({ justCharge: true });
	obj.storageHandleNotifications(null, PLUG);
	assert.deepStrictEqual(opened, DASHBOARD);
});

test("on: a cable found at start-up goes to the dashboard too", () => {
	const { obj, opened } = load({ justCharge: true });
	obj.handleHostIsConnected(null, { result: true, hostIsConnected: true });
	assert.deepStrictEqual(opened, DASHBOARD);
});

test("off: the prompt, as before", () => {
	const { obj, opened } = load({ justCharge: false });
	obj.storageHandleNotifications(null, PLUG);
	assert.deepStrictEqual(opened, PROMPT);
});

test("not known yet: nothing until the answer, then the prompt it asks for", () => {
	const { obj, opened } = load();
	obj.storageHandleNotifications(null, PLUG);
	assert.deepStrictEqual(opened, []);
	obj.handleJustChargeTweak(null, { returnValue: true, justChargeByDefault: false });
	assert.deepStrictEqual(opened, PROMPT);
});

test("not known yet: an answer of on, the dashboard", () => {
	const { obj, opened } = load();
	obj.storageHandleNotifications(null, PLUG);
	obj.handleJustChargeTweak(null, { returnValue: true, justChargeByDefault: true });
	assert.deepStrictEqual(opened, DASHBOARD);
});

test("no such tweak (its file not installed): on", () => {
	const { obj, opened } = load();
	obj.storageHandleNotifications(null, PLUG);
	obj.handleJustChargeTweak(null, { returnValue: true });
	assert.deepStrictEqual(opened, DASHBOARD);
	assert.strictEqual(obj.justCharge, true);
});

test("the Tweaks service fails: on", () => {
	const { obj, opened } = load();
	obj.storageHandleNotifications(null, PLUG);
	obj.handleJustChargeTweak(null, { returnValue: false, errorText: "Unknown service" });
	assert.deepStrictEqual(opened, DASHBOARD);
});

test("no answer in time: on", () => {
	const { obj, opened } = load();
	obj.storageHandleNotifications(null, PLUG);
	obj.setJustCharge(true); // what create()'s JUST_CHARGE_WAIT_MS timer does
	assert.deepStrictEqual(opened, DASHBOARD);
});

test("unplugged before the answer: nothing", () => {
	const { obj, opened } = load();
	obj.storageHandleNotifications(null, PLUG);
	obj.storageHandleNotifications(null, UNPLUG);
	obj.handleJustChargeTweak(null, { returnValue: true, justChargeByDefault: false });
	assert.deepStrictEqual(opened, []);
});

test("a call came in before the answer: the dashboard, not the prompt", () => {
	const { obj, opened, state } = load();
	obj.storageHandleNotifications(null, PLUG);
	state.onCall = true;
	obj.handleJustChargeTweak(null, { returnValue: true, justChargeByDefault: false });
	assert.deepStrictEqual(opened, DASHBOARD);
});

test("turned off in Tweaks: the next cable gets the prompt", () => {
	const { obj, opened } = load({ justCharge: true });
	obj.storageHandleNotifications(null, PLUG);
	obj.storageHandleNotifications(null, UNPLUG);
	obj.handleJustChargeTweak(null, { owner: "com.palm.systemui", justChargeByDefault: false, returnValue: true, fired: true });
	assert.deepStrictEqual(opened, DASHBOARD);
	obj.storageHandleNotifications(null, PLUG);
	assert.deepStrictEqual(opened, DASHBOARD.concat(PROMPT));
});

test("a later answer without the key leaves the setting as it is", () => {
	const { obj } = load({ justCharge: false });
	obj.handleJustChargeTweak(null, { returnValue: true, subscribed: true });
	assert.strictEqual(obj.justCharge, false);
});

test("the shipped tweak: on by default, under System > usb", () => {
	const file = path.join(__dirname, "..", "files", "tweaks", "com.palm.systemui.json");
	const entries = JSON.parse(fs.readFileSync(file, "utf8"));
	assert.strictEqual(entries.length, 1);
	assert.strictEqual(entries[0].owner, "com.palm.systemui");
	assert.strictEqual(entries[0].category, "system");
	const tweak = entries[0].prefs.find((p) => p.key === "justChargeByDefault");
	assert.ok(tweak, "justChargeByDefault declared");
	assert.strictEqual(tweak.type, "ToggleButton");
	assert.strictEqual(tweak.value, true);
	assert.strictEqual(tweak.group, "usb");
	assert.strictEqual(tweak.label, "Just charge by default");
});

if (failed) {
	console.log(failed + " failed");
	process.exit(1);
}
console.log("all passed");
