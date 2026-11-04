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
	name: 'AlbumGridViewCell',
	className: "AlbumGridThumb",
	kind: enyo.Control,
	components: [{
		kind: 'Image', 
		height: '107px',
		width:'107px'
	}
	]
});

enyo.kind({
	name: 'AlbumGridView',
	kind: enyo.VFlexBox,
	events: {
		onPictureSelected: '',
		onMultiPicturesSelected: ''
	},
	published: {
		albumId:"",
		allowMultiSelect: false,
		mediaType: "image"
	},
	selectedImagesCount: 0,
	cellCount:3,
	components: [
		{name: 'db', 
			kind: 'DbService', 
			method: 'find', 
			dbKind: 'com.palm.media.types:1', 
			subscribe: true, 
			onSuccess: 'dbQueryResponse', 
			onFailure: 'dbQueryFail', 
			onWatch: "queryWatch"
		},
		{name: 'dbMore', kind: 'DbService', method: 'find', dbKind: 'com.palm.media.types:1',
			onSuccess: 'dbQueryResponse', onFailure: 'dbQueryFail'},
		{flex:1, name:"list", className: "custom-rowgroup", kind:"VirtualList", onSetupRow: "listSetupRow", 
			components: [
			             { name: "cells", style: "display: -webkit-box; -webkit-box-align: stretch; -webkit-box-pack: justify; -webkit-box-orient: horizontal;"}
		]}                                                                            
	],
	create: function() {
		this.inherited(arguments);
		this.images = [];
		this.selectedImages = [];
	},
	rendered: function() {
		this.inherited(arguments);
		this.buildCells();
	},
	buildCells: function() {
		this.$.cells.destroyControls();
		this.cells = [];
		for (var i=0; i<this.cellCount; i++) {
			var c = this.$.cells.createComponent({kind: 'AlbumGridViewCell', owner:this, idx:i, onclick: "gridClickCell"});
			this.cells.push(c);
		}
	},
	activateView: function(listPunt) {
		this.selectedImages = [];
		if(listPunt) {
			this.images = [];
			this.dbQuery();
		}
	},
	listSetupRow: function(inSender, inIndex) {	
		var idx = inIndex * this.cellCount;
		var showCell; 
		
		if (idx >= 0 && idx < this.images.length) {
			for (var i=0, cell; cell=this.cells[i]; i++, idx++) {
				showCell = false;
				if (idx < this.images.length) {
					showCell = this._setupCell(idx, cell);
				}	
				cell.applyStyle("visibility", showCell ? "visible" : "hidden");
			}
			return true;
		}
		return false;
	},
	_setupCell: function(idx, cell) {
		var dbEntry = this.images[idx];
		if(!dbEntry) {
			return false;
		}
		var path = dbEntry.appGridThumbnail && dbEntry.appGridThumbnail.path;
		if (!path) { 
			// The thumbnail is still being made: show the picture itself
			// rather than whatever this recycled cell showed last
			path = dbEntry.mediaType == "video" ? "images/generic-thumb-video.png" : dbEntry.path;
		}
		var img = cell.$.image;
		if(path)
			img.setSrc(path);
		return true;  	
	},
	queryWatch: function() {
		this.selectedImages = [];
		this.dbQuery();
	},
	sortChanged: function() {
		this.clearSelection();
		this.images.sort(FPSort.byDate);
		this.$.list.punt();
	},
	clearSelection: function() {
		this.selectedImages = [];
		for (var i = 0, cell; cell = this.cells && this.cells[i]; i++)
			cell.removeClass("ImageSelectHighlight");
		if (this.allowMultiSelect)
			this.owner.doLabelChange({topRightLabel: FPLabels.multiSelectRightLabel, enableOKButton: false});
	},
	// db8 hands an album back oldest first and has no index to sort it by
	// date (one added later would leave out the entries already there), so
	// the album is read whole, every page of it, and sorted here.
	albumQuery: function(inPage) {
		var query = {
			where: [{prop: 'albumId', op: '=', val: this.albumId}, {prop: "appCacheComplete", op: "=", val: true}],
			select: ["_id", "albumId", "appCacheComplete", "path", "mediaType", "appGridThumbnail", "modifiedTime"]
		};
		if (inPage)
			query.page = inPage;
		return query;
	},
	dbQuery: function() {
		this.loading = [];
		this.generation = (this.generation || 0) + 1;
		var request = this.$.db.call({query: this.albumQuery()});
		request.generation = this.generation;
		return request;
	},
	dbQueryResponse: function(inSender, inResponse, inRequest) {
		// A page of an album that has since been reloaded
		if (inRequest.generation !== this.generation)
			return;
		var images = (inResponse.results || []).filter(function(dbData) {
			return dbData.mediaType != 'video';
		});
		this.loading = this.loading.concat(images);
		if (inResponse.next) {
			var request = this.$.dbMore.call({query: this.albumQuery(inResponse.next)});
			request.generation = this.generation;
			return;
		}
		this.images = this.loading.sort(FPSort.byDate);
		this.loading = [];
		this.$.list.punt();
	},
	dbQueryFail: function(inSender, inResponse) {
		enyo.log('&& dbQueryFail():   ' ,inResponse);
	},
	gridClickCell: function(inSender, inEvent) {
		var idx = (inEvent.rowIndex * this.cellCount) + inSender.idx;
		var dbEntry = this.images[idx];
		
		if(!dbEntry)
			return;
		
		if(this.allowMultiSelect) {
			var alreadySelected = inSender.hasClass("ImageSelectHighlight");
			inSender.addRemoveClass("ImageSelectHighlight", !alreadySelected);			
			if(alreadySelected) {
				this.selectedImages.splice(this.selectedImages.indexOf(dbEntry), 1);
			}
			else {
				this.selectedImages.push(dbEntry);
			}	
			if(this.selectedImages.length > 0) {
				var g11nTemp = new enyo.g11n.Template(FPLabels.multiSelectRightLabelWithCount);
				this.owner.doLabelChange({topRightLabel: g11nTemp.formatChoice(this.selectedImages.length, {num:this.selectedImages.length}), enableOKButton:true});
			}
			else 
				this.owner.doLabelChange({topRightLabel: FPLabels.multiSelectRightLabel, enableOKButton:false});
		}
		else 
			this.doPictureSelected(this.images, dbEntry);
	},
	selectButtonHandler: function() {
		this.doMultiPicturesSelected(this.selectedImages);
	},
	cleanupView: function(clearCount) {
		if(clearCount) {
			this.selectedImages = [];
			this.images = [];
			this.$.list.punt();
		}
	}
});