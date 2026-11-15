// @@@LICENSE
//
//      Copyright (c) 2010-2012 Hewlett-Packard Development Company, L.P.
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

enyo.kind({
	name: "StoragedService",
	kind: enyo.Component,
	published: {
		isUSBConnected: false
	},
	
	components: [
		{kind:"PalmService", name:"msmAvail", service:"palm://com.palm.bus/signal/", method:"addmatch", subscribe:true, onResponse:"storageHandleNotifications"},
		{kind:"PalmService", name:"partitionAvail", service:"palm://com.palm.bus/signal/", method:"addmatch", subscribe:true, onResponse:"storageHandleErrorNotifications"},
		{
			kind:enyo.PalmService, name:"hostIsConnected", service:"palm://com.palm.storage/diskmode/", method:"hostIsConnected", onResponse:"handleHostIsConnected"
		},
		{
			// Tweaks > System > USB, "Just charge by default": followed while it changes.
			kind:enyo.PalmService, name:"justChargeTweak", service:"palm://org.webosports.service.tweaks.prefs/", method:"get", subscribe:true, onResponse:"handleJustChargeTweak"
		},
		
	],
	
	/*
	 * Just charge by default (Tweaks > System > USB, on unless turned off): a cable
	 * plugged in goes straight to the USB dashboard ("Charging - tap for File
	 * Transfer"), as if Charge only had been tapped, and the File Transfer /
	 * Charge only prompt is not shown - as the "just charge by default" patch
	 * did for legacy webOS.
	 *
	 * For now this also keeps the prompt from being drawn over another popup
	 * opened with it, such as "Device May Not Charge" (luna-next-cardshell
	 * #500), until the shell shows popups one at a time.
	 *
	 * undefined until the Tweaks service answers. A prompt due before then
	 * waits for the answer (promptPending), or for JUST_CHARGE_WAIT_MS; no
	 * answer, or no such tweak, is the default, on.
	 */
	justCharge: undefined,
	promptPending: false,
	JUST_CHARGE_WAIT_MS: 5000,
	
	create: function() {
		this.inherited(arguments);
		this.$.justChargeTweak.call({"owner": "com.palm.systemui", "key": "justChargeByDefault"});
		setTimeout(enyo.bind(this, function() {
			if (this.justCharge === undefined)
				this.setJustCharge(true);
		}), this.JUST_CHARGE_WAIT_MS);
		this.subscribeToNotifications();
		this.isUSBCableConnected();
	},
	
	handleJustChargeTweak: function(inSender, inResponse) {
		if (!inResponse || inResponse.returnValue === false) {
			if (this.justCharge === undefined)
				this.setJustCharge(true);
			return;
		}
		var value = inResponse.justChargeByDefault;
		if (typeof value === "boolean")
			this.setJustCharge(value);
		else if (this.justCharge === undefined)
			this.setJustCharge(true);
	},
	
	setJustCharge: function(justCharge) {
		this.justCharge = justCharge;
		if (!this.promptPending)
			return;
		this.promptPending = false;
		if (!this.isUSBConnected)
			return;
		if (this.canUSBAlertDisplayed())
			this.offerStorageMode();
		else
			this.createUSBDashboard();
	},
	
	/*
	 * The cable is in and nothing stands in the way of the prompt: the prompt,
	 * or with Just charge by default the dashboard it would have left.
	 */
	offerStorageMode: function() {
		if (this.justCharge === undefined) {
			this.promptPending = true;
			return;
		}
		if (this.justCharge)
			this.createUSBDashboard();
		else
			this.showStorageModeAlert();
	},
	
	subscribeToNotifications: function() {
		this.$.msmAvail.call({"category": "/storaged", "method": "MSMAvail"});
		this.$.partitionAvail.call({"category": "/storaged", "method": "PartitionAvail"});
	},
	
	/*
	 * Handle storage(mode-avail) notifications
	 */
	storageHandleNotifications: function(inSender, inResponse) {	
	    if (!inResponse || inResponse["mode-avail"] === undefined)
	        return;
	   
	    if (inResponse["mode-avail"]) {
			// Only a change to connected shows the alert: at start-up both this
			// signal and handleHostIsConnected report the same cable, within
			// moments of each other, and a popup still opening is not yet found
			// by fetchWindow, so each would open one.
			if (this.isUSBConnected)
				return;
			this.isUSBConnected = true;
			if (this.canUSBAlertDisplayed()) 
				this.offerStorageMode();
			else 
				this.createUSBDashboard();
		}
	    else {
			this.isUSBConnected = false;
			this.promptPending = false;
			this.closeUSBAlerts();
	    }
	},
	
	/*
	 * Show Storage Mode Alert
	 */
	showStorageModeAlert: function() {
		var wCard = enyo.windows.fetchWindow("StorageModeAlert");
		// The heading (title, a line of explanation and the 80px USB icon)
		// and two buttons, ending right on the gesture area. On a phone
		// (stylesheets/notifications.css, .phone-ui) the buttons are 52px
		// with the same visible gap as 2.2.4's around them: 210 in all, 81 of
		// it the heading. On a tablet, Enyo's own buttons under 3.0.5's
		// heading, at 3.0.5's 200.
		// Other languages get room for the explanation to wrap onto a second
		// line. The locale reads "en-US", not "en_us", so it is matched by
		// its language.
		var english = /^en([-_]|$)/i.test(enyo.g11n.currentLocale().locale || "");
		var tablet = typeof UiScale !== "undefined" && UiScale.tablet();
		var windowHeight = (tablet ? 200 : 210) + (english ? 0 : 20);
		if(!wCard)
			enyo.windows.openPopup("app/StoragedAlerts/storagedalerts.html", "StorageModeAlert", {}, undefined, windowHeight);
	},
	
	createUSBDashboard: function() {
		var wCard = enyo.windows.fetchWindow("USBDashboard");
		if(!wCard) {
			enyo.windows.openDashboard("app/StoragedAlerts/storagedalerts.html", "USBDashboard", {}, {
				"icon": "/usr/palm/applications/com.palm.systemui/images/notification-small-usb.png"
			});
		} 
	},
	
	/*
	 * Handler for Storaged MSM Error Notification
	 */
	storageHandleErrorNotifications: function(inSender, inResponse) {	
		 if (!inResponse)
	        return;
		
		if(inResponse.reformatted) {
			this.showMSMErrorAlert(true);
		}
		else if(inResponse.fscked) {
			this.showMSMErrorAlert(false);
		}
		
	},
	
	showMSMErrorAlert: function(showFormatError) {
		var payload = {};
		if(showFormatError)
			payload.formatError = true;
		else
			payload.fsckError = true;
		var windowHeight =  (enyo.g11n.currentLocale().locale == "en_us") ? 165 : 195;
		var wCard = enyo.windows.fetchWindow("StorageErrorAlert");
		if(!wCard)
			enyo.windows.openPopup("app/StoragedAlerts/storagedalerts.html", "StorageErrorAlert", payload, undefined, windowHeight);
	},
	
	/*
	 * Check to see if USB is connected. If so, put a dashboard usb icon.
	 */
	isUSBCableConnected: function() {
		this.$.hostIsConnected.call();
	},
	
	handleHostIsConnected: function(inSender, inResponse) {
		if(inResponse.result == true && inResponse.hostIsConnected) {
			// Already announced by an MSMAvail signal; see storageHandleNotifications.
			if (this.isUSBConnected)
				return;
			this.isUSBConnected = true;
			if (!enyo.application.getTelephonyService().getOnActiveCall()) {
						if (enyo.application.getSysUpdateService().getUpdateAvailable()) 
							this.createUSBDashboard();
						else 
							this.offerStorageMode();
			}			
		}
	},
	
	/*
	 * Check the conditions and make sure USB Alert can be displayed
	 */
	canUSBAlertDisplayed: function() {
		if (enyo.application.getTelephonyService().getOnActiveCall())
			return false;
		if (enyo.application.getSysUpdateService().getUpdateAvailable()) 
			return false;
		else if(enyo.windows.fetchWindow("PowerOffAlert"))
			return false;
		else if(enyo.windows.fetchWindow("ResetAlert"))
			return false;
		else
			return true;
	},
	
	/* 
	 * Close the USB Dashboard and Storage Alert
	 */
	closeUSBAlerts: function() {
		var wCard = enyo.windows.fetchWindow("StorageModeAlert");
		if(wCard)
			wCard.close();
		
		wCard = enyo.windows.fetchWindow("USBDashboard")
		if(wCard)
			wCard.close();
	},
	
});