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
 * Alert popup heights are written as css px and stay css px.
 *
 * enyo.windows.openPopup() forwards its height to window.open() as the
 * "height=" feature. WAM used to hand that number straight to
 * WebAppBase::Resize(), unscaled, so a page zoomed by WAM_LEGACY_UI_ZOOM_FACTOR
 * (1.6 on the Q25, 2.4 on sargo) got a window 1/zoom of the height its
 * content needs. openPopup() was wrapped here to multiply the height by the
 * zoom first. WAM now zooms the height with the page (WebPageBlink::
 * CreateWindow), which fixes every legacy application's alerts and not just
 * ours, so the wrapper is gone: kept, it would scale the height twice.
 */
UiScale = {};

/*
 * Whether this is a tablet, as legacy webOS decided it: by the screen in css
 * px, which PalmSystem.deviceInfo gives (WAM divides the panel by the page
 * zoom). The shortest side tells them apart - 320 to 480 on phones (450 on a
 * Q25 or a Pixel 3a), 768 on a TouchPad, 640 on a Galaxy Tab 4 - and does not
 * change with rotation. Phones show the alerts' buttons as 2.2.4 did,
 * tablets as 3.0.5 did. Read from the root window's PalmSystem, which
 * every popup can reach; anything unreadable counts as a phone.
 */
UiScale.tablet = function() {
	var info = null;

	try {
		var root = enyo.windows.getRootWindow() || window;
		info = JSON.parse(root.PalmSystem.deviceInfo);
	} catch (e) {
		return false;
	}

	if (!info || !(info.screenWidth > 0) || !(info.screenHeight > 0)) {
		return false;
	}

	return Math.min(info.screenWidth, info.screenHeight) >= 600;
};
