// @@@LICENSE
//
//      Copyright (c) 2026 LuneOS
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// LICENSE@@@

/*
 * Whether a dashboard is drawn as a tablet's (webOS 3.0.5's drop-down row)
 * or a phone's (webOS 2.2.4's pill), as the shell draws its own entries:
 * Settings' notificationStyle, "phone" or "tablet", and for "auto" the
 * device's TabletUi (luna-next-cardshell's NotificationLayout). The page's
 * <html> carries "luneos-tablet" for the one and not the other, and
 * dashboard.css keys on that.
 *
 * Telling them apart by the window's shape, as dashboard.css did, is wrong
 * once the style and the place are chosen apart: a tablet-style list at the
 * bottom is the screen's width, a phone's shape, and a phone-style one in
 * the status bar's drop-down a tablet's. The shape is only the fallback for
 * "auto" from a WAM that does not say TabletUi.
 */

DashboardStyle = {
	style: "auto",

	// Wider than this, an entry is a phone's: a tablet's is the drop-down's
	// gu(30) by gu(5.6), 5.36 to 1, a phone's the screen's width, 7.6 to 1
	// or more.
	tabletMaxAspect: 13 / 2,

	tabletUi: function() {
		var info = window.PalmSystem && PalmSystem.deviceInfo;
		if (typeof info === "string") {
			try {
				info = JSON.parse(info);
			} catch (e) {
				info = null;
			}
		}
		return info && typeof info.tabletUi === "boolean" ? info.tabletUi : undefined;
	},

	isTablet: function(style, tabletUi, width, height) {
		if (style === "tablet") {
			return true;
		}
		if (style === "phone") {
			return false;
		}
		if (typeof tabletUi === "boolean") {
			return tabletUi;
		}
		return height > 0 && width / height <= this.tabletMaxAspect;
	},

	apply: function() {
		var tablet = this.isTablet(this.style, this.tabletUi(), window.innerWidth, window.innerHeight);
		var root = document.documentElement;
		var classes = (root.className || "").split(/\s+/).filter(function(c) {
			return c && c !== "luneos-tablet";
		});
		if (tablet) {
			classes.push("luneos-tablet");
		}
		root.className = classes.join(" ");
	},

	stylePrefsFetched: function(inSender, inResponse) {
		var style = inResponse && inResponse.notificationStyle;
		this.style = typeof style === "string" ? style : "auto";
		this.apply();
	},

	start: function() {
		this.apply();
		window.addEventListener("resize", enyo.bind(this, "apply"), false);
		var Prefs = enyo.kind({
			kind: enyo.Component,
			components: [
				{name: "prefs", kind: enyo.PalmService, service: "palm://com.palm.systemservice/",
					method: "getPreferences", subscribe: true, onSuccess: "fetched"}
			],
			fetched: enyo.bind(this, "stylePrefsFetched")
		});
		this.prefs = new Prefs();
		this.prefs.$.prefs.call({keys: ["notificationStyle"]});
	}
};

DashboardStyle.start();
