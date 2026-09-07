// @@@LICENSE
//
//      Copyright (c) 2026 Herman van Hazendonk <github.com@herrie.org>
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
 * Watches the connection manager for captive portal detection.
 *
 * webos-connman-adapter reports onInternet: "captivePortal" (plus a
 * captivePortalUrl) on a connected service that is stuck behind a network
 * login page. Modeled on the legacy webOS com.palm.app.network behavior:
 * post a "Network Login Required" banner and a dashboard whose tap opens
 * the browser on the portal's login page, and clear both once the network
 * is properly online (or gone).
 */

enyo.kind({
	name: "ConnectionManagerService",
	kind: enyo.Component,

	components: [
		{kind:"PalmService", name:"getStatus", service:"palm://com.webos.service.connectionmanager/", method:"getstatus", subscribe:true, resubscribe:true, onResponse:"handleConnectionStatus"}
	],

	create: function() {
		this.inherited(arguments);
		this.captivePortalActive = false;
		this.$.getStatus.call({"subscribe": true});
	},

	handleConnectionStatus: function(inSender, inResponse) {
		if (!inResponse || inResponse.returnValue === false)
			return;

		var portal = this.findCaptivePortal(inResponse);

		if (portal) {
			this.showCaptivePortalDashboard(portal);
		}
		else {
			this.closeCaptivePortalDashboard();
		}
	},

	/*
	 * Returns {url, ssid} for the first connected service reporting a
	 * captive portal, or null when there is none.
	 */
	findCaptivePortal: function(status) {
		var interfaces = ["wifi", "wired", "cellular"];
		for (var i = 0; i < interfaces.length; i++) {
			var info = status[interfaces[i]];
			if (info && info.state === "connected" && info.onInternet === "captivePortal") {
				return {
					url: info.captivePortalUrl || "",
					ssid: info.ssid || ""
				};
			}
		}
		return null;
	},

	showCaptivePortalDashboard: function(portal) {
		var wCard = enyo.windows.fetchWindow("CaptivePortalDashboard");
		if (wCard) {
			// Keep the login url current if the portal changed underneath us
			enyo.windows.setWindowParams(wCard, portal);
			return;
		}

		if (!this.captivePortalActive) {
			this.captivePortalActive = true;
			this.bannerMsgId = enyo.windows.addBannerMessage($L("Network Login Required"), "{}", "/usr/palm/applications/com.palm.systemui/images/net_portal_sum_24.png");
		}

		enyo.windows.openDashboard("app/CaptivePortalAlerts/captiveportalalerts.html", "CaptivePortalDashboard", portal, {
			"icon": "/usr/palm/applications/com.palm.systemui/images/net_portal_sum_24.png"
		});
	},

	closeCaptivePortalDashboard: function() {
		this.captivePortalActive = false;

		// The banner maps to a sticky toast on LuneOS, so it has to be
		// withdrawn like legacy NetworkApp did, or stale "Network Login
		// Required" entries pile up in the notification area
		if (this.bannerMsgId) {
			enyo.windows.removeBannerMessage(this.bannerMsgId);
			this.bannerMsgId = null;
		}

		var wCard = enyo.windows.fetchWindow("CaptivePortalDashboard");
		if (wCard)
			wCard.close();
	}
});
