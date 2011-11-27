/***
|''Name:''|abego.IncludePlugin|
|''Version:''|1.0.1 (2007-04-30)|
|''Type:''|plugin|
|''Source:''|http://tiddlywiki.abego-software.de/#IncludePlugin|
|''Author:''|Udo Borkowski (ub [at] abego-software [dot] de)|
|''Documentation:''|[[IncludePlugin Documentation|http://tiddlywiki.abego-software.de/#%5B%5BIncludePlugin%20Documentation%5D%5D]]|
|''Community:''|([[del.icio.us|http://del.icio.us/post?url=http://tiddlywiki.abego-software.de/index.html%23IncludePlugin]]) ([[Support|http://groups.google.com/group/TiddlyWiki]])|
|''Copyright:''|&copy; 2007 [[abego Software|http://www.abego-software.de]]|
|''Licence:''|[[BSD open source license (abego Software)|http://www.abego-software.de/legal/apl-v10.html]]|
|''~CoreVersion:''|2.1.3|
|''Browser:''|Firefox 1.5.0.9 or better; Internet Explorer 6.0|
***/
//{{{

// Ensure the global abego namespace is set up.
if (!window.abego) window.abego = {};

var invokeLater = function(func, delay, priority) {
	return abego.invokeLater ? abego.invokeLater(func, delay, priority) : setTimeout(func,delay);
};

// Asynchronously load the given (local or remote) file.
// 
// @param url 		either an URL or a local file path to a file
//					Examples:
//						* http://www.abego-software.de/index.html
//						* file:///C:/abegoWebSite-Copy/index.html
//						* C:\abegoWebSite-Copy\index.html    (for Windows machines)
//							(Notice: backslashes in JavaScript string constants must be escaped, 
//							 i.e. the last example must be written as: "C:\\abegoWebSite-Copy\\index.html"
//							 when "hardcoded" in JavaScript source code)
// 
// @param callback 
//					function(content,url,params,errorMessage) 
//					called at the end of the operation. 
//					On success content holds the content of the loaded file. 
//					On error content is undefined and errorMessage holds an error message. 
//					params is the params passed into abego.loadFile.
//
// @param params 	passed through to the callback function
// 
abego.loadFile = function(url,callback,params) {

	var onLoad = function(status,params,responseText,url,xhr) {
		return status 
				? callback(responseText, url, params)
				: callback(undefined, url, params, "Error loading %0".format([url]));
	};
	
	// Make sure the URL is a real URL, with protocol prefix etc.
	if (url.search(/^((http(s)?)|(file)):/) != 0) {
		
		// no protocol specified. 
		if (url.search(/^((.\:\\)|(\\\\)|(\/))/) == 0) {
			// "url" is an "absolute" path to a local file. Prefix it with file://
			url = "file://"+url;
			
		} else {
			// "url" is a "relative" URL. Make it absolute
			
			// prefix the url with the directory containing the current document
			// (This also includes the protocol prefix)
			var documentPath = document.location.toString();
			var i = documentPath.lastIndexOf("/");
			url = documentPath.substr(0,i+1)+url;
		}
		// replace every \ by a /, to cover Windows style pathes
		url = url.replace(/\\/mg,"/");
	}
	
	loadRemoteFile(url,onLoad,params);

};

