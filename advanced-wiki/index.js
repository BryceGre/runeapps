"use strict";

var loading = false;
var menuelem = null;
var currentpage = null;
var listtimeout = null;

var imageorigin = "https://runescape.wiki/w/";
var allowedorigins = ["https://runescape.wiki", "https://wikimedia.org"];
var wikihome = "RuneScape_Wiki";

var elhasclass = (node, name) => (node && node.classList && node.classList.contains(name))

function load() {
	a1lib.identifyUrl("appconfig.json");
	history.scrollRestoration = 'manual';
	
	// clone a templace of the wiki content
	WikiPage.template = elid("contentouter").cloneNode(true);
	
	// load previous wiki pages, or just load one wikihome
	var current = window.localStorage.getItem("current") || 0;
	var windows = (JSON.parse(window.localStorage.getItem("windows")) || [{name: current}]);
	for (let page of windows) { addWindow(page, true); }
	WikiPage.opened[(current < 0) ? 0 : current].activate(true);
	
	// add alt+1 pressed handler
	if (typeof alt1 !== 'undefined') {
    	alt1.events.alt1pressed.push(evt => {
    	    if (!evt || !evt.text) { return; } //no text
    	    var t = evt.text.split(" ");
    	    if (t.shift() == "Examine") { openWindow(t.join("_")); }
    	});
	}
	
	// add event listeners
	addevents();
}

function openWiki(name) {
    // open a wiki by a name, determined in this order:
    // 1. If a name is explicitly provided, use it
    // 2. If there is a current page, use its name
    // 3. If there is a last-loaded page name, us it
    // 4. Else, use the wiki homepage
    name = name || (currentpage && currentpage.name) || wikiname || wikihome;
	window.open("https://runescape.wiki/w/" + encodeURIComponent(name));
}

function openWindow(name, ignorestore) {
    if (loading) { return; } // can't activate if loading
    
    // add and activate new window
    var newpage = addWindow(name, ignorestore);
    newpage.activate();
    
    // return newpage
    return newpage;
}

function addWindow(name, ignorestore) {
    // create the window
    var newpage = new WikiPage(name);
    
    // update lists
    WikiPage.opened.push(newpage); refreshlists();
    if (ignorestore !== true) { updatestorage(); }
    elid('sidebutton').classList.add("glow");
    
    // return newpage
    return newpage;
}

function closeAllWindows() {
    if (loading) return;
    while(WikiPage.opened.length) { WikiPage.opened.pop().movetorecent(); }
    openWindow(wikihome);
}

function goBack() {
    if (loading || !currentpage) { return; }
    if (elisopen(elid("sidebar"))) { return; }
    
    // close the context menu
    elclose(elid("contextmenu"));
    
    // go back
    currentpage.goback();
}

function goForward() {
    if (loading || !currentpage) { return; }
    if (elisopen(elid("sidebar"))) { return; }
    
    // hide the context menu
    elclose(elid("contextmenu"));
    
    // go forward
    currentpage.gofrwd();
}

function refreshlists() {
    var refreshlist = (listelem, listdata) => {
        // clear old elements
        listelem.innerHTML = "";
        // add back elements
        var sub = false;
        for (let page of listdata) {
            listelem.appendChild(page.window);
            if (sub = !sub) { page.window.classList.add("sub"); }
            else { page.window.classList.remove("sub"); }
        };
    };
    
    // stagger the 'sub' css class on each list
    refreshlist(elid("windowslist"), WikiPage.opened);
    refreshlist(elid("recentlist"), WikiPage.closed);
    
    // update the count of open windows
    elid("sidebutton").innerText = WikiPage.opened.length;
}

function updatestorage() {
    // save the data to localStorage
    window.localStorage.setItem("windows", JSON.stringify(WikiPage.opened));
    window.localStorage.setItem("current", WikiPage.opened.indexOf(currentpage));
}

