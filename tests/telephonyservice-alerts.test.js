// Checks two alert paths of TelephonyService.js: a CDMA WAN error alert used
// to throw a ReferenceError instead of opening, and the network denied
// dashboard was looked up under a misspelt name when the phone got back on
// its home network, which threw and left the dashboard open.
// Run with: node tests/telephonyservice-alerts.test.js
//
// TelephonyService.js is loaded into a sandbox with just enough of enyo to
// capture the kind it declares; enyo.windows is a fake that knows the windows
// opened so far by name, as the real one does.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(openWindows) {
	const kinds = {};
	const popups = [];
	const closed = [];
	const fetchWindow = (name) => {
		if (openWindows.indexOf(name) === -1)
			return undefined;
		return { close: () => { closed.push(name); } };
	};
	const sandbox = {
		enyo: {
			kind: (def) => { kinds[def.name] = def; },
			log: () => {},
			PalmService: function () {},
			windows: {
				fetchWindow,
				openPopup: (url, name, params, attrs, height) => {
					popups.push({ url, name, params, height });
				},
			},
		},
		SystemPreferences: {},
	};
	vm.createContext(sandbox);
	const src = fs.readFileSync(path.join(__dirname, "..", "data", "TelephonyService.js"), "utf8");
	vm.runInContext(src, sandbox);
	const obj = Object.assign(Object.create(kinds.TelephonyService), { phoneRadioState: true });
	return { obj, popups, closed };
}

// An attached internet connection that failed with this Mobile IP code.
function wanFailure(mipFailureCode) {
	return {
		returnValue: true,
		networkstatus: "attached",
		connectedservices: [{ service: ["internet"], mipFailureCode, causeCode: 0 }],
	};
}

let failed = 0;
function test(name, fn) {
	try { fn(); console.log("ok   " + name); }
	catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message); }
}

test("WAN error with help: alert opens and names the carrier", () => {
	const { obj, popups } = load([]);
	obj.carrierName = "Test Carrier";
	obj.handleWANNotifications(null, wanFailure(obj.wanErrorCodesWithHelp[0]));
	assert.strictEqual(popups.length, 1);
	assert.strictEqual(popups[0].name, "WANConnectionErrorAlert");
	assert.strictEqual(popups[0].height, 180);
	assert.strictEqual(popups[0].params.carrier, "Test Carrier");
	assert.strictEqual(popups[0].params.showHelp, true);
});

test("WAN error without help: alert opens and names the carrier", () => {
	const { obj, popups } = load([]);
	obj.carrierName = "Test Carrier";
	obj.handleWANNotifications(null, wanFailure(obj.wanErrorCodes[0]));
	assert.strictEqual(popups.length, 1);
	assert.strictEqual(popups[0].height, 125);
	assert.strictEqual(popups[0].params.carrier, "Test Carrier");
	assert.strictEqual(popups[0].params.showHelp, false);
});

test("back on the home network: network denied dashboard closes", () => {
	const { obj, closed } = load(["PhoneNetworkDeniedDash"]);
	obj.handleTelephonyNotifications(null, { eventNetwork: { state: "service", registration: "home" } });
	assert.deepStrictEqual(closed, ["PhoneNetworkDeniedDash"]);
});

test("back on the home network, no dashboard open: nothing closes", () => {
	const { obj, closed } = load([]);
	obj.handleTelephonyNotifications(null, { eventNetwork: { state: "service", registration: "home" } });
	assert.deepStrictEqual(closed, []);
});

test("roaming: network denied dashboard stays", () => {
	const { obj, closed } = load(["PhoneNetworkDeniedDash"]);
	obj.handleTelephonyNotifications(null, { eventNetwork: { state: "service", registration: "roaming" } });
	assert.deepStrictEqual(closed, []);
});

if (failed) {
	console.log(failed + " failed");
	process.exit(1);
}
console.log("all passed");
