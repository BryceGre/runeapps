///<reference path="index.js"/>
"use strict";


function parsewiki(name, html, root) {
	var allowedattr = "alt,style,title,colspan,rowspan,width,height".split(",");
	var allowedtag = "tbody,abbr,b,big,blockquote,br,caption,center,cite,code,dd,del,dfn,div,dl,dt,em,font,h1,h2,h3,h4,h5,h6,hr,i,ins,kbd,li,ol,p,pre,s,samp,small,span,strike,strong,sub,sup,table,td,th,tr,tt,u,ul,var,nav,img,figcaption,figure,noscript,a".split(",");
    
	if (!root) {
		root = document.createElement("div");
		root.className = "parseroot";
	}

	var targettab = function (tabnr,name) {
		var el = elid("tabcontent" + tabnr);
		elid("contenttab" + tabnr).style.display = "block";
		elems.push(el);
		if (name) {
			curParentNode.appendChild(eldiv([
				eldiv("wikilink:a", { onclick: settab.b(tabnr) }, ["View " + name])
			]));
		}

		curParentNode = el;
		cheatlayers[elems.length - 1] = true;
	}
	var resolveUrl = function (url) {
		try {
			var u = new URL(url, imageorigin);
		}
		catch (e) {
			console.log("ignored invalid url: " + url);
			return null;
		}
		if (allowedorigins.indexOf(u.origin) == -1) {
			console.log("url origin blocked: " + url);
			return null;
		}
		return u.href;
	}


	var curParentNode = root;
	var elems = [];
	var cheatlayers = [];
	var yieldcount = 0;

	var gen = htmlparser.HTMLParser(html, {
		start: function (tag, attrs, unary) {
			var collapse = false;
			if (allowedtag.indexOf(tag) == -1) { clog("tag", tag); return true; }
			if (tag == "noscript") { tag = "span"; }//replace with div to show noscript content

			var elem = document.createElement(tag);

			if (tag == "table") { elem.classList.add("wikitable"); }
			
			//do special stuff with special attributes
			for (var attr in attrs) {

				var attrname = attrs[attr].name;
				var attrvalue = attrs[attr].value;
				
				if (attrname == "data-src") { return true; }
				if (attrname == "class") {
					var classes = attrvalue.split(" ");
					for (var b in classes) {
						var cl = classes[b];
						if (cl == "editsection") { return true; }
						if (cl == "toc") { return true; }
						if (cl == "topright-icon") { return true; }
						if (cl == "navbox-wrapper") { return true; }
						if (cl == "navbox") { return true; }
						if (cl == "musicplayer") { return true; }
						if (cl == "infobox-exchange-data") { return true; }
						if (cl == "infobox-bottom-links") { return true; }
						if (cl == "mw-collapsed") { return true; }
						if (cl == "hidden") { return true; }

						
						if (cl == "mw-editsection") { return true; }
						if (cl == "thumbinner") { collapse = true; }
						if (cl == "GEChartBox") { return true;}


						if (cl == "infobox-bonuses") { targettab(1,"bonuses table"); elem.classList.add("wiki-bonuses"); }
						if (cl == "infobox-wrapper") { targettab(3,"infobox"); elem.classList.add("wiki-monster"); }
						if (cl == "rsw-infobox") { targettab(3,"infobox"); elem.classList.add("wiki-monster"); }
						if (cl == "item-drops") { targettab(4,"drops table"); elem.classList.add("wiki-drops"); }

						if (cl == "floatright") { elem.classList.add("floatright"); }
						if (cl == "floatleft") { elem.classList.add("floatleft"); }
						if (cl == "tright") { elem.classList.add("floatright"); }
						if (cl == "tleft") { elem.classList.add("floatleft"); }
						
						if (cl == "mw-headline") { elem.classList.add("wiki-headline"); }
					}
				}
				if (tag == "a" && attrname == "href") {
					var href = attrvalue.match(/^\/(wiki|w)\/(.+)$/);
					if (href) {
						var page = decodeURIComponent(href[2]);
						if (!page.match(/^file:/i)) {
							elem.classList.add("wikilink");
							elem.dataset.page = page;
							elem.onclick = function (obj) { loadpage(obj); }.b(page);
						}
					}
				}
				if (attrname == "src") {
					elem.setAttribute("src", resolveUrl(attrvalue));
				}

				//copy whitelist attributes
				if (allowedattr.indexOf(attrname) != -1) {
					elem.setAttribute(attrname, attrvalue);
				}
			}

			if (!collapse) {
				curParentNode.appendChild(elem);
				yieldcount++;
			}
			if (!unary) {
				elems.push(elem);
				if (!collapse) {
					curParentNode = elem;
				}
			}
		},
		end: function (tag) {
			elems.length -= 1;
			curParentNode = elems[elems.length - 1] || root;
			if (cheatlayers[elems.length - 1]) { this.end(); }
			cheatlayers.length = elems.length;
		},
		chars: function (text) {
		    var innerText = decodeEntities(text);
			curParentNode.appendChild(document.createTextNode(innerText));
			if (curParentNode.classList.contains("wiki-headline")) {
			    var elem = document.createElement("a");
			    elem.classList.add("wiki-headline-headanchor");
			    elem.setAttribute("name", innerText.replace(/\s/g, "_"));
			    curParentNode.before(elem);
			}
			yieldcount++;
		},
		comment: function (text) { },
		yield: function() {
		    if (yieldcount > 200) {
		        yieldcount = 0;
		        return true;
		    }
		    return false;
		}
	});
	
	return new Promise(function rungen(resolve, reject) {
	    try {
          if (gen.next().done === false) {
              setTimeout(rungen.bind(this, resolve, reject), 10);
          } else { resolve(root); }
        } catch (err) { reject(err); }
	});
}