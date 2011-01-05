/**
 * Stopwatch allows measuring time between different events.
 */
var Stopwatch = function ()
{
   // Time (in miliseconds) when the stopwatch was started last time.
   var startTime = undefined;
   
   // Contains the number of miliseconds in the last measured period of time.
   var elapsedMs = undefined;
   
   // Returns textual representation of the last measured period of time.
   function getElapsedTimeAsText()
   {
      var miliseconds = elapsedMs;
      
      var hours = Math.floor(miliseconds / 3600000);
      var minutes = Math.floor(miliseconds % 3600000 / 60000);
      var seconds = Math.floor(miliseconds % 60000 / 1000);
      miliseconds = miliseconds % 1000;
              
      return hours + ' : ' + minutes + ' : ' + seconds + '.' + miliseconds;
   }
   
   /**
    * Starts measuring the time.
    */
   this.start = function()
   {
      startTime = new Date().getTime();
      elapsedMs = undefined;
   }
   
   /**
    * Stops measuring the time.
    * 
    * @returns Textual representation of the measured period of time.
    */
   this.stop = function()
   {
      elapsedMs = new Date().getTime() - startTime;
      return getElapsedTimeAsText();
   }
};

/**
 * Represents an arbitrary text file.
 * 
 * @param url URL of the file.
 */
var TextFile = function(url)
{
   if (!url)
   {
      throw new 'URL of the file is not specified!';
   }
   
   /**
    * URL of the file.
    */
   this.url = url;
};

TextFile.prototype = 
{
   /**
    * Returns the content of the file as text.
    * 
    * @returns Content of the file as text.
    */
   getText: function()
   {
      if (!this.url)
      {
         throw new 'URL of the file is not specified!';
      }
      
      var xhr = new XMLHttpRequest();
      
      try 
      {
         xhr.open('GET', this.url, false);
         xhr.send(null);
         return xhr.responseText;
      }
      catch (ex)
      {
         throw ex;
      }
   } 
};

var TabControl = function(tabs, classNames)
{
   this.tabs = tabs;
   this.classNames = classNames;
   var tabControl = this;
   
   var tabCount = tabs.length || 0;
   
   // Set tabs as enabled or disabled.
   for (var tabIndex = 0; tabIndex < tabCount; tabIndex++)
   {
      var tab = tabs[tabIndex];
      
      this.setOnClickHandler(tab.tabId);
      
      if (tab.enabled)
      {
         this.setEnabled(tab.tabId, true);
      }
      else
      {
         this.setEnabled(tab.tabId, false);
      }
   }

   // Select the first enabled tab.
   var firstEnabled = this.findFirstEnabled();
   
   if (firstEnabled)
   {
      this.select(firstEnabled.tabId);
   }  
};

TabControl.prototype = 
{
   find: function(id)
   {
      var tabs = this.tabs;
	   var tabCount = tabs.length;
         
	   for (var tabIndex = 0; tabIndex < tabCount; tabIndex++)
	   {
	      if (tabs[tabIndex].tabId == id)
         {
            return tabs[tabIndex];
         }
	   }
     
      return undefined;
   },
   
   setOnClickHandler: function(id)
   {
      var existingHandler = document.getElementById(id).onclick; 
      
      document.getElementById(id).onclick = function()
      {         
         if (existingHandler)
         {
            existingHandler();
         }
         
	      tabControl.select(id);
         
         return false;
      }
   },
   
   findFirstEnabled: function()
   {
      var tabs = this.tabs;
	   var tabCount = tabs.length;
      
      for (var tabIndex = 0; tabIndex < tabCount; tabIndex++)
      {
         var tab = tabs[tabIndex];
      
         if (tab.enabled)
         {
	         return tab;
         }
      }
   },
   
   setEnabled: function(id, enabled)
   {
      if (!this.classNames || (!enabled && !this.classNames.disabled))
      {
         return;
      }
      
      var tab = this.find(id);
      
      if (!tab)
      {
         // Can't select tab if it's not present or is disabled.
         return;
      }
      
      if (!enabled)
      {
	      document.getElementById(tab.tabId).className = this.classNames.disabled;
         
         if (this.selected && this.selected.tabId == id)
         {
            document.getElementById(tab.boxId).style.display = "none";
            
	         var firstEnabled = this.findFirstEnabled();
         
            if (firstEnabled)
            {
               this.select(firstEnabled.tabId);
            }
         }
      }
      else
      {
         document.getElementById(tab.tabId).className = this.classNames.enabled || "";
      }
      
      tab.enabled = enabled;
   },
   
   select: function(id)
   {
      if (!this.classNames || !this.classNames.active)
      {
         return;
      }
      
      var tab = this.find(id);
      
      if (!tab || !tab.enabled)
      {
         // Can't select tab if it's not present or is disabled.
         return;
      }

      if (this.selected)
      {
         var inactiveClass = this.classNames.inactive || "";
         
	      // Deselect the currently selected tab.
         document.getElementById(this.selected.tabId).className = inactiveClass;
         document.getElementById(this.selected.boxId).style.display = "none";
      }
         
	   // Deselect the given tab.
	   document.getElementById(tab.tabId).className = this.classNames.active;
	   document.getElementById(tab.boxId).style.display = "block";
      
      this.selected = tab;
   }
};