function addevents() {
    var root = document.documentElement;
    var contextmenu = elid("contextmenu");
    var nameinput = elid("nameinput");
    var opensearch = elid("opensearch");
    var itemname = elid("itemname");
    var sidebar = elid("sidebar");
    var recentlist = elid("recentlist");
    
    /*********************/
    /*** Global events ***/
    /*********************/
    
    // purpose: close any open items, prevent actions while loading
    document.addEventListener("click", evt => {
        var path = (evt.composedPath) ? evt.composedPath() : evt.path;
        
        var closeifopen = (element) => {
            if (elisopen(element)) {
                // if we didn't click the element, close it
                if (!path.some(item => (item == element))) { elclose(element); }
            }
        };
        
        // close any menus that were open that were not hit
        closeifopen(contextmenu);
        closeifopen(opensearch);
        closeifopen(sidebar);
        // special cases for the recently closed list:
        // don't close if we're trying to open it or if we're moving a window to it
        if (evt.target.id != "recently" && !elhasclass(evt.target, "windowclose")) {
            closeifopen(recentlist);
        }
    }, true);
    
    
    // purpose: show a custom right-click menu
    document.addEventListener("contextmenu", evt => {
        // check if there's a modifier key pressed (Shift or Ctrl)
        if (evt.getModifierState("Shift") || evt.getModifierState("Control")) {
            elclose(contextmenu); // close the context menu if it is open
            return; // stop here (and show the system context menu as normal)
        }
        // don't show system context menu from this point forth
        evt.preventDefault();
        
        // check the type of element that was right-clicked
        var path = (evt.composedPath) ? evt.composedPath() : evt.path;
        if (menuelem = path.find(item => elhasclass(item, "wikilink"))) {
            // context menu for a wikilink
            elid("linkmenu").style.display = "block";
            elid("pagemenu").style.display = "none";
        } else if (path.some(item => (item.id == "contentouter"))) {
            // context menu for page
            elid("backitem").style.display = currentpage.back.length ? "block" : "none";
            elid("frwditem").style.display = currentpage.frwd.length ? "block" : "none";
            elid("pagemenu").style.display = "block";
            elid("linkmenu").style.display = "none";
        } else {
            // no context menu outside of content
            elclose(contextmenu);
            return;
        }
        
        // hide the sidebar if it's open
        elclose(sidebar);
        // show and move the context menu
        elopen(contextmenu);
        
        var clientRight = evt.clientX + contextmenu.offsetWidth;
        var offsetX = (clientRight > root.clientWidth) ? contextmenu.offsetWidth : 0;
        contextmenu.style.left = (evt.pageX - offsetX) + "px";
        
        var clientBottom = evt.clientY + contextmenu.offsetHeight;
        var offsetY = (clientBottom > root.clientHeight) ? contextmenu.offsetHeight : 0;
        contextmenu.style.top = (evt.pageY - offsetY) + "px";
    });
    
    
    // mouse button event listener
    window.addEventListener("mouseup", evt => {
        if (evt.button == 3) { goBack(); evt.preventDefault(); }
        else if (evt.button == 4) { goForward(); evt.preventDefault(); }
    });
    
    /*********************/
    /*** Local  events ***/
    /*********************/
    
    /*** name input listeners ***/
    
    // purpose: capitialize, load suggestion list
    nameinput.addEventListener("input", evt => {
        // ignore input that is not from an event (e.g. keypress, copy, etc.)
        if (!evt.inputType || evt.target.value.length === 0) { return; }
        // capitalize the value each time input changes
        if(startcaps(evt.target.value) != evt.target.value) { evt.target.value = startcaps(evt.target.value); }
        
        // load the suggestions list if the user hasn't typed anything for 250ms
        window.clearTimeout(listtimeout);
        listtimeout = window.setTimeout(loadlist.b(evt.target.value), 250);
    });
    
    
    // purpose: load page, select from suggestions
    nameinput.addEventListener("keydown", evt => {
        if (evt.key == "Enter") {
            // the enter key will load the page (duh)
            if (evt.target.value.length > 0) {
                loadpage(evt.target.value);
                evt.target.blur();
                evt.preventDefault();
            }
        } else if (evt.key == "ArrowDown" || evt.key == "ArrowUp") {
            // handle arrow down/up keys if the suggestion box is open
            if (elisopen(opensearch) && opensearch.childElementCount > 0) {
                // get the active element (either due to mouse hover or prior key events)
                var active = opensearch.querySelector("option.hover,option:hover:not(.nohover)");
                var target;
                
                if (active) {
                    // active element, determine next target
                    target = (evt.key == "ArrowDown") ? active.nextElementSibling : active.previousElementSibling;
                    // make active element inactive
                    active.classList.add("nohover");
                    active.classList.remove("hover");
                }
                // use first/last target if there's no active element or target is last/first, 
                target = target || ((evt.key == "ArrowDown") ? opensearch.firstElementChild : opensearch.lastElementChild);
                
                //make target element active
                target.classList.add("hover");
                target.classList.remove("nohover");
                
                // give the name input box the new suggestion
                evt.target.value = target.value;
                evt.preventDefault();
            }
        }
    });
    
    nameinput.addEventListener("click", evt => {
        nameinput.style.opacity = 1.0;
        itemname.style.opacity = 0.0;
    });
    nameinput.addEventListener("blur", evt => {
        itemname.style.opacity = 1.0;
        nameinput.style.opacity = 0.0;
        nameinput.value = '';
    });
    
    /*** suggestion box listeners ***/
    
    // purpose: clear active suggestion from key events
    opensearch.addEventListener("mouseover", evt => {
        // clear any keyboard-induced hover classes
        for (let option of elqa("#opensearch > option")) { option.classList.remove("hover", "nohover"); }
    });
}