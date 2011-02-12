/**
 * Represents an arbitrary text file.
 * 
 * @param url URL of the file.
 */
function TextFile(url) {
    if (!url) {
        throw 'URL of the file is not specified!';
    }
   
    /**
     * URL of the file.
     */
    this.url = url;
}

/**
 * Prototype for all TextFile objects.
 */
TextFile.prototype = {
    /**
     * Returns the content of the file as text.
     * 
     * @returns Content of the file as text.
     */
    getText: function () {
        var xhr;

        if (!this.url) {
            throw 'URL of the file is not specified!';
        }
      
	    xhr = new XMLHttpRequest();
         
        try {
            xhr.open('GET', this.url, false);
            xhr.send(null);
            return xhr.responseText;
        } catch (ex) {
            throw ex;
        }
    } 
};

/**
 * Tab control objects allow to control visibility of panels ('tabs'), based on the user selection.
 * This is analogous to Windows tab control.
 *
 * @param tabs Array of objects representing each tab controlled.
 * @param classNames An object defining the CSS names for active/inactive, enabled/disabled tab
 * items.
 */
function TabControl(tabs, classNames) {
    var firstEnabled, tab, tabCount, tabIndex;

    /**
     * Collection of objects representing each tab.
     */
    this.tabs = tabs;
    
    /**
     * An object with properties defining CSS class names for active/inactive, enabled/disabled tab
     * items
     */
    this.classNames = classNames;
   
    tabCount = tabs.length || 0;

    // Set tabs as enabled or disabled.
    for (tabIndex = 0; tabIndex < tabCount; tabIndex++) {
        tab = tabs[tabIndex];
      
        this.setOnClickHandler(this, tab.tabId);
      
        if (tab.enabled) {
            this.setEnabled(tab.tabId, true);
        } else {
            this.setEnabled(tab.tabId, false);
        }
    }

    // Select the first enabled tab.
    firstEnabled = this.findFirstEnabled();
   
    if (firstEnabled) {
        this.select(firstEnabled.tabId);
    }
}

/**
 * Prototype for all TabControl objects.
 */
TabControl.prototype = {
    /**
     * Returns an object representing the tab with the given id in the tabs collection.
     *
     * @param id ID of the tab object to find.
     * @returns Object representing the tab with the given id.
     */
    find: function (id) {
        var tabs = this.tabs,
            tabCount = tabs.length,
            tabIndex;
         
	    for (tabIndex = 0; tabIndex < tabCount; tabIndex++) {
	        if (tabs[tabIndex].tabId == id) {
                return tabs[tabIndex];
            }
	    }
     
        return undefined;
    },
   
    /**
     * Sets the onclick handler for the tab item with the given ID.
     *
     * @param tabControl Reference to the parent tab control.
     * @param id ID of the tab item to set the onclick handler for.
     */
    setOnClickHandler: function (tabControl, id) {
        var existingHandler = document.getElementById(id).onclick; 
      
        document.getElementById(id).onclick = function () {         
            if (existingHandler) {
                existingHandler();
            }
         
	        tabControl.select(id);
         
            return false;
        };
    },
    
    /**
     * Finds the first tab in the tab collection which is not disabled.
     *
     * @returns Object corresponding to the first tab in the collection which is not disabled.
     */
    findFirstEnabled: function () {
        var tab,
            tabs = this.tabs,
            tabCount = tabs.length,
            tabIndex;
      
        for (tabIndex = 0; tabIndex < tabCount; tabIndex++) {
            tab = tabs[tabIndex];
      
            if (tab.enabled) {
                return tab;
            }
        }
    },
   
    /**
     * Sets the enabled/disabled status of the tab with the given ID.
     *
     * @param id ID of the tab to set the status for.
     * @param enabled Boolean value indicating whether the tab should be enabled (true) or disabled
     * (false).
     */
    setEnabled: function (id, enabled) {
        var firstEnabled, tab;

        if (!this.classNames || (!enabled && !this.classNames.disabled)) {
            return;
        }
      
        tab = this.find(id);
      
        if (!tab) {
            // Can't select tab if it's not present or is disabled.
            return;
        }
      
        if (!enabled) {
	        document.getElementById(tab.tabId).className = this.classNames.disabled;
         
            if (this.selected && this.selected.tabId == id) {
                document.getElementById(tab.boxId).style.display = "none";
            
	            firstEnabled = this.findFirstEnabled();
         
                if (firstEnabled) {
                    this.select(firstEnabled.tabId);
                }
            }
        } else {
            document.getElementById(tab.tabId).className = this.classNames.enabled || "";
        }
      
        tab.enabled = enabled;
    },
   
    /**
     * Selects the tab item with the given ID on the page and displays the corresponding content.
     *
     * @param id ID of the tab item to select.
     */
    select: function (id) {
        var tab;

        if (!this.classNames || !this.classNames.active) {
            return;
        }
      
        tab = this.find(id);
      
        if (!tab || !tab.enabled) {
            // Can't select tab if it's not present or is disabled.
            return;
        }

        if (this.selected) {
	        // Deselect the currently selected tab.
            document.getElementById(this.selected.tabId).className = this.classNames.inactive || "";
            document.getElementById(this.selected.boxId).style.display = "none";
        }
         
	    // Deselect the given tab.
	    document.getElementById(tab.tabId).className = this.classNames.active;
	    document.getElementById(tab.boxId).style.display = "block";
      
        this.selected = tab;
    }
};

/**
 * Puts all own properties of the given object into the array and sorts it in the ascending order.
 * 
 * @param object Object containing some properties.  
 * @returns Array containing names of all own properties of the given object in ascending order. 
 */
function objectPropertiesToArray(object) {
    var properties = [],
        property;
           
    for (property in object) {
        if (object.hasOwnProperty(property)) {
            properties.push(property);
        }
    }
           
    properties.sort();
    return properties;
}
