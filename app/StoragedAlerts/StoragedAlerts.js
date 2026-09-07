// @@@LICENSE
//
//      Copyright (c) 2010-2012 Hewlett-Packard Development Company, L.P.
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
 * USB mode selector, shown when a USB host is connected. Android-style: the
 * user picks File Transfer (MTP, served by umtprd via com.palm.storage) or
 * Charge only. Modelled on PowerdAlerts' multi-button PowerOffAlert.
 */

enyo.kind({
	name: "StorageAlert",
	kind: "VFlexBox",
	components: [
		{
			kind: enyo.Control,
			className: "notification-container",
			domAttributes:{
				"x-palm-popup-content": " "
			},
			components: [
				{
					className: "notification-icon icon-drive-mode"
				},
				{
					className: "notification-text",
					components: [
						{
							className: "title",
							content: $L("USB Connected")
						},
						{
							className: "message",
							content: $L("Choose how to use the USB connection.")
						}
					]
				}
			]
		 },
		 {kind: "ApplicationEvents", onWindowDeactivated:"handleWindowDeActivated"},
		 {kind: "NotificationButton", className:"enyo-notification-button-affirmative", layoutKind:"HFlexLayout",
			 components:[
		                   {flex:1, content: $L("File Transfer"), onclick: "enterMSM"},
		                   {name:"infoIcon", className:"info-icon", onclick: "showInfo"}
		                ]
		 },
		 {kind: "NotificationButton", className: "enyo-notification-button", layoutKind:"HFlexLayout", pack:"center", onclick:"charge", components:[{content: $L("Charge only")}]},
		 {
		 	kind:enyo.PalmService, name:"enterMSMMode", service:"palm://com.palm.storage/diskmode/", method:"enterMSM"
		 },
		 {
		 	kind:enyo.PalmService, name:"launchHelp", service:"palm://com.palm.applicationManager/", method:"open"
		 },
		 {
			 kind:enyo.PalmService, name:"unlock", service:"palm://com.palm.display/control/", method:"setState"
		 }
	],

	create: function() {
		this.inherited(arguments);
		this.tapOnButton = false;
	},

	// One tap enters MTP. Legacy code bailed out here when the device was
	// locked (leaving the user stuck on the lockscreen) and forced a second
	// "warning" popup; neither is wanted for a plain file-transfer toggle.
	enterMSM: function(inSender) {
		this.tapOnButton = true;
		if(enyo.application.isDeviceLocked()) {
			this.$.unlock.call({state:"undock"});
		}
		this.$.enterMSMMode.call({"user-confirmed": true, "enterIMasq": false});
		this.createUSBDashboard();
		close();
	},

	showInfo: function(inSender) {
		var callParams = {
      		id: 'com.palm.app.help',
      		params: {
          		target: "http://help.palm.com/basics/copy_files/basics_media_sync_help.html"
      		}
  		};
		this.$.launchHelp.call(callParams);
		this.charge();
	},

	createUSBDashboard: function() {
		var wCard = enyo.windows.fetchWindow("USBDashboard");
		if(!wCard) {
			enyo.windows.openDashboard("storagedalerts.html", "USBDashboard", enyo.json.stringify({}), {
				"icon": "/usr/palm/applications/com.palm.systemui/images/notification-small-usb.png"
			});
		}
	},

	// "Charge only" - leave the gadget as it is (charging) and drop a dashboard
	// so the user can switch to File Transfer later.
	charge: function() {
		this.tapOnButton = true;
		this.createUSBDashboard();
		close();
	},

	handleWindowDeActivated: function() {
		if(!this.tapOnButton) {
			this.createUSBDashboard();
		}
	},

});

/*
 * Persistent USB dashboard. Android-style: it shows the current USB mode and
 * lets the user switch. It tracks the mode live by subscribing to storaged's
 * MSMStatus signal (the addmatch pattern used by PowerdService), so it stays
 * correct across enter/exit without polling.
 */

