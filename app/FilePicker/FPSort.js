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
 * The order the picker lists files in, shared by every list and kept between
 * pickers. Newest first unless the user picked otherwise.
 *
 * Lists sort on modifiedTime, the file's own date. createdTime is when the
 * indexer found the file, which is 1970 when it ran before the clock was set.
 */
FPSort = {
	NEWEST: "newest",
	OLDEST: "oldest",
	NAME: "name",
	storageKey: "com.palm.systemui.filepicker.sort",
	mode: "newest",

	load: function() {
		try {
			var m = window.localStorage.getItem(this.storageKey);
			if (m == this.NEWEST || m == this.OLDEST || m == this.NAME)
				this.mode = m;
		} catch (e) {
			// No storage: keep the default
		}
	},
	set: function(inMode) {
		this.mode = inMode;
		try {
			window.localStorage.setItem(this.storageKey, inMode);
		} catch (e) {
			// Still applies to this picker
		}
	},
	byName: function() {
		return this.mode == this.NAME;
	},
	// A list that cannot sort by name treats "name" as newest first
	newestFirst: function() {
		return this.mode != this.OLDEST;
	},
	byDate: function(a, b) {
		var d = (a.modifiedTime || 0) - (b.modifiedTime || 0);
		return FPSort.newestFirst() ? -d : d;
	},
	items: function(inWithName) {
		var items = [
			{caption: rb.$L("Newest first"), value: this.NEWEST},
			{caption: rb.$L("Oldest first"), value: this.OLDEST}
		];
		if (inWithName)
			items.push({caption: rb.$L("Name"), value: this.NAME});
		return items;
	}
};
FPSort.load();
