"use strict";

var reqlist = "";
var reqpage = "";
var wikiname = "";
var gename = "";
var gestate = "waiting";
var boxloaded = [false, false, false, false];

var wikiapi = "https://runescape.wiki/api.php?";

var dlpageasync = (url) => new Promise((resolve, reject) => dlpage(url, resolve, reject));

function splitName(name) {
    var parts = name.split(/([^\?\#]+)\??([^\#]*)?\#?(.*)?/g);
    return {
        path: parts[1],
        query: parts[2],
        anchor: parts[3]
    };
}

async function loadpage(name, hist) {
    var pageerror = () => {
    	elid("wikicontent").innerHTML = "No information found";
    	renamewiki(null);
    	if (currentpage) { currentpage.rename(null); }
    };
    if (!name || loading) { console.warn("load ignored"); return; }
    
    // close menus
    elclose(elid("opensearch"));
    elclose(elid("contextmenu"));
    
    // update history if desired
    if (currentpage && !hist) {
        currentpage.frwd.length = 0;
        currentpage.back.push(JSON.stringify(currentpage.savestate()));
        elenable(elid("backbutton"));
        history.pushState(currentpage.name, document.title, window.location);
    }
    
    var parts = splitName(name);
    if (name != currentpage.name && parts.path == splitName(currentpage.name).path) {
    	currentpage.loadstate(hist || { name: name });
        renamewiki(name);
        updatestorage();
        return;
    }
    
    var query = new URLSearchParams({
      "action": "parse",
      "page": encodeURI(parts.path.replace(/\s/g, "_")),
      "prop": "text",
      "redirects": "true",
      "format": "json",
      "origin": "*"
    });
    
    // clear the current contents
    clearwiki(name);
    wikiname = gename = name = currentpage.rename(name);
    // start loading the page
    try {
        reqpage = name; loading = true;
        var t = jsonDecode(await dlpageasync(wikiapi + query.toString()));
        //var t = jsonDecode(await dlpageasync("rswiki.php?page=" + encodeURIComponent(reqpage)));
        if (name != reqpage) { return; } //object changed while loading
    	if (!t || !t.parse || !t.parse.text) { return pageerror(); }
    	name = t.parse.title;
    	
    	// update window and show wiki
    	currentpage.rename(name);
    	renamewiki(name);
        updatestorage();
        await showwiki(t);
    	currentpage.loadstate(hist);
    } catch(err) {
        pageerror();
        console.error(err);
    } finally { loading = false; }
}

function showwiki(t) {
	wikiname = currentpage.name;
    
	if (gestate == "failed" && gename != wikiname) { gename = wikiname; loadge(gename); }//make ge retry if failed and wiki had a redirect
	boxloaded = [false, false, false, false];
	
	return parsewiki(wikiname, t.parse.text["*"], elid("wikicontent"));
}

function clearwiki(newname) {
    renamewiki(newname);
    
	elid("gecontent").style.display = "none";
	elid("wikicontent").innerHTML = "";
	settab(0);
	elid("contenttab1").style.display = "none"; elid("tabcontent1").innerHTML = "";
	elid("contenttab2").style.display = "none"; elid("tabcontent2").innerHTML = "";
	elid("contenttab3").style.display = "none"; elid("tabcontent3").innerHTML = "";
	elid("contenttab4").style.display = "none"; elid("tabcontent4").innerHTML = "";
}

function renamewiki(newname) {
    newname = newname || "Not Found";
    
    var newparts = splitName(newname);
    if (newparts.anchor) {
        newname = newparts.path + "/" + newparts.anchor;
        window.location.hash = newparts.anchor;
    }
    
    newname = htmlentities(startcaps(newname.replace(/_/g, " ")));
    nameinput.setAttribute("placeholder", newname);
    elid("itemname").innerHTML = newname;
	document.title = newname;
}

async function loadlist(search) {
    if (search.length < 2) {
         //search is too short, hide list
        elclose(elid("opensearch"));
        return;
    }
    
    var query = new URLSearchParams({
      "action": "opensearch",
      "search": encodeURI(search.replace(/\s/g, "_")),
      "limit": "10",
      "format": "json",
      "origin": "*"
    });
    
    try {
        reqlist = search;
        var t = jsonDecode(await dlpageasync(wikiapi + query.toString()));
        //var t = jsonDecode(await dlpageasync("rswiki.php?search=" + encodeURIComponent(reqlist)));
        if (search != reqlist) { return; } //search changed while loading
        if (!Array.isArray(t) || !Array.isArray(t[1])) { return; } //no results
        
        // show list
        showlist(t);
    } catch(err) {
        elclose(elid("opensearch"));
        console.error(err);
    };
}

function showlist(t) {
    var opensearch = elid("opensearch");
    opensearch.innerHTML = ""; // clear old list
    
    var sub = false;
    for (let i=0; i<t[1].length; ++i) {
        let name = t[1][i];
        let desc = t[2][i];
        let option = document.createElement("option");
        option.classList.add("menuitem");
        if (sub = !sub) { option.classList.add("sub"); }
        
        option.innerText = option.value = name;
        if (desc) { option.title = desc; }
        option.onclick = loadpage.b(name);
        opensearch.appendChild(option);
    };
    
    var nameinput = elid("nameinput");
    opensearch.style.width = (nameinput.offsetWidth-1) + "px";
    opensearch.style.left = nameinput.offsetLeft + "px";
    opensearch.style.top = nameinput.offsetTop + nameinput.offsetHeight + "px";
    elopen(opensearch);
}

function settab(tabnr) {
    // backup scroll values
	if (currentpage && currentpage.tab !== tabnr) { currentpage.savescroll(); }
	
	// change tabs
	for (let tab of elcl("contenttab")) { tab.classList.remove("activetab"); }
	elid("contenttab" + tabnr).classList.add("activetab");
	for (let tab of elcl("tabcontent")) { tab.style.display = "none"; }
	elid("tabcontent" + tabnr).style.display = "block";
	
    // restore scroll values
	if (currentpage) { currentpage.tab = tabnr; currentpage.loadscroll(); }
}

function resettabs() {
    settab(currentpage.tab);
	elid("contenttab1").style.display = (elid("tabcontent1").innerHTML == "") ? "none" : "block";
	elid("contenttab2").style.display = (elid("tabcontent2").innerHTML == "") ? "none" : "block";
	elid("contenttab3").style.display = (elid("tabcontent3").innerHTML == "") ? "none" : "block";
	elid("contenttab4").style.display = (elid("tabcontent4").innerHTML == "") ? "none" : "block";
	// also reset history
    history.go(-(history.length));
    history.replaceState(currentpage.name, document.title, window.location);
}