enyo.kind({
	name: "USBDashboard",
	kind: "HFlexBox",
	className:"dashboard-window",
	inMSM: false,
	components: [
		{
			kind: enyo.Control,
			className: "dashboard-notification-module single",
			onclick: "clickHandler",
			components: [
				{
					className: "palm-dashboard-icon-container", components:[
					{
						name: "dashboard-icon",
						className: "palm-dashboard-icon charging"
					}
				]},
				{
					className: "palm-dashboard-text-container",
					components: [{
						className: "dashboard-title",
						content: $L("USB")
					}, {
						name: "dashText",
						content: $L("Charging — tap for File Transfer"),
						className: "palm-dashboard-text normal"
					}]
				}
			]
		},
		{
			kind:enyo.PalmService, name:"hostIsConnected", service:"palm://com.palm.storage/diskmode/", method:"hostIsConnected", onResponse:"handleHostIsConnected"
		},
		{
			kind:enyo.PalmService, name:"queryMSMStatus", service:"palm://com.palm.storage/diskmode/", method:"queryMSMStatus", onResponse:"handleMSMStatus"
		},
		{
			// Live MSM state updates, mirroring PowerdService's signal addmatch.
			kind:enyo.PalmService, name:"msmStatusSignal", service:"palm://com.palm.bus/signal/", method:"addmatch", subscribe:true, onResponse:"handleMSMStatus"
		},
		{
		 	kind:enyo.PalmService, name:"enterMSMMode", service:"palm://com.palm.storage/diskmode/", method:"enterMSM"
		},
		{
			// Leaving File Transfer: com.palm.storage treats "media no longer
			// available on the host" as the trigger to disable MTP (stop
			// umtprd and restore the charge-only gadget).
			kind:enyo.PalmService, name:"exitMSMMode", service:"palm://com.palm.storage/diskmode/", method:"avail"
		},
		{
			 kind:enyo.PalmService, name:"unlock", service:"palm://com.palm.display/control/", method:"setState"
		 }
	],

	create: function() {
		this.inherited(arguments);
		this.$.hostIsConnected.call();
		this.$.queryMSMStatus.call();
		this.$.msmStatusSignal.call({"category":"/storaged", "method":"MSMStatus"});
	},

	handleHostIsConnected: function(inSender, inResponse) {
		if(inResponse.hostIsConnected != undefined && !inResponse.hostIsConnected) {
			close();
		}
	},

	handleMSMStatus: function(inSender, inResponse) {
		if(inResponse && inResponse.inMSM != undefined) {
			this.inMSM = inResponse.inMSM;
			if(this.$.dashText) {
				this.$.dashText.setContent(this.inMSM
					? $L("File Transfer — tap to stop")
					: $L("Charging — tap for File Transfer"));
			}
		}
	},

	clickHandler: function(inSender) {
		if(enyo.application.isDeviceLocked()) {
			this.$.unlock.call({state:"undock"});
		}
		if(this.inMSM) {
			this.$.exitMSMMode.call({"connected": false});
		} else {
			this.$.enterMSMMode.call({"user-confirmed": true, "enterIMasq": false});
		}
	},


});

/*
 * Popup Alert for StroageD Error(fsck).
 */

enyo.kind({
	name: "StorageErrorAlert",
	kind: "VFlexBox",
	components: [
		{
			kind: enyo.Control,
			className: "notification-container",
			domAttributes:{
				"x-palm-popup-content": " "
			},
			components: [
				{
					className: "notification-icon icon-warning"
				},
				{
					className: "notification-text",
					components: [
						{
							className: "message",
							allowHtml: true,
							name:"fsckerror",
							content: $L("Some data was damaged,<br />but has been recovered.<br />Always eject your device<br /> from your desktop computer<br /> before disconnecting.")
						},
						{
							className: "message",
							name:"formaterror",
							allowHtml:true,
							content: $L("No data was recoverable. The USB drive has been reformatted. <br> Always eject your device from your desktop computer before disconnecting.")
						}
					]
				}
			]
		 },
		 {kind: "NotificationButton", className: "enyo-notification-button", layoutKind:"HFlexLayout", pack:"center", onclick:"closeAlert", components:[{content: $L("OK")}]}
	],

	create: function() {
		this.inherited(arguments);
		this.params = enyo.windowParams;
		if(this.params.formatError) {
			this.$.fsckerror.setShowing(false);
			this.$.formaterror.setShowing(true);
		}

		if(this.params.fsckError) {
			this.$.fsckerror.setShowing(true);
			this.$.formaterror.setShowing(false);
		}
	},


	closeAlert: function() {
		close();
	},
});