// Asynchronously load the given (local or remote) TiddlyWiki store.
// 
// @param url 		either an URL or a local file path to a TiddlyWiki file (absolute or relative)
//					Examples:
//						* http://www.abego-software.de/index.html
//						* file:///C:/abegoWebSite-Copy/index.html
//						* include/beta.html
//						* C:\abegoWebSite-Copy\index.html    (for Windows machines)
//							(Notice: backslashes in JavaScript string constants must be escaped, 
//							 i.e. the last example must be written as: "C:\\abegoWebSite-Copy\\index.html"
//							 when "hardcoded" in JavaScript source code)
// 
// @param callbackWithStore 
//					function(theStore,url,params,errorMessage) 
//					called at the end of the operation. 
//					On success theStore holds the loaded store (a TiddlyWiki object). 
//					On error theStore is undefined and errorMessage holds an error message. 
//					params is the params passed into abego.loadTiddlyWikiStore
//
// @param params 	passed through to the callbackWithStore
//
// @progress		[optional] function(message, sender, state, url, params) called in various situations during the operation,
//								typically used to show "the progress" of the operation.
//								sender: the constant "abego.loadTiddlyWikiStore"
//								state: one of these: "Started", "Processing", "Done", "Failed"
//									"Processing" means the data has been received and in now processed.
// 
abego.loadTiddlyWikiStore = function(url,callbackWithStore,params,progress) {
	
	var sendProgress = function(message, state) {
		if (progress)
			progress(message,"abego.loadTiddlyWikiStore",state,url,params);
	};
	
	// Load contents of a TiddlyWiki from a string
	//# Returns null on success, an error message otherwise.
	//# based on code from TiddlyWiki 2.2 alpha
	var importTiddlyWiki = function(store,text)
	{
		// Crack out the content - will be refactored to share code with saveChanges()
		var posOpeningDiv = text.indexOf(startSaveArea);
		var limitClosingDiv = text.indexOf("<!--POST-BODY-END--"+">");
		var posClosingDiv = text.lastIndexOf(endSaveArea,limitClosingDiv == -1 ? text.length : limitClosingDiv);
		if((posOpeningDiv == -1) || (posClosingDiv == -1))
			return config.messages.invalidFileError.format([url]);
		var content = "<html><body>" + text.substring(posOpeningDiv,posClosingDiv + endSaveArea.length) + "</body></html>";
		// Create the iframe
		var iframe = document.createElement("iframe");
		iframe.style.display = "none";
		document.body.appendChild(iframe);
		var doc = iframe.document;
		if(iframe.contentDocument)
			doc = iframe.contentDocument; // For NS6
		else if(iframe.contentWindow)
			doc = iframe.contentWindow.document; // For IE5.5 and IE6
		// Put the content in the iframe
		doc.open();
		doc.writeln(content);
		doc.close();
		// Load the content into a TiddlyWiki() object
		var storeArea = doc.getElementById("storeArea");
		store.loadFromDiv(storeArea,"store");
		// Get rid of the iframe
		iframe.parentNode.removeChild(iframe);
		return null;
	};
	
	var sendError = function(message) {
		sendProgress("Error when loading %0".format([url]),"Failed");
		callbackWithStore(undefined, url,params, message);
		return message;
	};
	
	var sendStore = function(store) {
		sendProgress("Loaded %0".format([url]),"Done");
		callbackWithStore(store, url, params);
		return null;
	};
	
	
	var callback = function(content,theURL,params,errorMessage) {
		if (content === undefined) {
			sendError(errorMessage);
			return;
		}
		
		sendProgress("Processing %0".format([url]),"Processing");
		var orig_invalidFileError = config.messages.invalidFileError;
		config.messages.invalidFileError = "The file '%0' does not appear to be a valid TiddlyWiki file";
		try {
			// Load the content into a TiddlyWiki() object
			var importStore = new TiddlyWiki();
			var errorText = importTiddlyWiki(importStore,content);
			if (errorText)
				sendError(errorText);
			else
				sendStore(importStore);

		} catch (ex) {
			sendError(exceptionText(ex));
		} finally {
			config.messages.invalidFileError = orig_invalidFileError;
		}
	};
	
	sendProgress("Start loading %0".format([url]),"Started");
	abego.loadFile(url,callback,params);
};


//==============================================================================
// Include Plugin 

