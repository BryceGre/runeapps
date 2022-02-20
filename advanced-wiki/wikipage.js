"use strict";

class WikiPage {
    constructor(page) {
        if (!(typeof page == "object" && page)) { page = { name: page }; }
        
        // set values
        this.name = page.name || wikihome;
        this.back = page.back || [];
        this.frwd = page.frwd || [];
        this.scroll = [];
        this.tab = 0;
        
        // create a content element for this page
        this.content = WikiPage.template.cloneNode(true);
        
        // create a window element for this page
        this.window = document.createElement("div");
        this.window.classList.add("windowitem");
        
        // page name label
        var label = document.createElement("div");
        label.classList.add("windowname");
        label.innerText = this.name ? htmlentities(startcaps(this.name)).replace(/_/g, " ") : "Not found";
        label.onclick = this.activate.bind(this);
        this.window.prepend(label);
        
        // page close button
        var close = document.createElement("div");
        close.classList.add("windowclose", "nissmallimagebutton");
        close.onclick = this.close.bind(this);
        this.window.append(close);
        
        // append to windows list and open pages
        elid("windowslist").appendChild(this.window);
    }
    
    rename(newname) {
        newname = htmlentities(startcaps(newname || ""));
        this.window.firstChild.innerText = newname.replace(/_/g, " ") || "Not found";
        return this.name = newname.replace(/ /g, "_");
    }
    
    activate(ignorestore) {
        if (loading) return;
        
        // close any open menus
        elclose(elid("contextmenu"));
        elclose(elid("sidebar"));
        elclose(elid("recentlist"));
        
        // backup old wiki values
        if (currentpage) { currentpage.savescroll(); }
        
        // update current window element
        currentpage = this;
        
    	// swap in the wiki, and update ui elements (such as the back button)
    	elid("contentouter").replaceWith(this.content);
    	(this.back.length) ? elenable(elid("backbutton")) : eldisable(elid("backbutton"));
    	
    	// load if neccessary
        if (elid("wikicontent").childNodes.length == 0) { loadpage(this.name, this.getstate()).then(resettabs); }
        else { renamewiki(this.name); resettabs(); }
        
        // update localstorage
        if (ignorestore !== true) { updatestorage(); }
    }
    
    goback() {
        if (this.back.length > 0) {
            // add current page to forward and go back
            this.frwd.unshift(JSON.stringify(this.savestate()));
            var state = JSON.parse(this.back.pop());
            loadpage(state.name, state).then(() => { history.back(); });
        
            // update back button
            (this.back.length) ? elenable(elid("backbutton")) : eldisable(elid("backbutton"));
        }
    }
    
    gofrwd() {
        if (this.frwd.length > 0) {
            // add current page to back and go forward
            this.back.push(JSON.stringify(this.savestate()));
            var state = JSON.parse(this.frwd.shift());
            loadpage(state.name, state).then(() => { history.forward(); });
            
            // update back button
            elenable(elid("backbutton"));
        }
    }
    
    close() {
        // do extra stuff if this is the currently open wiki
        if (this == currentpage) {
            if (loading) return; // cannot close a wiki if its loading
            var index = WikiPage.opened.indexOf(this);
            
            // based on what other window elements exist, move to anther active window
            if (WikiPage.opened[index+1]) { WikiPage.opened[index+1].activate(); }
            else if (WikiPage.opened[index-1]) { WikiPage.opened[index-1].activate(); }
            else { openWindow(wikihome); }
        }
        
        // move the window element to the recently closed list
        this.movetorecent();
    }
    
    restore() {
        // move the window back to the windows list, then activate it
        this.movetowindows();
        this.activate();
    }
    
    remove() {
        // remove from the closed list
        var index = WikiPage.closed.indexOf(this);
        if (index != -1)  { WikiPage.closed.splice(index, 1); }
        
        // remove the element
        this.window.remove();
    }
    
    movetorecent() {
        var recentlist = elid("recentlist");
        var index = WikiPage.opened.indexOf(this);
        
        // move the page to the recently closed list
        if (index != -1)  { WikiPage.opened.splice(index, 1); }
        WikiPage.closed.unshift(this);
        if (WikiPage.closed.length > 5) { WikiPage.closed.pop().remove(true); }
        
        // move the element to the recently closed list
        this.window.remove();
        recentlist.prepend(this.window);
        if (recentlist.childElementCount > 5) { recentlist.lastElementChild.remove(); }
        
        // refresh and update lists
        refreshlists(); updatestorage();
        
        // update click handlers
        this.window.firstChild.onclick = this.restore.bind(this);
        this.window.lastChild.onclick = this.remove.bind(this);
    }
    
    movetowindows() {
        var windowslist = elid("windowslist");
        var index = WikiPage.closed.indexOf(this);
        
        // move the page to the windows list
        if (index != -1)  { WikiPage.closed.splice(index, 1); }
        WikiPage.opened.push(this);
        
        // move the element to the windows list
        this.window.remove();
        windowslist.append(this.window);
        
        // refresh and update lists
        refreshlists(); updatestorage();
        
        // update click handlers
        this.window.firstChild.onclick = this.activate.bind(this);
        this.window.lastChild.onclick = this.close.bind(this);
    }
    
    loadstate(state) {
        if (typeof state !== "object") { return; }
        this.rename(state.name);
        this.loadscroll(state.scroll);
    }
    
    savestate() {
        this.savescroll();
        return this.getstate();
    }
    
    getstate() {
        return { name: this.name, scroll: this.scroll };
    }
    
    savescroll() {
    	this.scroll[this.tab] = { top: this.content.scrollTop, left: this.content.scrollLeft };
    }
    
    loadscroll(scroll) {
        this.scroll = (scroll || this.scroll);
        this.content.scrollTo(this.scroll[this.tab] || { top:0, left:0 });
    }
    
    toJSON() {
        return { name: this.name, back: this.back, frwd: this.frwd };
    }
}

// static variables
WikiPage.opened = [];
WikiPage.closed = [];
WikiPage.template = null;