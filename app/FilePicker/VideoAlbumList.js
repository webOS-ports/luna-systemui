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
	name: "VideoAlbumList",
	kind: enyo.VFlexBox,
	className: "enyo-filepicker-mainview",
	published: {
		videoFile: {},
		albumId: undefined,
		allowMultiSelect: false
	},
	events: {
		onFileSelect: "",
		onLabelChange: ""
	},
	components: [
			/*{
				kind: "SearchInput",
				className: "enyo-tool-input",
				hint: rb.$L("Search"),
				name: "searchField",
				autoCapitalize:"lowercase",
				autocorrect: false,
				spellcheck: false,
				autoEmoticons: false,
				autoWordComplete: false,
				onchange: "processOnSearch",
				onCancel:"processOnCancel",
				keypressInputDelay: 500
			},*/ 
		{kind: "DbService", name: "albumService", dbKind: "com.palm.media.types:1", onSuccess: "gotAlbums", onFailure: "gotFailure", onWatch: "queryWatch", subscribe:true},
		{kind: "DbService", name: "albumMore", dbKind: "com.palm.media.types:1", onSuccess: "gotAlbums", onFailure: "gotFailure"},
		{flex:1, name: "list", kind: "VirtualList", className: "custom-rowgroup", onSetupRow: "listSetupRow", 
			components: [
				{name: "videoFileItem", kind: "VideoItem", onclick: "fileClick"}
							]
        }
	],
	create: function() {
		this.inherited(arguments);
		this.files = [];
		this.filterString = null;
		this.selectedFileCount = 0;
		this.lastSelectedItem = undefined;
		this.listRefreshRequired = false;
	},
	
	sortChanged: function() {
		this.clearSelection();
		this.files.sort(FPSort.byDate);
		this.$.list.punt();
	},
	
	clearSelection: function() {
		for (var i = 0; i < this.files.length; i++)
			this.files[i].selectedFile = false;
		this.selectedFileCount = 0;
		if (this.allowMultiSelect)
			this.owner.doLabelChange({topRightLabel: FPLabels.multiSelectRightLabel, enableOKButton: false});
	},
	
	allowMultiSelectChanged: function() {
		this.owner.doLabelChange({showOKButton:this.allowMultiSelect,topRightLabel: FPLabels.multiSelectRightLabel});
	},
	
	// db8 hands an album back oldest first and has no index to sort it by
	// date (one added later would leave out the entries already there), so
	// the album is read whole, every page of it, and sorted here.
	loadAlbum: function() {
		this.loading = [];
		this.generation = (this.generation || 0) + 1;
		var request = this.$.albumService.call({query: this.albumQuery()}, {method: this.filterString ? "search" : "find"});
		request.generation = this.generation;
	},
	
	albumQuery: function(inPage) {
		var query = {
			where: [{prop: 'albumId', op: '=', val: this.albumId}, {prop: "appCacheComplete", op: "=", val: true}],
			select: ["_id", "_kind", "albumId", "appCacheComplete", "path", "title", "duration", "captureOnDevice", "mediaType", "appGridThumbnail", "size", "modifiedTime"]
		};
		if(this.filterString)
			query.where.push({prop:"searchKey", op:"?", val:this.filterString, collate:"primary"});
		if (inPage)
			query.page = inPage;
		return query;
	},
	
	gotAlbums: function(inSender, inResponse, inRequest) {
		// A page of an album that has since been reloaded
		if (inRequest.generation !== this.generation)
			return;
		var videos = (inResponse.results || []).filter(function(dbData) {
			return dbData.mediaType == "video";
		});
		this.loading = this.loading.concat(videos);
		if (inResponse.next) {
			var request = this.$.albumMore.call({query: this.albumQuery(inResponse.next)}, {method: this.filterString ? "search" : "find"});
			request.generation = this.generation;
			return;
		}
		this.files = this.loading.sort(FPSort.byDate);
		this.loading = [];
		this.selectedFileCount = 0;
		this.$.list.punt();
	},
	
	queryWatch: function() {
		this.loadAlbum();
	},
	
	activateView: function(listPunt) {
		if(listPunt || this.listRefreshRequired) {
			this.files = [];
			this.$.list.punt();
			this.loadAlbum();
			this.listRefreshRequired = false;
		}
		else
			this.$.list.refresh();
	},
	
	listSetupRow: function(inSender, inIndex) {
		var file = this.files[inIndex];
		if (!file)
			return false;
		this.$.videoFileItem.setFile(file);
		this.$.videoFileItem.addRemoveClass("enyo-first", inIndex == 0);
		return true;
	},
	
	processOnSearch: function(inSender, inEvent, inValue) {
		this.filterString = inValue && inValue.length > 0 ? inValue : undefined;
		this.listRefreshRequired = !!this.filterString;
		this.files = [];
		this.$.list.punt();
		this.loadAlbum();
		this.selectedFileCount = 0;
	},
	
	processOnCancel: function(inSender, inEvent) {
		this.filterString = undefined;
		this.listRefreshRequired = false;
		this.files = [];
		this.$.list.punt();
		this.loadAlbum();
	},
	
	fileClick: function(inSender, inEvent) {
		
		var index = inEvent.rowIndex;
		if(this.allowMultiSelect) {
			var alreadySelected = inSender.hasClass("file-selected");
			this.files[index].selectedFile = !alreadySelected;
			alreadySelected ? --this.selectedFileCount : ++this.selectedFileCount;
			if(this.selectedFileCount > 0) {
				var g11nTemp = new enyo.g11n.Template(FPLabels.multiSelectRightLabelWithCount);
				this.owner.doLabelChange({topRightLabel: g11nTemp.formatChoice(this.selectedFileCount, {num:this.selectedFileCount}), enableOKButton:true});
			}
			else 
				this.owner.doLabelChange({topRightLabel: FPLabels.multiSelectRightLabel, enableOKButton:false});
			this.$.list.refresh();
		}
		else {
			this.files[index].selectedFile = true;
			this.selectButtonHandler();
		}
		
	},
	
	selectButtonHandler: function() {
		var selectedFiles = [];
		for(var i = 0; i< this.files.length; i++) {
			if(!this.files[i].selectedFile)
				continue;
			selectedFiles.push({fullPath:this.files[i].path, size:this.files[i].size, dbId:this.files[i]._id, attachmentType:"video", title:this.files[i].title, isTmpVideoFile : false});
		}
		this.doFileSelect(selectedFiles);
	},
	
	cleanupView: function(clearCount) {
		if(clearCount) {
			this.filterString = null;
			this.lastSelectedItem = undefined;
			this.selectedFileCount = 0;
			//this.$.searchField.setValue("");
			this.files = [];
			this.$.list.punt();
		}
	},
	
	gotFailure: function(inSender, inResponse) {
		enyo.log("FilePicker -- File Search Failed: " , inResponse);
	},
});

