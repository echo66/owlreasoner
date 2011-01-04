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