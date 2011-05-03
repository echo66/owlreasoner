            // Hold references to the corresponding objects, after the reasoner is built.
            var reasoner, tabControl, classTree, opropTree;
        
            /**
             * Shows the given error message in the browser.
             * 
             * @param msg Error message to show in the browser.
             */
            function handleError(msg) {
                alert('ERROR: ' + msg);
            }
        
            /**
             * Prepares the tab with ontology for the display after the ontology is processed.
             */
            function prepareOntologyTab() {
                // Hide the Classify button and sample ontologies.
                document.getElementById('sampleOntologies').style.display = 'none';
                document.getElementById('classifyBtn').style.display = 'none';
                document.getElementById('ontologyText').readOnly = true;
                tabControl.setEnabled('ontologyTab', true);
            }
        
            /**
             * Prepares the tab with statistical information (execution time etc.) for display after
             * the ontology is processed.
             * 
             * @param ontology Ontology object representing the ontology processed.
             * @param parsingTime String containing information about how long did ontology parsing
             * take.
             * @param totalTime String containing information about how long did the ontology
             * processing took on total.
             */
            function prepareStatsTab(ontology, parsingTime, totalTime) {
                // Show the classification information.
                document.getElementById('parsingTime').innerHTML = parsingTime;
                document.getElementById('normalizationTime').innerHTML = 
                    reasoner.timeInfo.normalization;
                document.getElementById('opropSubsumptionTime').innerHTML = 
                    reasoner.timeInfo.objectPropertySubsumption;
                document.getElementById('classificationTime').innerHTML = 
                    reasoner.timeInfo.classification;
                document.getElementById('aBoxRewritingTime').innerHTML = 
                    reasoner.timeInfo.aBoxRewriting;
                document.getElementById('classHierarchyTime').innerHTML = 
                    reasoner.timeInfo.classHierarchy;
                document.getElementById('opropHierarchyTime').innerHTML = 
                    reasoner.timeInfo.objectPropertyHierarchy;
                document.getElementById('totalTime').innerHTML = totalTime;
            
                document.getElementById('classCount').innerHTML = ontology.getClassCount();
                document.getElementById('opropCount').innerHTML = ontology.getObjectPropertyCount();
                document.getElementById('individualCount').innerHTML = ontology.getIndividualCount();
            
                document.getElementById('tboxSize').innerHTML = ontology.getTBoxSize();
                document.getElementById('aboxSize').innerHTML = ontology.getABoxSize();
                document.getElementById('axiomCount').innerHTML = ontology.getSize();               
                tabControl.setEnabled('statsTab', true);
            }
        
            /** Prepares the Classes tab for display after the ontology has been processed. */
            function prepareClassesTab(ontology) {
                var hierarchy = reasoner.classHierarchy;

                if (hierarchy.length > 0) {
                    classTree = new jsw.ui.TreeControl(hierarchy, 'classHierarchy', {
                        titleClass: 'classLink',
                        childrenCountClass: 'classChildrenCount', 
                        highlightClass: 'highlightText',
                        specialClass: 'special'
                    });

                    tabControl.setEnabled('classesTab', true);
                }
            }

            /**
             * Prepares the Object Properties tab for display after the ontology has been processed.
             */
            function prepareOpropTab(ontology) {
                var hierarchy = reasoner.objectPropertyHierarchy;

                if (hierarchy.length > 0) {
                    opropTree = new jsw.ui.TreeControl(hierarchy, 'opropHierarchy', {
                        titleClass: 'classLink',
                        childrenCountClass: 'classChildrenCount', 
                        highlightClass: 'highlightText',
                        specialClass: 'special'
                    });

                    tabControl.setEnabled('opropTab', true);
                }
            }

            /** Prepare SPARQL tab for display after the ontology has been processed. */        
            function prepareSparqlTab(ontology) {
                tabControl.setEnabled('sparqlTab', true);
            }
        
            /** Parses the ontology from the given OWL/XML and builds a reasoner object for it. */ 
            function classifyBtnClicked() {
                var clock, classificationTime, ontology, text, totalClock, totalTime;

                try {
                    text = document.getElementById('ontologyText').value;
              
                    totalClock = new jsw.util.Stopwatch();
                    clock = new jsw.util.Stopwatch();

                    totalClock.start();
                    clock.start();
                    
                    if (jsw.util.string.isUrl(text)) {
                        ontology = jsw.owl.xml.parseUrl(text, handleError);
                    } else {
                        ontology = jsw.owl.xml.parse(text, handleError);
                    }
                    
                    parsingTime = clock.stop();

                    clock.start();
                    reasoner = new jsw.owl.BrandT(ontology);
                    classificationTime = clock.stop(); 
                    totalTime = totalClock.stop();

                    prepareOntologyTab();
                    prepareStatsTab(ontology, parsingTime, totalTime);
                    prepareClassesTab();
                    prepareOpropTab();
                    prepareSparqlTab();

                    tabControl.select('statsTab');
                } catch (ex) {
                    handleError(ex);
                }
            }
        
            /** Processes the query from the given string and outputs the result. */
            function queryBtnClicked() {
                var query, queryTxt, result, stopwatch;

                try {
                    if (!reasoner) {
                        throw 'The reasoner has not been initialized yet!';
                    }
              
                    queryTxt = document.getElementById('queryText').value;
              
                    stopwatch = new jsw.util.Stopwatch();
                    stopwatch.start();
                    query = jsw.sparql.parse(queryTxt);
                    result = reasoner.answerQuery(query);
              
                    document.getElementById('queryResultsTime').innerHTML = 
                        ' (obtained in ' + stopwatch.stop() + '):'; 
                    
                    // Display a table with query results. 
                    new jsw.ui.TableControl(
                        result, 
                        'queryResults',
                        'queryResultsTable', 
                        'No results found matching the query!');
                } catch (ex) {
                    handleError(ex);
                }
            }
        
            /**
             * Loads ontology stored at the given path into the ontology text box.
             * 
             * @param url URL of the file containing an ontology to load.
             */
            function showOntologyFile(url) {
                var nav = navigator.appVersion;
                
                try {                      
                    // For Chrome, we just open the ontology file in a new tab, since there is no 
                    // way to read local files in Chrome.
                    if (nav.indexOf('Chrome') >= 0) {
                        return true;
                    }
               
                    document.getElementById('ontologyText').value = new jsw.util.TextFile(url).getText();
                    return false;
                } catch (ex) {
                    // Returns false, so that the file can be opened in a new window.
                    return false;
                }
            }
         
            /** Initializes the page when it is loaded. */
            function init() {
                tabControl = new jsw.ui.TabControl([
                    {tabId: 'ontologyTab', boxId: 'ontologyBox', enabled: true },
                    {tabId: 'statsTab',    boxId: 'statsBox',    enabled: false},
                    {tabId: 'classesTab',  boxId: 'classesBox',  enabled: false},
                    {tabId: 'opropTab',    boxId: 'opropBox',    enabled: false},
                    {tabId: 'sparqlTab',   boxId: 'sparqlBox',   enabled: false}
                ], {
                    active: 'active',
                    disabled: 'disabled'
                });
            }