(function(){

// only install once
if (abego.TiddlyWikiIncluder) return;


// --------------------------------------------------
// Constants

var WAITING = "waiting";
var LOADING = "loading";

var ANI_DURATION_HIDE_STATE = 1000;

var REFRESH_PRIORITY = -200;
var ANIMATION_PRIORITY = -100;
var UPDATE_STATE_PRIORITY = -300;

// --------------------------------------------------
// Variables

var useInclude;
var includes = []; // [] of Strings. the urls of the stores to include, in the sequence of the calls.
var includedStores = {}; // url(String) -> TiddlyWiki or String; when not (yet) loaded a status or error string.
var pendingOnLoadURLs = []; // [] of String. a list of urls that should be passed with the next "notifyListeners".
var refreshTiddlyWikiTimerID; // for delayed refresh
var listeners = [];
var progress;

// --------------------------------------------------
// Helper functions

var isIncludeEnabled = function() {
	if (useInclude === undefined)
		useInclude = config.options.chkUseInclude === undefined || config.options.chkUseInclude;
	return useInclude;
};

var getMissingIncludeMsg = function(url) {
	return "No include specified for %0".format([url])
};

// Called after one or more included TiddlyWikis are loaded
//
var notifyListeners = function() {
	var urls = pendingOnLoadURLs;
	pendingOnLoadURLs = [];
	if (urls.length) {
		for (var i= 0; i < listeners.length; i++)
			listeners[i](urls);
	}
};

var idleCount; // Reset to 0 when the system is "not idle", incremented inside refreshTiddlyWiki

var refreshTiddlyWiki = function() {
	// To avoid to much refreshing/flickering don't refresh immediately 
	// but wait until the system was idle for a certain time.
	
	if (refreshTiddlyWikiTimerID !== undefined) clearInterval(refreshTiddlyWikiTimerID);
	
	idleCount = 0;
	
	var sendDone = function() {
		abego.TiddlyWikiIncluder.sendProgress("","","Done");
	};
	
	refreshTiddlyWikiTimerID = setInterval(function() {
		idleCount++;
		if (idleCount <= 10)
			return;
			
		clearInterval(refreshTiddlyWikiTimerID);
		refreshTiddlyWikiTimerID = undefined;
			
		abego.TiddlyWikiIncluder.sendProgress("Refreshing...","","");
		refreshDisplay();
		invokeLater(sendDone,0,REFRESH_PRIORITY);
	},1);
};

// Calls callback for every loaded store and returns the first non-false/null.. value returned by callback.
//
// @param callback  function(store, url)
//
var forEachLoadedStore = function(callback) {
	var result;
	for (var i = 0; i < includes.length; i++) {
		var theStore = abego.TiddlyWikiIncluder.getStore(includes[i]);
		if (theStore && (result = callback(theStore, includes[i])))
			return result;
	}
};

var attachToStore = function() {
	if (!window.store)
		return invokeLater(attachToStore,100);
		
	var orig_fetchTiddler = store.fetchTiddler;
	
	store.fetchTiddler = function(title) {
		var t = orig_fetchTiddler.apply(this,arguments);
		if (t) return t;
		
		// When there is a shadowtiddler with that name done look for
		// any included tiddler since these would hide the shadow
		if (config.shadowTiddlers[title] !== undefined) return undefined;
		
		// Don't look for the "New Tiddler" tiddler in the included TiddlyWikis,
		// since returning such a tiddler (that is readonly) will make it impossible
		// in the Main TiddlyWiki to create new tiddlers.
		if (title == config.macros.newTiddler.title) return undefined;

		return forEachLoadedStore(
				function(theStore, url) {
					var t = theStore.fetchTiddler(title);
					if (t) 
						t.includeURL = url;
					return t;
				});
	};

	// We also refresh TiddlyWiki to reflect the new included Tiddlers (if we have any).
	if (includes.length)
		refreshTiddlyWiki();
};

var includeFromIncludeList = function() {
	if (!window.store)
		return invokeLater(includeFromIncludeList,100);
		
	var includeListText = store.getTiddlerText("IncludeList");
	if (includeListText) 
		wikify(includeListText,document.createElement("div"));
};

var getFunctionUsingForReallyEachTiddler = function(func) {
	var wrapper = function() {
		var orig_forEachTiddler = store.forEachTiddler;

		var forEachTiddlerWithIncludes = function(callback) {
			var done = {};
			var includeURL;

			var callbackWrapper = function(title, tiddler) {
				// ensure every title is only processed once
				if (done[title]) 
					return;
				done[title] = 1;
				
				// for "included tiddlers" set the includeURL;
				if (includeURL)
					tiddler.includeURL = includeURL;
				
				callback.apply(this,arguments);
			};
			
			// forEachTiddler over the original tiddlers
			orig_forEachTiddler.call(store, callbackWrapper);
			
			// add all shadowTiddler titles to done 
			// (to avoid an included store hides a shadow tiddler)
			for (var n in config.shadowTiddlers)
				done[n] = 1;

			// add all the "New Tiddler" tiddlerto done 
			// (to avoid an included store (with "New Tiddler") makes it impossible to create new tiddlers)
			done[config.macros.newTiddler.title] = 1;

			// forEachTiddler over every included store
			forEachLoadedStore(
					function(theStore, url) {
						includeURL = url;
						theStore.forEachTiddler(callbackWrapper);
					});
		};
		
		store.forEachTiddler = forEachTiddlerWithIncludes;
		try {
			return func.apply(this,arguments);
		} finally {
			store.forEachTiddler = orig_forEachTiddler;
		}
	};
	
	return wrapper;
};

var useForReallyEachTiddler = function(object,property) {
	return object[property] = getFunctionUsingForReallyEachTiddler(object[property]);
};


//================================================================================
// abego.TiddlyWikiIncluder

abego.TiddlyWikiIncluder = {};

abego.TiddlyWikiIncluder.setProgressFunction = function(func) {
	progress = func;
};

abego.TiddlyWikiIncluder.getProgressFunction = function(func) {
	return progress;
};

abego.TiddlyWikiIncluder.sendProgress = function(message, sender, state) {
	if (progress)
		progress.apply(this,arguments);
};


// Called when an included TiddlyWiki could not be loaded.
//
// By default an error message is displayed.
//
abego.TiddlyWikiIncluder.onError = function(url, errorMessage) {
	displayMessage("Error when including '%0':\n%1".format([url, errorMessage]));
};


// Returns true when there are "pending" includes, i.e. TiddlyWiki that are not yet loaded.
//
// A TiddlyWiki that failed loading is not pending.
//
abego.TiddlyWikiIncluder.hasPendingIncludes = function() {
	for (var i = 0; i < includes.length; i++) {
		var state = abego.TiddlyWikiIncluder.getState(includes[i]);
		if (state == WAITING || state == LOADING)
			return true;
	}
	return false;
};


// @return [] of Strings, the URLs of the includes
//
abego.TiddlyWikiIncluder.getIncludes = function() {
	return includes.slice();
};


// @return [may be null] a state/error text of the store with the given URL, or null when the store is already loaded
//
abego.TiddlyWikiIncluder.getState = function(url) {
	var s = includedStores[url];
	if (!s)
		return getMissingIncludeMsg(url);
	return typeof s == "string" ? s : null;
};


// @return [may be null] the (TiddlyWiki) store  with the given URL, null if not (yet) loaded.
//
abego.TiddlyWikiIncluder.getStore = function(url) {
	var s = includedStores[url];
	if (!s)
		return getMissingIncludeMsg(url);
	return s instanceof TiddlyWiki ? s : null;
};


// Includes the (local or remote) TiddlyWiki store with the given url.
// 
// stores with urls already already included are ignored.
//
// @param url	see url@abego.loadTiddlyWikiStore
// @param delayMilliSeconds [optional] if defined loading starts delayMilliSeconds later, otherwise "immediately"
//
abego.TiddlyWikiIncluder.include = function(url, delayMilliSeconds) {
	if (!isIncludeEnabled() || includedStores[url])
		return;
	var self = this;
	
	includes.push(url);
	includedStores[url] = WAITING;

	var loadStoreCallback = function(theStore,urlInCallback,params,errorMessage) {
		if (theStore === undefined) {
			includedStores[url] = errorMessage;
			self.onError(url, errorMessage);
			return;
		}
		includedStores[url] = theStore;
		pendingOnLoadURLs.push(url);
		invokeLater(notifyListeners);
	};
	
	var loadStore = function() {
		includedStores[url] = LOADING;
		abego.loadTiddlyWikiStore(url,loadStoreCallback,null,progress);
	};
	
	if (delayMilliSeconds)
		invokeLater(loadStore, delayMilliSeconds);
	else
		loadStore();
};


// iterates over all tiddlers of "the store" and all tiddlers of included (and loaded) stores
//
abego.TiddlyWikiIncluder.forReallyEachTiddler = function(callback) {
	var caller = function() {
		store.forEachTiddler(callback);
	};
	
	getFunctionUsingForReallyEachTiddler(caller).call(store);
};


// function abego.TiddlyWikiIncluder.getFunctionUsingForReallyEachTiddler(func)
//
// Returns a function that behaves as func, but every call to store.forEachTiddler will actually 
// be a call to forReallyEachTiddler, i.e. iterate over the tiddlers the main store and of the 
// included TiddlyWikis
//
// @return the patched function
//
abego.TiddlyWikiIncluder.getFunctionUsingForReallyEachTiddler = getFunctionUsingForReallyEachTiddler;


// function abego.TiddlyWikiIncluder.useForReallyEachTiddler(object,property)
//
// Patches the function hold in the given property of the object in such a way that every call
// to store.forEachTiddler will actually be a call to forReallyEachTiddler, i.e. iterate over the
// tiddlers the main staire and of the included TiddlyWikis
//
// @param object
// @param property the name of the property of the object containing the function to be patched.
// @return the patched function
//
abego.TiddlyWikiIncluder.useForReallyEachTiddler = useForReallyEachTiddler;


// Add a listener function to the TiddlyWikiIncluder.
//
// @param listener function(urls)
//							url: [] of Strings, containing the urls of the TiddlyWiki just included
//									(see url@abego.TiddlyWikiIncluder.include)
//						called whenever one or more TiddlyWiki store are successfully included.
//
abego.TiddlyWikiIncluder.addListener = function(listener) {
	listeners.push(listener);
};

// -------------------------------------------------------------------------------
// TiddlyWikiIncluder initialization code

abego.TiddlyWikiIncluder.addListener(refreshTiddlyWiki);

//----------------------------------------------------------------------------
// Options Support

if (config.options.chkUseInclude === undefined) config.options.chkUseInclude = true;

config.shadowTiddlers.AdvancedOptions += "\n<<option chkUseInclude>> Include ~TiddlyWikis (IncludeList | IncludeState | [[help|http://tiddlywiki.abego-software.de/#%5B%5BIncludePlugin%20Documentation%5D%5D]])\n^^(Reload this ~TiddlyWiki to make changes become effective)^^";
config.shadowTiddlers.IncludeState = "<<includeState>>";

//================================================================================
// Default Progress Handling for abego.TiddlyWikiIncluder

var showAnimated = function(e, showing, duration) {
	if (!anim || !abego.ShowAnimation) {
		e.style.display = showing ? "block" : "none";
		return;
	}
	
	anim.startAnimating(new abego.ShowAnimation(e,showing,duration));
};

abego.TiddlyWikiIncluder.getDefaultProgressFunction = function() {

	setStylesheet(
		".includeProgressState{\n"+
		"background-color:#FFCC00;\n"+
		"position:absolute;\n"+
		"right:0.2em;\n"+
		"top:0.2em;\n"+
		"width:7em;\n"+
		"padding-left:0.2em;\n"+
		"padding-right:0.2em\n"+
		"}\n",
		"abegoInclude");

	var createStateElem = function() {
		var e = document.createElement("div");
		e.className = "includeProgressState";
		e.style.display = "none";
		document.body.appendChild(e);
		return e;
	};
	
	var stateElem = createStateElem();


	var showState = function(message) {
		removeChildren(stateElem);
		createTiddlyText(stateElem,message);
		showAnimated(stateElem,true,0);
	};

	var hideState = function() {
		// hide the state the next idle time 
		invokeLater(function() {
			showAnimated(stateElem,false,ANI_DURATION_HIDE_STATE);
		},100,ANIMATION_PRIORITY);
	};
	
	var myProgressFunction = function(message, sender, state, url, params) {
		
		if (state == "Done" || state == "Failed") {
			hideState();
			return;
		}
		
		if (sender == "abego.loadTiddlyWikiStore") {
			idleCount = 0;
			if (state == "Processing")
				showState("Including...");
		} else {
			showState(message);
		}
	};
	return myProgressFunction;
};

abego.TiddlyWikiIncluder.setProgressFunction(abego.TiddlyWikiIncluder.getDefaultProgressFunction());


//================================================================================
// The "include" macro
//
// Syntax: <<include {url}* [delay: {milliSeconds}] [hide: true] >>
//

config.macros.include = {};
config.macros.include.handler = function(place,macroName,params,wikifier,paramString,tiddler) {
    params = paramString.parseParams("url",null,true,false,true); // allowEval, cascadeDefaults, names allowed
	var delay = parseInt(getParam(params,"delay","0"));
	var urls = params[0]["url"];
	var hide = getFlag(params, "hide", false);
	if (!hide)
		createTiddlyText(createTiddlyElement(place,"code"),wikifier.source.substring(wikifier.matchStart, wikifier.nextMatch));
	for (var i = 0; urls && i < urls.length; i++)
		abego.TiddlyWikiIncluder.include(urls[i],delay);
};


//================================================================================
// The "includeState" macro
//
// Syntax: <<includeState>>

config.macros.includeState = {};
config.macros.includeState.handler = function(place,macroName,params,wikifier,paramString,tiddler) {
	var getFullState = function () {
		var s = "";
		var includes = abego.TiddlyWikiIncluder.getIncludes();
		if (!includes.length)
			return "{{noIncludes{\nNo includes or 'include' is disabled (see AdvancedOptions)\n}}}\n";
			
		s += "|!Address|!State|\n";
		for (var i = 0; i < includes.length; i++) {
			var inc = includes[i];
			s += "|{{{"+inc+"}}}|";
			var t = abego.TiddlyWikiIncluder.getState(inc);
			s += t ? "{{{"+t+"}}}" : "included";
			s += "|\n"
		}
		s += "|includeState|k\n";
		return s;
	};
	
	var updateState = function(){
		removeChildren(div);
		wikify(getFullState(),div);
		if (abego.TiddlyWikiIncluder.hasPendingIncludes())
			invokeLater(updateState,500,UPDATE_STATE_PRIORITY);
	};

	var div = createTiddlyElement(place,"div");
	
	invokeLater(updateState,0,UPDATE_STATE_PRIORITY);
};

//================================================================================
// Tiddler extension/modification

var orig_Tiddler_isReadOnly = Tiddler.prototype.isReadOnly;

// Includes tiddlers are readonly.
Tiddler.prototype.isReadOnly = function() {
	return orig_Tiddler_isReadOnly.apply(this,arguments) || this.isIncluded();
}

Tiddler.prototype.isIncluded = function() {
	return this.includeURL != undefined;
};

Tiddler.prototype.getIncludeURL = function() {
	return this.includeURL;
};


//================================================================================
// TiddlyWiki modifications

// In some TiddlyWiki functions the "forEachTiddler" should work on all tiddlers, also those from 
// included store. (E.g. TiddlyWiki.prototype.getTags)
//
// But not for all (e.g. TiddlyWiki.prototype.getTiddlers is used for saving, but only the "own" tiddlers should be saved)
//
// Therefore explicitly list the functions that should be "wrapped" to use the "forReallyEachTiddler".
//
var tiddlyWikiFunctionsUsingForReallyEachTiddler = {
	getMissingLinks: 1, getOrphans: 1,getTags:1, reverseLookup: 1, updateTiddlers: 1};
	
for (var n in tiddlyWikiFunctionsUsingForReallyEachTiddler)
	useForReallyEachTiddler(TiddlyWiki.prototype,n);


//================================================================================
// Make IntelliTagger "Include-aware"

var patchIntelliTagger = function() {
	if (abego.IntelliTagger)
		useForReallyEachTiddler(abego.IntelliTagger,"assistTagging");
};

//================================================================================
// Make ForEachTiddler "Include-aware"

var patchForEachTiddler = function() {
	if (config.macros.forEachTiddler)
		// Note: this will not patch the TiddlyWiki passed to findTiddlers but the "global" store
		// This is by intent
		useForReallyEachTiddler(config.macros.forEachTiddler,"findTiddlers");
};

//================================================================================
// Perform plugin startup tasks

attachToStore();
invokeLater(includeFromIncludeList,100);
invokeLater(patchIntelliTagger,100);
invokeLater(patchForEachTiddler,100);

})();

//}}}
