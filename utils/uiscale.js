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
 * Alert popup heights are written as css px, but reach the system as device px.
 *
 * enyo.windows.openPopup() forwards its height to window.open() as the
 * "height=" feature. WAM hands that number straight to WebAppBase::Resize(),
 * unscaled, and the compositor sizes the alert surface from the result, so the
 * number is consumed as device pixels. Our pages, meanwhile, are laid out in
 * css px and rasterised at WAM_PAGE_ZOOM_FACTOR, which is tuned per device
 * (2.4 on sargo and tissot, 1.0 on mindphone). Passing a css height through
 * unscaled therefore yields a window 1/zoom of the height the content needs
 * and the alert is cut off. The compositor cannot repair that afterwards - it
 * never learns how tall the html content is - and Chromium additionally floors
 * a popup at 100 device px, so the height has to be right before we ask.
 *
 * openPopup() is wrapped once here rather than at each of the two dozen call
 * sites so that the popups opened by the enyo libraries we pull in
 * (networkalerts, syncui) get scaled as well.
 */

UiScale = {};

// Device pixels per css px, i.e. the page zoom WAM applied to us. Taken from
// the root window: it is the one that actually opens every popup, and it is
// full screen, so its outer/inner ratio is the zoom factor and nothing else.
UiScale.factor = function() {
	var w = window;

	try {
		var root = enyo.windows.getRootWindow();
		if (root && root.innerWidth > 0) {
			w = root;
		}
	} catch (e) {
		// Touching a root window that is going away throws; ours will do.
	}

	if (!w.innerWidth || !w.outerWidth) {
		return 1;
	}

	return w.outerWidth / w.innerWidth;
};

UiScale.toDevicePixels = function(cssPixels) {
	return Math.round(cssPixels * UiScale.factor());
};

(function() {
	var openPopup = enyo.windows.openPopup;

	// Both this file and utils.js can be pulled in by the same window; only
	// wrap once, or the height gets scaled twice.
	if (openPopup.uiScaleWrapped) {
		return;
	}

	var wrapped = function(inUrl, inName, inParams, inAttributes, inHeight, throb) {
		return openPopup.call(this, inUrl, inName, inParams, inAttributes,
			UiScale.toDevicePixels(inHeight || 200), throb);
	};
	wrapped.uiScaleWrapped = true;

	enyo.windows.openPopup = wrapped;
})();
