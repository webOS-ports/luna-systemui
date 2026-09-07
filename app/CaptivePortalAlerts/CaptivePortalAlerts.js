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
 * Dashboard shown while a connected network sits behind a captive portal
 * (opened by ConnectionManagerService). Tapping it opens the browser on the
 * portal's login page; the service closes the dashboard once the network is
 * online or disconnected.
 */

enyo.kind({
	name: "CaptivePortalDashboard",
	kind: "HFlexBox",
	className: "dashboard-window",
	components: [
		{
			kind: enyo.Control,
			className: "dashboard-notification-module single",
			components: [
				{
					className: "palm-dashboard-icon-container", components:[
					{
						className: "palm-dashboard-icon",
						style: "background-image: url(../../images/net_portal_48.png);"
					}
				]},
				{
					className: "palm-dashboard-text-container",
					components: [{
						className: "dashboard-title",
						content: $L("Network Login Required")
					}, {
						name: "message",
						content: $L("Tap to show Network Login"),
						className: "palm-dashboard-text normal"
					}]
				}
			]
		},
		{kind: "ApplicationEvents", onWindowParamsChange: "windowParamsChange"},
		{
			kind: enyo.PalmService, name: "launchBrowser", service: "palm://com.palm.applicationManager/", method: "open"
		}
	],

	create: function() {
		this.inherited(arguments);
		this.readWindowParams();
	},

	windowParamsChange: function() {
		this.readWindowParams();
	},

	readWindowParams: function() {
		var params = enyo.windowParams || {};
		if (typeof params === "string") {
			try {
				params = enyo.json.parse(params);
			} catch (e) {
				params = {};
			}
		}
		this.portalUrl = params.url || "";
		if (params.ssid) {
			var msg = $L("Tap to log in to {$ssid}");
			this.$.message.setContent(enyo.macroize(msg, {ssid: params.ssid}));
		}
	},

	clickHandler: function(inSender) {
		// The portal hijacks any plain http request, so a probe url still
		// lands on the login page when connman gave us no explicit one
		var target = this.portalUrl || "http://www.gstatic.com/generate_204";
		this.$.launchBrowser.call({
			id: "org.webosports.app.atlas",
			params: {target: target}
		});
	}
});
