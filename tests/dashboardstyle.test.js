// Checks that a dashboard is drawn as a tablet's or a phone's by the shell's
// notificationStyle, and by TabletUi or else the window's shape only for
// "auto". Run with: node tests/dashboardstyle.test.js
//
// utils/dashboardstyle.js is loaded into a sandbox with a stand-in for the
// page and for enyo.PalmService, which records the call and lets the test
// answer it as the system service would.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(opts) {
	opts = opts || {};
	const calls = [];
	const listeners = {};
	const sandbox = {
		window: {
			innerWidth: opts.width || 720,
			innerHeight: opts.height || 90,
			addEventListener: (name, fn) => { listeners[name] = fn; },
		},
		document: { documentElement: { className: opts.className || "" } },
		enyo: {
			bind: (obj, name) => (...args) => obj[name](...args),
			Component: function () {},
			PalmService: function () {},
			kind: (def) => function () {
				const self = this;
				this.$ = {
					prefs: { call: (args) => calls.push({ args, subscribe: def.components[0].subscribe, answer: (r) => def[def.components[0].onSuccess](self, r) }) },
				};
			},
		},
	};
	if (opts.deviceInfo !== undefined) {
		sandbox.PalmSystem = { deviceInfo: opts.deviceInfo };
	}
	sandbox.window.PalmSystem = sandbox.PalmSystem;
	vm.createContext(sandbox);
	const src = fs.readFileSync(path.join(__dirname, "..", "utils", "dashboardstyle.js"), "utf8");
	vm.runInContext(src, sandbox);
	return {
		sandbox, calls, listeners,
		tablet: () => sandbox.document.documentElement.className.split(/\s+/).indexOf("luneos-tablet") >= 0,
	};
}

let failed = 0;
function test(name, fn) {
	try { fn(); console.log("ok   " + name); }
	catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message); }
}

test("asks for notificationStyle, and keeps listening", () => {
	const { calls } = load();
	assert.strictEqual(calls.length, 1);
	assert.strictEqual(JSON.stringify(calls[0].args.keys), JSON.stringify(["notificationStyle"]));
	assert.strictEqual(calls[0].subscribe, true, "a change in Settings must reach an open dashboard");
});

test("tablet style at the bottom: the screen's width is still a tablet's row", () => {
	const t = load({ width: 720, height: 90 });
	assert.strictEqual(t.tablet(), false, "before the answer, the shape: a phone's");
	t.calls[0].answer({ notificationStyle: "tablet" });
	assert.strictEqual(t.tablet(), true);
});

test("phone style in the drop-down: a tablet's shape is still a phone's pill", () => {
	const t = load({ width: 480, height: 90 });
	assert.strictEqual(t.tablet(), true, "before the answer, the shape: a tablet's");
	t.calls[0].answer({ notificationStyle: "phone" });
	assert.strictEqual(t.tablet(), false);
});

test("a change in Settings comes through", () => {
	const t = load();
	t.calls[0].answer({ notificationStyle: "tablet" });
	assert.strictEqual(t.tablet(), true);
	t.calls[0].answer({ notificationStyle: "phone" });
	assert.strictEqual(t.tablet(), false);
});

test("auto follows TabletUi when WAM says it", () => {
	const phone = load({ width: 480, height: 90, deviceInfo: JSON.stringify({ tabletUi: false }) });
	phone.calls[0].answer({ notificationStyle: "auto" });
	assert.strictEqual(phone.tablet(), false);
	const tablet = load({ width: 720, height: 90, deviceInfo: { tabletUi: true } });
	tablet.calls[0].answer({ notificationStyle: "auto" });
	assert.strictEqual(tablet.tablet(), true);
});

test("auto without TabletUi, or anything not on offer: the shape", () => {
	for (const style of ["auto", "watch", undefined, 3]) {
		const wide = load({ width: 720, height: 90, deviceInfo: "not json" });
		wide.calls[0].answer({ notificationStyle: style });
		assert.strictEqual(wide.tablet(), false, String(style) + " wide");
		const narrow = load({ width: 480, height: 90 });
		narrow.calls[0].answer({ notificationStyle: style });
		assert.strictEqual(narrow.tablet(), true, String(style) + " narrow");
	}
});

test("a resize is looked at again", () => {
	const t = load({ width: 480, height: 90 });
	assert.strictEqual(t.tablet(), true);
	t.sandbox.window.innerWidth = 720;
	t.listeners.resize();
	assert.strictEqual(t.tablet(), false);
});

test("the page's other classes are left alone", () => {
	const t = load({ className: "enyo-body something" });
	t.calls[0].answer({ notificationStyle: "tablet" });
	t.calls[0].answer({ notificationStyle: "tablet" });
	assert.strictEqual(t.sandbox.document.documentElement.className, "enyo-body something luneos-tablet");
	t.calls[0].answer({ notificationStyle: "phone" });
	assert.strictEqual(t.sandbox.document.documentElement.className, "enyo-body something");
});

if (failed) {
	console.log(failed + " failed");
	process.exit(1);
}
console.log("all passed");