enyo.kind({
	name: "VideoItem",
	kind: enyo.Item,
	className: "enyo-item",
	layoutKind: "VFlexLayout",
	tapHighlight:true,
	published: {
		file: {},
	},
	create: function() {
		this.inherited(arguments);
	},
	components: [
		{layoutKind: "HFlexLayout", components:[
		                                        { name: "fileicon", className: "filepicker-file-icon", kind: "Image" },
		                                        { name: "filename", className: "enyo-text-ellipsis files-file-name"}
		]},
		{layoutKind: "HFlexLayout", components:[                                       
		                                        { name: "fileduration", className:"video-file-duration"},
		                                        {flex:1},
		                                        { name: "filesize", className:"video-file-size"}
		]}
	],
	processClick: function() {
		this.inherited(arguments);
	},
	fileChanged: function() {
		
		var tokens = this.file.path.split(/\//);
		var videoName = enyo.string.escapeHtml(tokens[tokens.length-1]);
		this.$.filename.setContent(videoName);
		
        if (this.file.duration) {
            this.$.fileduration.setContent(this.secondsToTimeString(this.file.duration));
        }
        
       	if (this.file.size) {
            this.file.fileSizeFormatted = Formatter.formatSize(this.file.size);
			this.$.filesize.setContent(this.file.fileSizeFormatted);
        }
       	
		this.$.fileicon.setSrc("images/icn-videos.png");
		this.addRemoveClass("file-selected", this.file.selectedFile);
	},
	secondsToTimeString: function (seconds) {
		var iSeconds = Math.floor(seconds);
		var sec = iSeconds%60;
		var iMinutes = Math.floor((iSeconds-sec)/60);
		var min = iMinutes%60;
		var hr = Math.floor((iMinutes-min)/60);
		
		return new enyo.g11n.DurationFmt({style: 'short'}).format({'hours': hr, 'minutes': min, 'seconds': sec});
	}
});
