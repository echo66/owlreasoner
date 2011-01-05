/**
 * Code for browser-hosted OWL reasoner. The reasoner can currently work with OWL EL ontologies in
 * OWL/XML syntax.
 * 
 * @author: Vit Stepanovs <vitaly.stepanov@gmail.com>, 2010 - 2011.
 */

/**
 * Name by which the Thing concept is referred in OWL.
 */  
const THING = 'owl:Thing';

/**
 * Types of axioms understood by the reasoner.
 */
const AXIOM_CLASS_SUB = 'subClassOf';
const AXIOM_CLASS_EQ = 'equivalentClasses';
const AXIOM_OPROP_SUB = 'subObjectPropertyOf';

/**
 * Types of facts understood by the reasoner.
 */
const FACT_CLASS = 'classAssertion';
const FACT_OPROP = 'objectPropertyAssertion';
    

/**
 * Types of entities (ET) understood by the reasoner.
 */
const ET_CLASS = 'class';
const ET_OPROP = 'objectProperty';
const ET_INDIVIDUAL = 'individual';
      
/**
 * Types of class expressions (CE) understood by the reasoner.
 */
const CE_INTERSECT = 'objectIntersectionOf';
const CE_OBJ_VALUES_FROM = 'objectSomeValuesFrom';

/**
 * Types of object property expressions (OPE) understood by the reasoner.
 */      
const OPE_CHAIN = 'objectPropertyChain';

/**
 * Contains a list of prefixes to be used for auto-generated entity IRIs (indexed by entity 
 */
var ENTITY_AUTO_PREFIXES = {};
ENTITY_AUTO_PREFIXES[ET_OPROP] = 'OP_';
ENTITY_AUTO_PREFIXES[ET_CLASS] = 'C_';
ENTITY_AUTO_PREFIXES[ET_INDIVIDUAL] = 'I_';

/**
 * Namespace for all OWL objects.
 */
var owl = 
{
   name: 'OWL Reasoner',
   version: 0.3   
};

/**
 * An object allowing to work with OWL/XML format.
 */
owl.xml =
{
   /**
    * Parses the given OWL/XML string into the Ontology object.
    * 
    * @param owlXml String containing OWL/XML to be parsed.
    * @param onError Function to be called in case if the parsing error occurs.
    * @returns Ontology object representing the ontology parsed.
    */
   parse: function(owlXml, onError)
   {      
      var ontology = new owl.Ontology();
   
      /**
       * Parses XML element representing some entity into the object.
       * 
       * @param type Type of the entity represented by the XML element.
       * @param element XML element representing some entity.
       * @returns Object representing the entity parsed. 
       */
      function parseEntity(type, element)
      {
         var IRI = element.getAttribute('IRI');
         var abbrIRI = element.getAttribute('abbrIRI');
         
         // If both attributes or neither are defined on the entity, it is an error.
         if (!IRI && !abbrIRI || IRI && abbrIRI)
         {
            throw 'Both IRI and abbreviatedIRI attributes are present in ' + element.nodeName + 
               ' element!';
         }
         
         if (abbrIRI)
         {
            return ontology.createEntity(type, abbrIRI, true);            
         }
         else
         {
            return ontology.createEntity(type, IRI, false);
         }
      }
      
      /**
       * Parses XML element representing class intersection expression.
       * 
       * @param element XML element representing class intersection expression.
       * @returns Object representing the class intersection expression. 
       */
      function parseObjIntersectExpr(element)
      {
         var classExprs = [];
         
         var nodes = element.childNodes;
         var nodeCount = nodes.length;
         
         for (var nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++)
         {
            var node = nodes[nodeIndex];
            
            if (node.nodeType != 1)
            {
               continue;
            }
            
            var classExpr = parseClassExpr(node);
            classExprs.push(classExpr);
         }
         
         var intersectExpr =
         {
            'type': CE_INTERSECT,
            'args': classExprs
         }
         
         return intersectExpr;
      }
      
      /**
       * Parses XML element representing ObjectSomeValuesFrom expression.
       * 
       * @param element XML element representing the ObjectSomeValuesFrom expression.
       * @returns Object representing the expression parsed.
       */
      function parseSomeValuesFromExpr(element)
      {
         var oprop, classExpr;
         
         var nodes = element.childNodes;
         var nodeCount = nodes.length;
         
         for (var nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++)
         {
            var node = nodes[nodeIndex];
            
            if (node.nodeType != 1)
            {
               continue;
            }
            
            if (!oprop)
            {
               if (node.nodeName != 'ObjectProperty') 
               {
                  throw 'The format of ObjectSomeValuesFrom expression is incorrect!';
               }
               
               oprop = parseEntity(ET_OPROP, node);               
            }
            else if (!classExpr)
            {
	            classExpr = parseClassExpr(node);
	         }
            else
            {
               throw 'The format of ObjectSomeValuesFrom expression is incorrect!';
            }
         }
         
         if (!oprop || !classExpr)
         {
            throw 'The format of ObjectSomeValuesFrom expression is incorrect!';
         }
         
         var objSomeValuesFromExpr = 
         {
            'type': CE_OBJ_VALUES_FROM,
            'opropExpr': oprop,
            'classExpr': classExpr
         }
         
         return objSomeValuesFromExpr;
      }
      
      /**
       * Parses the given XML node into the class expression.
       *
       * @param element XML node containing class expression to parse.
       * @returns An object representing the class expression parsed.
       */
      function parseClassExpr(element)
      {
         switch (element.nodeName)
         {
            case 'Class': return parseEntity(ET_CLASS, element);
            case 'ObjectIntersectionOf': return parseObjIntersectExpr(element);
            case 'ObjectSomeValuesFrom': return parseSomeValuesFromExpr(element);
         }
      }
      
     /**
      * Parses an XML element representing the object property chain into the object.
      *
      * @param element Element representing an object property chain.
      * @returns Object representing the object property chain parsed.
      */
      function parseOpropChain(element)
      {
         var chain = 
         {
            type: OPE_CHAIN,
            args: []            
         };
         
         var nodes = element.childNodes;
         var nodeCount = nodes.length;
         
         for (var nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++)
         {
            var node = nodes[nodeIndex];
            
            if (node.nodeType == 1)
            {
               var property = parseEntity(ET_OPROP, node);
               chain.args.push(property);
            }
         }
         
         if (chain.args.length < 2)
         {
            throw 'The object property chain should contain at least 2 object properties.';
         }
         
         return chain;
      }
      
      /**
       * Parses XML element representing SubObjectPropertyOf axiom into the object.
       * 
       * @param element XML element representing SubObjectPropertyOf axiom.
       * @returns Object representing the SubObjectPropertyOf axiom parsed.
       */
      function parseSubOpropAxiom(element)
      {
         var firstArg, secondArg;
         
	      var nodes = element.childNodes;
         var nodeCount = nodes.length;
         
         for (var nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++)
         {
            var node = nodes[nodeIndex];
            
            if (node.nodeType != 1)
            {
               continue;
            }
            
            if (node.nodeName == 'ObjectPropertyChain')
            {
                if (firstArg)
                {
                    throw 'The format of SubObjectPropertyOf axiom is incorrect!';
                }
                
                firstArg = parseOpropChain(node);
            }
            else if (node.nodeName == 'ObjectProperty')
            {
	            if (!firstArg) 
	            {
	               firstArg = parseEntity(ET_OPROP, node);
	            }
	            else if (!secondArg)
	            {
	               secondArg = parseEntity(ET_OPROP, node);
	            }
	            else 
               {
	               throw 'The format of SubObjectPropertyOf axiom is incorrect!';
	            }
	         }
         }
         
         if (!firstArg || !secondArg)
         {
            throw 'The format of SubObjectPropertyOf axiom is incorrect!';
         }
         
         var subOpropOfAxiom =
         {
            'type': AXIOM_OPROP_SUB,
            'arg1': firstArg,
            'arg2': secondArg 
         }
         
         return subOpropOfAxiom;
      }
      
      /**
       * Parse XML element representing a class axiom into the object.
       * 
       * @param type Type of the class axiom to parse.
       * @param element XML element representing the class axiom to parse. 
       * @param minExprCount Minimum number of times the class expressions should occur in the 
       * axiom.
       * @param maxExprCount Maximum number of times the class expressions should occur in the 
       * axiom.
       */
      function parseClassAxiom(type, element, minExprCount, maxExprCount)
      {
          var newAxiom =          
          {
	            'type': type,
               'args': []
          };
          
          var nodes = element.childNodes;
          var nodeCount = nodes.length;
          
          for (var nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++)
          {
             var node = nodes[nodeIndex];
             
             if (node.nodeType == 1) 
             {
                var classExpr = parseClassExpr(node);
                newAxiom.args.push(classExpr);
             }
          }

          var exprCount = newAxiom.args.length;
          
	       if (!isNaN(minExprCount) && exprCount < minExprCount)
          {
             throw 'Class axiom contains less than ' + minExprCount + ' class expressions!';
          }
          
          if (!isNaN(maxExprCount) && exprCount > maxExprCount)
          {
             throw 'Class axiom contains more than ' + maxExprCount + ' class expressions!';
          }

          return newAxiom;
      }
      
      /**
       * Parses ClassAssertion XML element into the corresponding object.
       * 
       * @param element OWL/XML ClassAssertion element.
       * @returns Object representing the class assertion parsed. 
       */
      function parseClassAssertion(element)
      {
         var classExpr = null;
         var individual = null;
         
         var nodes = element.childNodes;
         var nodeCount = nodes.length;
          
         for (var nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++)
         {
            var node = nodes[nodeIndex];
             
            if (node.nodeType != 1) 
            {
               continue;
            }
            
            if (!classExpr)
            {
	            if (node.nodeName != 'Class')
	            {
                  throw 'Incorrect format of the ClassAssertion element!';
	            }

               classExpr = parseClassExpr(node);
	         }
	         else if (!individual)
	         {
	            if (node.nodeName != 'Individual')
               {
                  throw 'Incorrect format of the ClassAssertion element';                  
               }
               
               individual = parseEntity(ET_INDIVIDUAL, node);               
            }
            else
            {
               throw 'Incorrect format of the ClassAssertion element';
            }                  
         }
         
         if (!classExpr || !individual)
         {
            throw 'Incorrect format of the ClassAssertion element';
         }
         
         var fact = 
         {
            'type': FACT_CLASS,
            'individual': individual, 
            'classExpr': classExpr,
         };
         
         return fact;
      }
      
      /**
       * Parses ObjectPropertyAssertion OWL/XML element into the corresponding object.
       * 
       * @param element OWL/XML ObjectPropertyAssertion element to parse.
       * @returns Object representing the element parsed.
       */
      function parseObjectPropertyAssertion(element)
      {
         var objectProperty = null;
         var leftIndividual = null;
         var rightIndividual = null;
         
         var nodes = element.childNodes;
         var nodeCount = nodes.length;
          
         for (var nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++)
         {
            var node = nodes[nodeIndex];
             
            if (node.nodeType != 1) 
            {
               continue;
            }
            
            if (!objectProperty)
            {
	            if (node.nodeName != 'ObjectProperty')
	            {
                  throw 'Incorrect format of the ObjectPropertyAssertion element!';
	            }
               
               objectProperty = parseEntity(ET_OPROP, node);
	         }
	         else if (!leftIndividual)
	         {
	            if (node.nodeName != 'Individual')
               {
                  throw 'Incorrect format of the ObjectPropertyAssertion element';
               }
               
               leftIndividual = parseEntity(ET_INDIVIDUAL, node);
            }
	         else if (!rightIndividual)
	         {
	            if (node.nodeName != 'Individual')
               {
                  throw 'Incorrect format of the ObjectPropertyAssertion element';
               }
               
	            rightIndividual = parseEntity(ET_INDIVIDUAL, node);
            }
            else
            {
               throw 'Incorrect format of the ObjectPropertyAssertion element';
            }                  
         }
         
         if (!objectProperty || !leftIndividual || !rightIndividual)
         {
            throw 'Incorrect format of the ObjectPropertyAssertion element';
         }
         
         var fact = 
         {
            'type': FACT_OPROP,
            'leftIndividual': leftIndividual,
            'objectProperty': objectProperty, 
            'rightIndividual': rightIndividual,
         };
         
         return fact;
      }
      
      var xmlDoc = null;
      
      if (window.DOMParser)
      {
         parser = new DOMParser();
         xmlDoc = parser.parseFromString(owlXml, 'text/xml');
      }
      else
      {
         xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
         xmlDoc.async = 'false';
         xmlDoc.loadXML(owlXml); 
      }
      
      var nodes = xmlDoc.documentElement.childNodes;
      var nodeCount = nodes.length;
      
      for (var nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++)
      {
         var node = nodes[nodeIndex]; 
         
         if (node.nodeType != 1)
         {
            continue;
         }
         
         var statement = null;
         
         try 
         {
            switch (node.nodeName) 
            {
               case 'SubClassOf':
                  statement = parseClassAxiom(AXIOM_CLASS_SUB, node, 2, 2);
                  break;
               case 'EquivalentClasses':
                  statement = parseClassAxiom(AXIOM_CLASS_EQ, node, 2);
                  break;
               case 'SubObjectPropertyOf':
                  statement = parseSubOpropAxiom(node);
                  break;
               case 'ClassAssertion':
                  statement = parseClassAssertion(node);
                  break;
               case 'ObjectPropertyAssertion':
                  statement = parseObjectPropertyAssertion(node);
                  break;
            }
         }
         catch (ex)
         {
            if (!onError)
            {
               throw ex;
            }
            
            onError(ex);
         }
         
         if (statement)
         {
            ontology.axioms.push(statement);
         }
      }
      
      return ontology;
  },
  
  /**
   * Builds an OWL/XML string representing the given ontology.
   * 
   * @param ontology Ontology to return the OWL/XML representation for.
   */
  write : function(ontology)
  {
     /**
      * Returns OWL/XML representation for the given OWL entity.
      * 
      * @param entity Entity to return OWL/XML representation for.
      * @param name Name of XML tag to use for the entity.
      * @returns OWL/XML representation for the given OWL entity.
      */
     function writeEntity(entity, name)
     {
        var owlXml = '<' + name;
        
        if (entity.hasAbbreviatedIRI)
        {
           owlXml += ' abbreviatedIRI="' + entity.IRI + '"';
        }
        else
        {
           owlXml += ' IRI="' + entity.IRI + '"';
        }
        
        owlXml += '/>';
        return owlXml;
     }
     
     /**
      * Returns OWL/XML representation for the given OWL class intersection expression.
      * 
      * @param expr Class intersection expression to return the OWL/XML representation for.
      * @returns OWL/XML representation for the given OWL class intersection expression.
      */
     function writeObjIntersectOfExpr(expr)
     {
        var owlXml = '<ObjectIntersectionOf>';
        var subExprs = expr.args;
        var subExprCount = subExprs.length;
        
        for (var subExprIndex = 0; subExprIndex < subExprCount; subExprIndex++)
        {
           owlXml += writeClassExpr(subExprs[subExprIndex]);
        }
        
        owlXml += '</ObjectIntersectionOf>';
        return owlXml;
     }
     
	  /**
      * Returns OWL/XML representation for the given OWL ObjectSomeValuesFrom expression.
      * 
      * @param expr ObjectSomeValuesFrom expression to return the OWL/XML representation for.
      * @returns OWL/XML representation for the given OWL ObjectSomeValuesFrom expression.
      */
     function writeSomeValuesFromExpr(expr)
     {
        var owlXml = '<ObjectSomeValuesFrom>';
        owlXml += writeEntity(expr.opropExpr, 'ObjectProperty');
        owlXml += writeClassExpr(expr.classExpr);
        owlXml += '</ObjectSomeValuesFrom>';
        return owlXml; 
	  }
     
	  /**
      * Returns OWL/XML representation for the given OWL class expression.
      * 
      * @param expr Class expression to return the OWL/XML representation for.
      * @returns OWL/XML representation for the given OWL class expression.
      */
     function writeClassExpr(expr)
     {
	     switch (expr.type)
	     {
	        case ET_CLASS:
             return writeEntity(expr, 'Class');
           break;
	        case CE_INTERSECT:
	          return writeObjIntersectOfExpr(expr);
           break;
           case CE_OBJ_VALUES_FROM:
             return writeSomeValuesFromExpr(expr);
           break;
           default: throw 'Uncrecognized class expression!';               
	     }
     }
     
     /**
      * Returns OWL/XML representation for the given OWL class axiom.
      * 
      * @param expr Class axiom to return the OWL/XML representation for.
      * @param name XML tag to use for the axiom.
      * @returns OWL/XML representation for the given OWL class axiom.
      */
     function writeClassAxiom(axiom, name)
     {
        var owlXml = '<' + name + '>';
        var axiomArgs = axiom.args;
        var axiomArgCount = axiomArgs.length;
        
	     for (var exprIndex = 0; exprIndex < axiomArgCount; exprIndex++)
        {
           owlXml += writeClassExpr(axiomArgs[exprIndex]);
        }
        
        owlXml += '</' + name + '>';
        return owlXml;
     }
     
	  /**
      * Returns OWL/XML representation for the given OWL ObjectPropertyChain expression.
      * 
      * @param expr OWL ObjectPropertyChain expression to return the OWL/XML representation for.
      * @returns OWL/XML representation for the given OWL ObjectPropertyChain expression.
      */
     function writeOpropChain(expr)
     {
        var owlXml = '<ObjectPropertyChain>';
        var args = expr.args;
        var argCount = args.length;
        
        for (var argIndex = 0; argIndex < argCount; argIndex++)
        {
           owlXml += writeEntity(args[argIndex], 'ObjectProperty');
        }
        
        owlXml += '</ObjectPropertyChain>';
        return owlXml;
     }
     
     /**
      * Returns OWL/XML representation for the given OWL SubObjectPropertyOf axiom.
      * 
      * @param expr OWL SubObjectPropertyOf axiom to return the OWL/XML representation for.
      * @returns OWL/XML representation for the given OWL SubObjectPropertyOf axiom.
      */
     function writeOpropSubAxiom(axiom)
     {
        var owlXml = '<SubObjectPropertyOf>';
        
        if (axiom.arg1.type == OPE_CHAIN)
        {
           owlXml += writeOpropChain(axiom.arg1);
        }
        else if (axiom.arg1.type == ET_OPROP)
        {
           owlXml += writeEntity(axiom.arg1, 'ObjectProperty');
        }
        else
        {
           throw 'Unknown type of the expression in the SubObjectPropertyOf axiom!';
        }
        
        owlXml += writeEntity(axiom.arg2, 'ObjectProperty');
        owlXml += '</SubObjectPropertyOf>';
        return owlXml;
     }
     
     var owlXml = '<Ontology>';
     var axioms = ontology.axioms;
     var axiomCount = axioms.length;
     
     for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
     {
        var axiom = axioms[axiomIndex];
        
        switch (axiom.type)
        {
           case AXIOM_CLASS_EQ:
              owlXml += writeClassAxiom(axiom, 'EquivalentClasses');
           break;
           case AXIOM_CLASS_SUB:
              owlXml += writeClassAxiom(axiom, 'SubClassOf');
           break;
           case AXIOM_OPROP_SUB:
              owlXml += writeOpropSubAxiom(axiom);
           break;
           default: throw 'Unknown type of the axiom!';
        }
     }
     
     owlXml += '</Ontology>';
     return owlXml;
  }
};

/**
 * An object which can be used to parse user SPARQL queries against the ontology.
 */
owl.sparql = 
{
   /**
    * Parses the given SPARQL string into the query. 
    * 
    * @param queryTxt SPARQL string to parse into the query.
    * @returns An object representing the query parsed.
    */
   parse: function(queryTxt)
   {
      if (!queryTxt)
      {
         throw 'The query text is not specified!';
      }
      
      var spacePos = queryTxt.indexOf(' is ');
      
      if (spacePos < 0 || spacePos == queryTxt.length - 1)
      {
         throw 'Wrong query format!';
      }
      
      var class1 = queryTxt.substring(0, spacePos);
      var class2 = queryTxt.substring(spacePos + 4);
      
      return new owl.Query(class1, class2);
   }
};

/**
 * An object representing a reasoner.
 */
owl.Reasoner = function(ontology) 
{  
   this.timeInfo = {};
   this.originalOntology = ontology;

   var clock = new Stopwatch();
   
   clock.start();
   var normalizedOntology = this.normalizeOntology(ontology);
   this.timeInfo.normalization = clock.stop(); 
   
   clock.start();
   var objectPropertySubsumers = this.buildObjectPropertySubsumerSets(normalizedOntology);
   this.timeInfo.objectPropertySubsumption = clock.stop();
   
   clock.start();
   this.classSubsumers = this.buildClassSubsumerSets(normalizedOntology, objectPropertySubsumers);
   this.timeInfo.classification = clock.stop();
   
   clock.start();
   this.aBox = this.rewriteAbox(normalizedOntology, objectPropertySubsumers);
   this.timeInfo.aBoxRewriting = clock.stop();
};

owl.Reasoner.prototype =
{
   /**
    * Creates an object which can be used to hash 2-tuples by the values in them in some order.
    * 
    * @returns Object which can be used to hash 2-tuples by the values in them in some order.
    */
   create2TupleStorage: function()
   {
      // Creating a container.
      var storage =
      {
         /**
          * Data structure holding all 2-tuples.
          */
         tuples: {},

         /**
          * Returns an object which can be used to access all 2-tuples in the storage with 
          * (optionally) the fixed value of the first element in all tuples.
          * 
          * @param first (optional) The value of the first element of all tuples to be returned.
          * @returns Object which can be used to access all 2-tuples in the storage.
          */
         get: function(first)
         {
            if (!first)
            {
               return this.tuples;
            }
            
            return (!this.tuples[first]) ? {} : this.tuples[first];
         },
   
         /**
          * Checks if the tuple with the given values exists within the storage.
          * 
          * @param first First value in the tuple.
          * @param second Second value in the tuple.
          * @returns True if the tuple with the given value exists, false otherwise.
          */
         exists: function(first, second)
         {
            var firstTuples = this.tuples[first];
            
            if (!firstTuples)
            {
               return false;
            }
            
            if (firstTuples[second])
            {
               return true;
            }
            else
            {
               return false;
            }
         },
         
         /**
          * Checks if tuples with the given first value and all of the given second values 
          * exist within the storage.
          * 
          * @param first First value in the tuple.
          * @param second Array containing the values for second element in the tuple. 
          * @returns True if the storage contains all the tuples, false otherwise.
          */
         existAll: function(first, second)
         {
            if (!second)
            {
               return true;
            }
            
            var secondTuples = this.tuples[first];
            
            if (!secondTuples) 
            {
               return false;
            }
            
            for (var secondValue in second)
            {         
               if (!secondTuples[secondValue])
               {
                  // Some entity from subsumers array is not a subsumer.
                  return false;
               }
            }
         
            return true;
         },
         
         /**
          * Adds a new tuple to the storage.
          *
          * @param first Value of the first element of the tuple.
          * @param second Value for the second element of the tuple.
          */
         add: function(first, second)
         {         
            if (!this.tuples[first])
            {
               this.tuples[first] = {};
            }
            
            this.tuples[first][second] = true;
         }
      }
      
      return storage;
   },
   
   /**
    * Creates an object which can be used to hash 3-tuples by the values in them in some order.
    * 
    * @returns Object which can be used to hash 3-tuples by the values in them in some order.
    */
   create3TupleStorage: function()
   {
      var storage = 
      {
         /**
          * Data structure holding all 3-tuples.
          */
         tuples: {},
         
         /**
          * Returns all tuples for a fixed value of the 1-st element in tuples and (optionally) 
          * the 2-nd one.
          *  
          * @param first Value of the first element of the returned tuples.
          * @param second (optional) Value of the second element of the returned tuples.
          * @returns Object containing the tuples requested.
          */
         get: function(first, second)
         {
            var firstTuples = this.tuples[first] || undefined;
            
            if (!firstTuples)
            {
               return {};
            }
            
            if (!second)
            {
               return firstTuples;
            }
            
            var secondTuples = firstTuples[second] || undefined;
            
            return (!secondTuples) ? {} : secondTuples;
         },
         
         /**
          * Adds the given 3-tuple to the storage.
          * 
          * @param first Value of the first element in the tuple.
          * @param second Value of the second element in the tuple.
          * @param third Value of the third element in the tuple.
          */
         add: function(first, second, third)
         {
            if (!this.tuples[first])
            {
               this.tuples[first] = {};
            }
            
            if (!this.tuples[first][second])
            {
               this.tuples[first][second] = {};
            }
            
            this.tuples[first][second][third] = true;
         },
         
         /**
          * Checks if the given tuple exists in the storage.
          * 
          * @param first Value of the first element in the tuple.
          * @param second Value of the second element in the tuple.
          * @param third Value of the third element in the tuple.
          * @returns True if the value exists, false otherwise.
          */
         exists: function(first, second, third)
         {
            if (!this.tuples[first])
            {
               return false;
            }
            
            if (!this.tuples[first][second])
            {
               return false;
            }
            
            if (!this.tuples[first][second][third])
            {
               return false;
            }
            
            return true;
         }
      };
      
      return storage;
   },
   
   /**
    * Builds an object property subsumption relation implied by the ontology.
    * 
    * @param ontology Normalized ontology to be use for building the subsumption relation. 
    * @returns 2-tuple storage hashing the object property subsumption relation implied by the 
    * ontology.
    */
   buildObjectPropertySubsumerSets: function(ontology)
   {
      var objectPropertySubsumers = this.create2TupleStorage();      
      
      for (var objectProperty in ontology.getObjectProperties())
      {
         // Every object property is a subsumer for itself.
         objectPropertySubsumers.add(objectProperty, objectProperty);
      }
      
      var axioms = ontology.axioms;
      var axiomCount = axioms.length;
      
      // Add object property subsumptions explicitly mentioned in the ontology.
      for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
      {
         var axiom = axioms[axiomIndex];
         
         if (axiom.type != AXIOM_OPROP_SUB || axiom.arg1.type != ET_OPROP)
         {
            continue;
         }
         
         objectPropertySubsumers.add(axiom.arg1.IRI, axiom.arg2.IRI);
      }
      
      var queue = new owl.Queue();
      
      for (var objectProperty in ontology.getObjectProperties())
      {
         for (var subsumer in objectPropertySubsumers.get(objectProperty))
         {
            queue.enqueue(subsumer);
         }
         
         // Discover implicit subsumptions via intermediate object properties.
         while (!queue.isEmpty())
         {
            var element = queue.dequeue();
            
            for (var subsumer in objectPropertySubsumers.get(element))
            {
               // If the objectProperty has subsumer added in its subsumer set, then that
               // subsumer either was processed already or has been added to the queue - no need
               // to process it for the second time.
               if (!objectPropertySubsumers.exists(objectProperty, subsumer))
               {
                  objectPropertySubsumers.add(objectProperty, subsumer);
                  queue.enqueue(subsumer);
               }
            }
         }
      }
      
      return objectPropertySubsumers;
   },
   
   /**
    * Builds a class subsumption relation implied by the ontology.
    * 
    * @param ontology Ontology to use for building subsumer sets. The ontology has to be normalized.
    * @param objectPropertySubsumers 2-tuple storage hashing the object property subsumption 
    * relation implied by the ontology. 
    * @returns 2-tuple storage containing the class subsumption relation implied by the ontology.
    */
   buildClassSubsumerSets: function(ontology, objectPropertySubsumers)
   {
      // Stores labels for each node.
      var classSubsumers = this.create2TupleStorage(); 
      
      // Stores labels for each edge.
      var edgeLabels = this.create3TupleStorage();
      
      // Provides quick access to axioms like r o s <= q.
      var chainSubsumers = this.buildChainSubsumerSets(ontology);
      var leftChainSubsumers = chainSubsumers.left;
      var rightChainSubsumers = chainSubsumers.right;
      
      var queues = {};
      var axioms = ontology.axioms;
      var axiomCount = axioms.length;
      
      /**
       * Represents an instruction to add the given label to the given node if (optionally) it has 
       * been already labeled with the specified labels.
       *
       * @param node IRI of the node to add the label to.
       * @param label IRI of the label to add if possible.
       * @param reqLabels Array of IRIs of all labels which need to exist in order to process the 
       * operation.
       */
      var LabelNodeInstruction = function(node, label, reqLabels)
      {
         /**
          * IRI of the node to add the label to.
          */
         this.node = node;
         
         /**
          * Array with IRIs of all labels which need to exist in order to process the operation.
          */
         this.reqLabels = reqLabels;
         
         /**
          * IRI of the label to add if possible.
          */
         this.newLabel = label;
      };
      
      LabelNodeInstruction.prototype =
      {
         /**
          * Processes the instruction.
          */
         process: function()
         {            
            if (!classSubsumers.existAll(this.node, this.reqLabels) || 
               classSubsumers.exists(this.node, this.newLabel))
            {
               // The node is not labeled with all required labels yet or it has been labeled with
               // the new label already - there is no point to process the operation anyway.
               return;
            }
         
            // Otherwise, add a label to the node. 
            classSubsumers.add(this.node, this.newLabel);
         
            // Since newLabel is a new discovered subsumer of node, all axioms about newLabel
            // apply to node as well - we need to update node instruction queue. 
            addLabelNodeIfInstructions(this.newLabel, this.node);
         
            // We have discovered a new information about node, so we need to update all other
            // nodes linked to it.
            for (var otherNode in classSubsumers.get())
            {
               for (var edgeLabel in edgeLabels.get(otherNode, this.node))
               {
                  // For all A <= E P.classIRI, we now know that A <= E P.newLabel. And therefore A 
                  // should have the same subsumers as E P.newLabel.
                  addLabelNodeInstructions(edgeLabel, this.newLabel, otherNode);
   	         }
            }
         }
      };
      
      /**
       * Represents an instruction to add given label to the edge between two given nodes.
       *
       * @param node1 IRI of the source node of the edge.
       * @param node2 IRI of the destination node of the edge.
       * @param label IRI of the label to add to the edge.
       */
      var LabelEdgeInstruction = function(node1, node2, label)
      {
         /**
          * IRI of te source node of the edge.
          */
         this.node1 = node1;
         
         /**
          * IRI of the destination node of the edge.
          */
         this.node2 = node2;
         
         /**
          * IRI of the label to add to the edge.
          */
         this.label = label;
      }
      
      LabelEdgeInstruction.prototype =
      {
         /**
          * Processes the instruction.
          */
         process: function()
         {      
            if (!edgeLabels.exists(this.node1, this.node2, this.label))
            {
               // If the edge has not been labeled yet, process it.
               this.processNewEdge(this.node1, this.label, this.node2);
            }
         },
         
         /**
          * Processes an instruction to label edge (node1, node2) with label.
          *
          * @param node1 IRI of the source node of the edge.
          * @param label IRI to add as a label of the edge.
          * @param node2 IRI of the destination node of the edge.
          */
         processNewEdge: function(node1, label, node2)
         {            
            // For all subsumers of object property P, including P itself.
            for (var q in objectPropertySubsumers.get(label))
            {  
               // Add q as a label between node1 and node2.
               edgeLabels.add(node1, node2, q);
         
               // Since we discovered that A <= E Q.B, we know that A <= E Q.C, where C is any subsumer
               // of B. We therefore need to look for new subsumers D of A by checking all axioms like 
               // form E Q.C <= D.
               for (var c in classSubsumers.get(node2))
   	         {
                  addLabelNodeInstructions(q, c, node1);
   	         }
               
               // We want to take care of object property chains. We now know that Q: A -> B.
               // If there is another property R: C -> A for some class C and property 
               // S: C -> B, such that R o Q <= S, we want to label edge (C, B) with S.
               for (var r in rightChainSubsumers.get(q))
               {
                  for (var s in rightChainSubsumers.get(q, r))
                  {
                     for (var c in classSubsumers.get()) 
                     {
                        if (edgeLabels.exists(c, node1, r) && !edgeLabels.exists(c, node2, s))
                        {
                           processNewEdge(c, s, node2);               
                        }
                     }
                  }
               }
            
               // We want to take care of object property chains. We now know that Q: A -> B.
               // If there is another property R: B -> C for some class C and property 
               // S: A -> C, such that Q o R <= S, we want to label edge (A, C) with S.
               for (var r in leftChainSubsumers.get(q))
               {
                  for (var s in leftChainSubsumers.get(q, r))
                  {
                     for (var c in classSubsumers.get()) 
                     {
                        if (edgeLabels.exists(node2, c, r) && !edgeLabels.exists(node1, c, s))
                        {
                           processNewEdge(node1, s, node2);               
                        }
                     }
                  }
               }
            }
         }
      };
            
      /**
       * Checks if the given axiom is in the form
       * 
       * A1 n A2 n ... n A n ... n An <= C, n >= 0
       * 
       * where A is the given class and Ai, C are atomic classes. 
       * 
       * @param axiom Axiom to check.
       * @param classIRI Class to look for in the left part of the axiom.
       * @returns True if the axiom is in the required form, false otherwise.  
       */
      function canUseForLabelNodeInstruction(axiom, classIRI)
      {
         if (!axiom.args)
         {
            return false; 
         }
         
         var firstArg = axiom.args[0] || undefined;
         var secondArg = axiom.args[1] || undefined;
         
         if (axiom.type != AXIOM_CLASS_SUB || !firstArg || !secondArg || secondArg.type != ET_CLASS)
   	   {
   	      return false;
   	   }
         
         if (firstArg.type == ET_CLASS && firstArg.IRI == classIRI)
         {
            return true;
         }
         else if (firstArg.type != CE_INTERSECT)
         {
            return false;
         }
         
         var classes = firstArg.args;
   	   var classCount = classes.length;
         
         for (var classIndex = 0; classIndex < classCount; classIndex++)
   	   {
   	      if (classes[classIndex].IRI == classIRI)
   	      {
               return true;
   	      }
   	   }
         
         return false;
      }
      
      /**
       * Adds instructions 
       * 
       * 'Label classIRI2 as A if it is labeled A1, A2, ..., Am already' 
       * 
       * to the queue of classIRI2 for all axioms like
       * 
       * A1 n A2 n ... n classIRI1 n ... n Am <= A.
       * 
       * @param classIRI1 IRI of the class to look for in the left part of axioms.
       * @param classIRI2 IRI of the class to add instructions to.
       */
      function addLabelNodeIfInstructions(classIRI1, classIRI2)
      {
         for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
         {
            var axiom = axioms[axiomIndex];
   
            if (!canUseForLabelNodeInstruction(axiom, classIRI1))
            {
               continue;
            }
            
            var reqLabels = undefined;
            var firstArg = axiom.args[0]; 
            
            if (firstArg.type == CE_INTERSECT) 
            {
               reqLabels = {};
               var classes = axiom.args[0].args;
               var classCount = classes.length;
               
               for (var classIndex = 0; classIndex < classCount; classIndex++)
               {
                  var classIRI = classes[classIndex].IRI;
                  
                  if (classIRI != classIRI1) 
                  {
                     reqLabels[classIRI] = 1;
                  }
               }
            }
            
            var instruction = new LabelNodeInstruction(classIRI2, axiom.args[1].IRI, reqLabels);
            queues[classIRI2].enqueue(instruction);
         }
      }
      
      /**
       * Adds instructions 
       * 
       * 'Label classIRI2 with C' 
       * 
       * to the queue of classIRI2 for all axioms like
       * 
       * E P.classIRI1 <= C.
       * 
       * @param classIRI1 IRI of the class to look for in the left part of axioms.
       * @param classIRI2 IRI of the class to add instructions to.
       */
      function addLabelNodeInstructions(opropIRI, classIRI1, classIRI2)
      {
         for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
         {
            var axiom = axioms[axiomIndex];
            
            if (axiom.type != AXIOM_CLASS_SUB)
            {
               continue;
            }
            
            var firstArg = axiom.args[0] || undefined;
         
            if (!firstArg || firstArg.type != CE_OBJ_VALUES_FROM || 
               firstArg.opropExpr.type != ET_OPROP || firstArg.opropExpr.IRI != opropIRI ||
               firstArg.classExpr.type != ET_CLASS || firstArg.classExpr.IRI != classIRI1)
            {
               continue;
            }
            
            var instruction = new LabelNodeInstruction(classIRI2, axiom.args[1].IRI);
            queues[classIRI2].enqueue(instruction);
         }
      }
      
      /**
       * Adds instructions 
       * 
       * 'Label the edge (classIRI2, C) as P' 
       * 
       * to the queue of classIRI2 for all axioms like
       * 
       * classIRI1 <= E P.C.
       * 
       * @param classIRI1 IRI of the class to look for in the left part of axioms.
       * @param classIRI2 IRI of the class to add instructions to.
       */
      function addLabelEdgeInstructions(classIRI1, classIRI2)
      {
         for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
         {
            var axiom = axioms[axiomIndex];
            
            if (!axiom.args)
            {
               continue;
            }
            
            var firstArg = axiom.args[0] || undefined;
            var secondArg = axiom.args[1] || undefined;
         
            if (axiom.type != AXIOM_CLASS_SUB ||
               !firstArg || firstArg.type != ET_CLASS || firstArg.IRI != classIRI1 || 
               !secondArg || secondArg.type != CE_OBJ_VALUES_FROM)
            {
               continue;
            }
            
            var instruction = 
               new LabelEdgeInstruction(classIRI2, secondArg.classExpr.IRI, secondArg.opropExpr.IRI);
            queues[classIRI2].enqueue(instruction);
         }
      }
      
      /**
       * Adds instructions to the queue of classIRI2 for some axioms involving classIRI1.
       * 
       * @param classIRI1 IRI of the class to look for in axioms.
       * @param classIRI2 IRI of the class to add instructions for.
       */
      function addInstructions(classIRI1, classIRI2)
      {
         addLabelNodeIfInstructions(classIRI1, classIRI2);
         addLabelEdgeInstructions(classIRI1, classIRI2);
      }
      
      /**
       * Initialises a single node of the graph before the subsumption algorithm is run.
       *
       * @param classIRI IRI of the class to initialize a node for.
       */
      function initialiseNode(classIRI)
      {
         // Every class is a subsumer for itself.
         classSubsumers.add(classIRI, classIRI);
         
         // Initialise an instruction queue for the node.
         queues[classIRI] = new owl.Queue();
         
         // Add any initial instructions about the class to the queue.
         addInstructions(classIRI, classIRI);
      }
      
      /**
       * Initialises data structures before the subsumption algorithm is run.
       */
      function initialise()
      {
         // Create a node for Thing (superclass).
         initialiseNode(THING);
         
         var classes = ontology.getClasses();
         
         for (var classIRI in classes)
         {
            // Create a node for each class in the Ontology.
            initialiseNode(classIRI);
            
            // Mark Thing as a subsumer of the class.
            classSubsumers.add(classIRI, THING);   
   
            // All axioms about Thing should also be true for any class.
            addInstructions(THING, classIRI)
         }
      }
      
      // Initialise queues and labels.
      initialise();
      
      var someInstructionFound = false;
      
      do
      { 
         someInstructionFound = false;
         
         // Get a queue which is not empty.
         for (var node in queues)
         {
            var queue = queues[node];
            
            if (!queue.isEmpty())
            {
               // Process the oldest instruction in the queue.
               var instruction = queue.dequeue();
               instruction.process();
               someInstructionFound = true;
               break;
            }
         }
      }
      while (someInstructionFound);
      
      return classSubsumers;
   },

   /**
    * Creates an object which hashes axioms like r o s <= q, so that all axioms related to 
    * either q or s can be obtained efficiently.
    * 
    * @param ontology Normalized ontology containing the axioms to hash.
    * @returns Object hashing all object property chain subsumptions.
    */
   buildChainSubsumerSets: function(ontology)
   {
      var axioms = ontology.axioms;
      var axiomCount = axioms.length;
      
      var leftSubsumers = this.create3TupleStorage();
      var rightSubsumers = this.create3TupleStorage();
      
      for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
	   {
	      var axiom = ontology.axioms[axiomIndex];
               
	      if (axiom.type != AXIOM_OPROP_SUB || axiom.arg1.type != OPE_CHAIN)
	      {
	         continue;
	      }
               
	      var leftObjectProperty = axiom.arg1[0].IRI;
	      var rightObjectProperty = axiom.arg1[1].IRI;
	      var chainSubsumer = axiom.arg2.IRI;
         
         leftSubsumers.add(leftObjectProperty, rightObjectProperty, chainSubsumer);
         rightSubsumers.add(rightObjectProperty, leftObjectProperty, chainSubsumer);
      }
      
      var chainSubsumers =
      {
         left: leftSubsumers,
         right: rightSubsumers
      }
      
      return chainSubsumers;
   },

   /**
    * Rewrites an ABox of the ontology into the relational database to use it for conjunctive query 
    * answering. 
    * 
    * @param ontology Normalized ontology containing the ABox to rewrite.
    * @param objectPropertySubsumers 2-tuple storage hashing the object property subsumption 
    * relation implied by the ontology.
    * @returns An object containing the rewritten ABox.
    */
   rewriteAbox: function(ontology, objectPropertySubsumers)
   {
      var axioms = ontology.axioms;
      var axiomCount = axioms.length;
      var reasoner = this;
      var originalOntology = this.originalOntology;
      
      /**
       * Puts class assertions implied by the ontology into the database.
       * 
       * @returns Array containing all class assertions implied by the ontology. 
       */
      function rewriteClassAssertions()
      {
         // Indexes each individual to the classes it has been labeled with.
         var individualClasses = {};
         var subsumerSets = reasoner.classSubsumers; 
         
         for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
         {
            var axiom = axioms[axiomIndex];
         
            if (axiom.type != FACT_CLASS) 
            {
               continue;
            }
            
            var individualIRI = axiom.individual.IRI;
            var classIRI = axiom.classExpr.IRI;
            var alreadyAdded = individualClasses[individualIRI] || undefined;
            
            if (!alreadyAdded)
	         {
	            alreadyAdded = {};
	            individualClasses[individualIRI] = alreadyAdded;
	         }
            
            for (var subsumerIRI in subsumerSets.get(classIRI)) 
            {
               if (!originalOntology.containsClass(subsumerIRI)) 
               {
                  continue;
               }
               
               alreadyAdded[subsumerIRI] = true;
            }
         }
         
         var assertions = [];
         
         // Put class assertions into the database.
         for (var individual in individualClasses)
         {
            for (var className in individualClasses[individual])
            {
               assertions.push(
               {
                  individual: individualIRI,
                  className: classIRI
               });
            }
         }
         
         return assertions;
      }
      
      /**
       * Puts role assertions implied by the ontology into the database.
       */
      function rewriteObjectPropertyAssertions()
      {
         var subsumers = reasoner.objectPropertySubsumers;
         var storage = reasoner.create3TupleStorage();
         
         for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
         {
            var axiom = axioms[axiomIndex];
            var statement = null;
         
            if (axiom.type != FACT_OPROP) 
            {
               continue;
            }
            
            var leftIndividualIRI = axiom.leftIndividual.IRI;
            var rightIndividualIRI = axiom.rightIndividual.IRI;
            var objectPropertyIRI = axiom.objectProperty.IRI;
            
            for (var subsumerIRI in subsumers.get(objectPropertyIRI)) 
            {
               storage.add(subsumerIRI, leftIndividualIRI, rightIndividualIRI);
            }
         }
         
         var changesHappened;
         
         do
         {
            changesHappened = false;
            
            for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
            {
               var axiom = ontology.axioms[axiomIndex];
               
               if (axiom.type != AXIOM_OPROP_SUB || axiom.arg1.type != OPE_CHAIN)
               {
                  continue;
               }
               
               var leftObjectProperty = axiom.arg1[0].IRI;
               var rightObjectProperty = axiom.arg1[1].IRI;
               var chainSubsumer = axiom.arg2.IRI;
               
               for (var leftIndividual in storage.get(leftObjectProperty))
               {
                  for (var rightIndividual1 in storage.get(leftObjectProperty, leftIndividual))
                  {
                     var rightIndividuals2 = storage.get(rightObjectProperty, rightIndividual1);
                           
                     for (var rightIndividual2 in rightIndividuals2)
                     {
	                     if (!storage.exists(chainSubsumer, leftIndividual, rightIndividual2))
	                     {
	                        storage.add(chainSubsumer, leftIndividual, rightIndividual);
	                        changesHappened = true;
	                     }
                     }
	               }
	            }
            }
         } 
         while (changesHappened);
         
         var assertions = [];
         
         // Put object property assertions into the database.
         for (var objectProperty in storage)
         {
            if (!originalOntology.containsObjectProperty(objectProperty))
            {
               continue;
            }
            
            for (var leftIndividual in storage.get(objectProperty))
            {
               for (var rightIndividual in storage.get(objectProperty, leftIndividual))
               {
                  assertions.push(
                  {
                     'objectProperty': objectProperty,
                     'leftIndividual': leftIndividual,
                     'rightIndividual': rightIndividual
                  });
               }
            }
         }
         
         return assertions;
      }
      
      var tableData = 
	   {
	      ClassAssertion: rewriteClassAssertions(),
	      ObjectPropertyAssertion: rewriteObjectPropertyAssertions()
	   };
      
      return tableData;
   },

   /**
    * Checks if the given class is the subclass of another class.
    *
    * @param classIRI1 IRI of one class.
    * @param classIRI2 IRI of another class.
    * @returns True if classIRI1 is a subclass of classIRI2, false otherwise. 
    */
   isSubclass: function(class1, class2)
   {
      var classes = this.originalOntology.getClasses();
      
      if (!classes[class1])
      {
         throw 'The ontology does not contain a class \'' + class1 + '\'';
      }
      
      if (!classes[class2])
      {
         throw 'The ontology does not contain a class \'' + class2 + '\'';
      }
      
      return this.classSubsumers.exists(class1, class2);
   },
   
   /**
    * Answers the given user query. 
    * 
    * @param query An object representing a query to be answered.
    * @returns True if the ontology satisfies the query, false otherwise.
    */
   answerQuery: function(query)
   {
      if (!query)
      {
         throw 'The query is not specified!'; 
      }
      
      if (!query.class1 || !query.class2 || query.class1.length == 0 || query.class2.length == 0)
      {
         throw 'The query is in the wrong format!';
      }
      
      return this.isSubclass(query.class1, query.class2);
   },
   
   /**
    * Normalizes the given ontology.
    * 
    * @returns New ontology which is a normalized version of the given one.
    */
   normalizeOntology: function(ontology)
   {  
      var entities = ontology.entities;
      var resultOntology = new owl.Ontology();
      
      for (var entityType in entities)
      {
         var entitiesOfType = entities[entityType];
         
         for (var entityIRI in entities[entityType])
         {
            resultOntology.entities[entityType][entityIRI] = entitiesOfType[entityIRI];
         }
      }
      
      var rules = [
      /**
       * Checks if the given axiom is in the form P1 o P2 o ... o Pn <=  P, where Pi and P are 
       * object property expressions. If this is the case, transforms it into the set of 
       * equivalent axioms
       *  
       *  P1 o P2 <= U1
       *  U1 o P3 <= U2
       *  ...
       *  Un-2 o Pn <= P,
       * 
       * where Ui are the new object properties introduced.
       * 
       * @param axiom Axiom to apply the rule to.
       * @returns Set of axioms which are result of applying the rule to the given axiom or
       * undefined if the rule could not be applied.
       */
      function(axiom)
      {
         if (axiom.type != AXIOM_OPROP_SUB || 
            axiom.arg1.type != OPE_CHAIN || 
            axiom.arg1.args.length <= 2)
         {
            return undefined;
         }
       
         var srcChain = axiom.arg1.args; 
         var prevOprop = resultOntology.createEntity(ET_OPROP); 
         
         var normalized = [
         {
            type: AXIOM_OPROP_SUB,
            arg1:
            {
               type: OPE_CHAIN,
               args: [srcChain[0], srcChain[1]]
            },
            arg2: prevOprop 
         }];
         
         var lastOpropIndex = srcChain.length - 1;
         
         for (var opropIndex = 2; opropIndex < lastOpropIndex; opropIndex++)
         {
            var newOprop = resultOntology.createEntity(ET_OPROP);
            
            normalized.push(
            {
               type: AXIOM_OPROP_SUB,
               arg1:
               {
                  type: OPE_CHAIN,
                  args: [prevOprop, srcChain[opropIndex]]
               },
               arg2: newOprop
            });
            
            prevOprop = newOprop;
         }
         
         normalized.push(
         {
               type: AXIOM_OPROP_SUB,
               arg1:
               {
                  type: OPE_CHAIN,
                  args: [prevOprop, srcChain[lastOpropIndex]]
               },
               arg2: axiom.arg2
	      });
         
         return normalized;
      },
      
      /**
       * Checks if the given axiom is in the form A1 = A2 = ... = An, where Ai are class 
       * expressions. If this is the case, transforms it into the set of equivalent axioms
       *  
       *  A1 <= A2 A1 <= A3 ... A1 <= An
       *  A2 <= A1 A2 <= A3 ... A2 <= An
       *  ...
       *  An <= A1 An <= A2 ... An <= An-1
       * .
       * 
       * @param axiom Axiom to apply the rule to.
       * @returns Set of axioms which are result of applying the rule to the given axiom or
       * undefined if the rule could not be applied.
       */
      function(axiom)
      {
         if (axiom.type != AXIOM_CLASS_EQ)
         {
            return undefined;
         }
         
         var normalized = [];
         var classExprs = axiom.args;
         var classExprCount = classExprs.length;
         
         for (var classExpr1Index = 0; classExpr1Index < classExprCount; classExpr1Index++)
         {
            for (var classExpr2Index = 0; classExpr2Index < classExprCount; classExpr2Index++)
            {
               if (classExpr1Index == classExpr2Index)
               {
                  continue;
               }
               
               normalized.push(
               {
                  type: AXIOM_CLASS_SUB,
                  args: [classExprs[classExpr1Index], classExprs[classExpr2Index]]
               });
            }
         }
         
         return normalized;
      },
      
      /**
       * Checks if the given axiom is in the form A <= A1 n A2 n ... An., where A and Ai are class
       * expressions. If this is the case, transforms it into the set of equivalent axioms
       *  
       *  A <= A1
       *  A <= A2
       *  ...
       *  A <= An
       * .
       * 
       * @param axiom Axiom to apply the rule to.
       * @returns Set of axioms which are result of applying the rule to the given axiom or
       * undefined if the rule could not be applied.
       */
      function(axiom)
      {
         if (axiom.type != AXIOM_CLASS_SUB || axiom.args[1].type != CE_INTERSECT)
         {
            return undefined;
         }
       
	      var normalized = [];
         var firstArg = axiom.args[0];
         var secondArg = axiom.args[1];
         
         var args = secondArg.args;
         var argCount = args.length;
         
         for (var exprIndex = 0; exprIndex < argCount; exprIndex++)
	      {
	         normalized.push(
	         {
	            type: AXIOM_CLASS_SUB,
	            args: [firstArg, args[exprIndex]]
	         });
	      }
         
         return normalized;
      },
      
      /**
       * Checks if the given axiom is in the form C <= D, where C and D are complex class 
       * expressions. If this is the case, transforms the axiom into two equivalent axioms
       *  
       *  C <= A
       *  A <= D
       * 
       * where A is a new atomic class introduced.
       * 
       * @param axiom Axiom to apply the rule to.
       * @returns Set of axioms which are result of applying the rule to the given axiom or
       * undefined if the rule could not be applied.
       */
      function(axiom)
      {
         if (axiom.type != AXIOM_CLASS_SUB || 
            axiom.args[0].type == ET_CLASS || 
            axiom.args[1].type == ET_CLASS)
         {
            return undefined;
         }
       
	      var firstArg = axiom.args[0];
         var secondArg = axiom.args[1];
         
	      var newClassExpr = resultOntology.createEntity(ET_CLASS);
         var normalized = [     
	      {
	         type: AXIOM_CLASS_SUB,
	         args: [firstArg, newClassExpr]
	      },
	      {
	         type: AXIOM_CLASS_SUB,
	         args: [newClassExpr, secondArg]
	      }];
         
         return normalized;
      },
      
      /**
       * Checks if the given axiom is in the form C1 n C2 n ... Cn <= C, where some Ci are complex 
       * class expressions. If this is the case converts the axiom into the set of equivalent axioms
       * 
       * Ai <= Ci
       * ..
       * C1 n ... n Ai n ... Cn <= C
       * 
       * where Ai are new atomic classes introduced to substitute complex class expressions Ci 
       * in the original axiom.
       * 
       * @param axiom Axiom to try to apply the rule to.
       * @returns Set of axioms which are result of applying the rule to the given axiom or
       * undefined if the rule could not be applied.
       */
      function(axiom)
      {
	      if (axiom.type != AXIOM_CLASS_SUB || axiom.args[0].type != CE_INTERSECT)
         {
            return undefined;
         }
         
         var normalized = [];
	      var firstArg = axiom.args[0];
	      var secondArg = axiom.args[1];
         
         var ruleApplied = false;
         
         var newIntersectExpr =
	      {
	         type: CE_INTERSECT,
	         args: []
	      };
         
         var args = firstArg.args;
         var argCount = args.length;
         
         for (var argIndex = 0; argIndex < argCount; argIndex++)
	      {
            var classExpr = args[argIndex];
            
	         if (classExpr.type != ET_CLASS)
	         {
	            ruleApplied = true;
	            var newClassExpr = resultOntology.createEntity(ET_CLASS);
                     
	            normalized.push(
	            {
	               type: AXIOM_CLASS_SUB,
	               args: [newClassExpr, classExpr]
	            });
                     
	            newIntersectExpr.args.push(newClassExpr);
	         }
	         else
	         {
	            newIntersectExpr.args.push(classExpr);
	         }
	      }
               
	      if (ruleApplied)
	      {
	         normalized.push(
	         {
	            type: AXIOM_CLASS_SUB,
	            args: [newIntersectExpr, secondArg]
	         });
            
            return normalized;
	      }
         else
         {
            return undefined;
         }
      },
      
      /**
       * Checks if the given axiom is in the form E P.A <= B, where A is a complex class 
       * expression. If this is the case converts the axiom into two equivalent axioms
       * A1 <= A and E P.A1 <= B, where A1 is a new atomic class.
       * 
       * @param axiom Axiom to try to apply the rule to.
       * @returns Set of axioms which are result of applying the rule to the given axiom or
       * undefined if the rule could not be applied.
       */
      function(axiom)
      {         
         if (axiom.type != AXIOM_CLASS_SUB || 
            axiom.args[0].type != CE_OBJ_VALUES_FROM || 
            axiom.args[0].classExpr.type == ET_CLASS)
         {
            return undefined;
         }

         var firstArg = axiom.args[0];
         var secondArg = axiom.args[1];
         
         var newClassExpr = resultOntology.createEntity(ET_CLASS);
            
         var newObjSomeValuesExpr = 
	      {
	         type: CE_OBJ_VALUES_FROM,
	         opropExpr: firstArg.opropExpr,
	         classExpr: newClassExpr
	      }

         var normalized = [
	      {
	         type: AXIOM_CLASS_SUB,
	         args: [firstArg.classExpr, newClassExpr]
	      }, 
	      {
	         type: AXIOM_CLASS_SUB,
	         args: [newObjSomeValuesExpr, secondArg]
	      }];
         
         return normalized;
      },
      
      /**
       * Checks if the given axiom is in the form A <= E P.B, where B is a complex class 
       * expression. If this is the case converts the axiom into two equivalent axioms
       * B1 <= B and A <= E P.B1, where B1 is a new atomic class.
       * 
       * @param axiom Axiom to try to apply the rule to.
       * @returns Set of axioms which are result of applying the rule to the given axiom or
       * undefined if the rule could not be applied.
       */
      function(axiom)
      {                  
         if (axiom.type != AXIOM_CLASS_SUB ||
            axiom.args[1].type != CE_OBJ_VALUES_FROM || 
            axiom.args[1].classExpr.type == ET_CLASS)
         {
            return undefined;
         }
         
         var firstArg = axiom.args[0];
	      var secondArg = axiom.args[1];
         
         var newClassExpr = resultOntology.createEntity(ET_CLASS);
            
	      var newObjSomeValuesExpr = 
	      {
	         type: CE_OBJ_VALUES_FROM,
	         opropExpr: secondArg.opropExpr,
	         classExpr: newClassExpr
	      }
        
         var normalized = [    
	      {
	         type: AXIOM_CLASS_SUB,
	         args: [secondArg.classExpr, newClassExpr]
	      },
	      {
	         type: AXIOM_CLASS_SUB,
	         args: [firstArg, newObjSomeValuesExpr]
	      }];
         
         return normalized;
      },
      
      /**
       * Checks if the given statement is in the form a <= A, where a is individual and A is a 
       * complex class expression. If this is the case converts the statement into two equivalent
       * statements a <= B and B <= A, where B is a new atomic class.
       * 
       * @param statement Statement to try to apply the rule to.
       * @returns Set of statements which are result of applying the rule to the given statement 
       * or undefined if the rule could not be applied.
       */
      function(statement)
      {
         if (statement.type != FACT_CLASS || statement.classExpr.type == ET_CLASS)
         {
            return undefined;
         }
         
         var newClass = resultOntology.createEntity(ET_CLASS);
         
         var normalized = [
         {
            type: AXIOM_CLASS_SUB,
            args: [newClass, statement.classExpr]
         },
         {
            type: FACT_CLASS,
            individual: statement.individual,
            classExpr: newClass
         }];
         
         return normalized;
      }];
      
      var queue = new owl.Queue();
      var axioms = ontology.axioms;
      var axiomCount = axioms.length;
      
      for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++) 
      {
         queue.enqueue(axioms[axiomIndex]);
      }
      
      var ruleCount = rules.length;
      
      while (!queue.isEmpty()) 
      {
         var axiom = queue.dequeue();
         var ruleIndex = 1;
         
         // Trying to find a rule to apply to the axiom.
         for (ruleIndex = 0; ruleIndex < ruleCount; ruleIndex++)
         {
            var resultAxioms = rules[ruleIndex](axiom);
            
            if (resultAxioms)
            {
               var resultAxiomCount = resultAxioms.length; 
               
               // If applying the rule succeeded.
               for (var axiomIndex = 0; axiomIndex < resultAxiomCount; axiomIndex++)
               {
                  queue.enqueue(resultAxioms[axiomIndex]);
               }
               
               break;
            }
         }
         
         if (ruleIndex == ruleCount)
         {
            // If nothing can be done to the axiom, it is returned unchanged by all rule 
            // functions and the axiom is in one of the normal forms already. 
            resultOntology.axioms.push(axiom);            
         }
      }
      
      return resultOntology;
   } 
};


/**
 * Queries are accepted by the reasoner to answer the user 'questions' about the ontology.
 *  
 * @param class1 IRI of the class to be checked for being a subsumee of class2.
 * @param class2 IRI of the class to be checked for being a subsumer of class1.
 */
owl.Query = function(class1, class2)
{
   /**
    * Class to be checked for being a subsumee of class2.
    */
   this.class1 = class1;
   
   /**
    * Class to be checked for being a subsumer of class1.
    */
   this.class2 = class2;
}

/**
 * Onotlogy represents a set of statements about some world.
 */
owl.Ontology  = function()
{	
   /**
    * The sets of entities of different types found in the ontology.
    */
   this.entities = {};
   this.entities[ET_OPROP] = {};
   this.entities[ET_CLASS] = {};
   this.entities[ET_INDIVIDUAL] = {};
   
   /**
    * Contains all axioms in the ontology.
    */
   this.axioms = [];
   
   // Contains the numbers to be used in IRIs of next auto-generated entities.
   this.nextEntityNos = {};
   this.nextEntityNos[ET_OPROP] = 1;
   this.nextEntityNos[ET_CLASS] = 1;
   this.nextEntityNos[ET_INDIVIDUAL] = 1;    
   
   // Contains number of entities of each type in the ontology.
   this.entityCount = {};
   this.entityCount[ET_OPROP] = 0;
   this.entityCount[ET_CLASS] = 0;
   this.entityCount[ET_INDIVIDUAL] = 0;
};

owl.Ontology.prototype = 
{
   /**
    * Allows generating a new unique IRI for the entity of the given type.
    * 
    * @param type Type of the entity to generate a new unique IRI for.
    * @returns New unique IRI.
    */
   createNewIRI: function(type)
   {
      var entityPrefix = ENTITY_AUTO_PREFIXES[type];
      var nextEntityNo = this.nextEntityNos[type];
      
	   if (!entityPrefix || !nextEntityNo)
	   {
	      throw 'Unrecognized entity type!';
	   }
      
      var entities = this.entities[type];
	   var IRI = '';
         
	   do
	   {
	      IRI = entityPrefix + nextEntityNo;
	      nextEntityNo++;
	   }
	   while (entities[IRI]);
         
	   this.nextEntityNos[type] = nextEntityNo;
	   return IRI; 
	},
   
   /**
    * Creates a new entity of the given type with automatically generated IRI.
    * 
    * @param type Type of the entity to create.
    * @param (optional) IRI IRI of the new entity. If not given, generates a new IRI.
    * @param isAbbrIRI (optional) True if the given IRI is an abbreviated one, false otherwise. 
    * False by default.
    * @returns The new entity of the given type with the name automatically generated.
    */
   createEntity: function(type, IRI, isAbbrIRI)
   {
      if (!IRI)
      {
         IRI = this.createNewIRI(type);
      }
      else
      {
         if (this.entities[type][IRI])
         {
            return this.entities[type][IRI];
         }
      }
         
      var entity = 
	   {
	      'type': type,
	      'IRI': IRI,
	      'hasAbbreviatedIRI': (isAbbrIRI) ? true : false
	   }
      
      this.entities[type][IRI] = entity;
      this.entityCount[type]++;
      return entity;
   },
   
   /**
    * Checks if the ontology contains any references to the class with the given IRI.
    * 
    * @param classIRI IRI of the class to check.
    * @returns True if the ontology has reverences to the class, false otherwise.
    */
   containsClass: function(classIRI)
   {
      if (this.entities[ET_CLASS][classIRI])
      {
         return true;
      }
      else
      {
         return false;
      }
   },
   
   /**
    * Checks if the ontology contains any references to the object property with the given IRI.
    * 
    * @param objectPropertyIRI IRI of the object property to check.
    * @returns True if the ontology has reverences to the object property, false otherwise.
    */
   containsObjectProperty: function(objectPropertyIRI)
   {
      if (this.entities[ET_OPROP][objectPropertyIRI])
      {
         return true;
      }
      else
      {
         return false;
      }
   },   
   
   /**
    * Returns number of classes in the ontology.
    * 
    * @returns Number of classes in the ontology.
    */
   getClassCount: function()
   {
      return this.entityCount[ET_CLASS];
   },
   
   /**
    * Returns an 'associative array' of all classes in the ontology.
    * 
    * @returns 'Associative array' of all classes in the ontology.
    */
   getClasses: function()
   {
      return this.entities[ET_CLASS];
   },
   
   /**
    * Returns number of object properties in the ontology.
    * 
    * @returns Number of object properties in the ontology.
    */
   getObjectPropertyCount: function()
   {
      return this.entityCount[ET_OPROP];
   },
   
   /**
    * Returns an 'associative array' of all object properties in the ontology.
    * 
    * @returns 'Associative array' of all object properties in the ontology.
    */
   getObjectProperties: function()
   {
      return this.entities[ET_OPROP];
   },
   
   /**
    * Returns number of individuals in the ontology.
    * 
    * @returns Number of individuals in the ontology.
    */
   getIndividualCount: function()
   {
     return this.entityCount[ET_INDIVIDUAL]; 
   },

   /**
    * Returns an 'associative array' of all individuals in the ontology.
    * 
    * @returns 'Associative array' of all individuals in the ontology.
    */
   getIndividuals: function()
   {
      return this.entities[ET_INDIVIDUAL];
   }, 
   
   /**
    * Returns the number of axioms of the given types (optionally) in the ontology.
    *
    * @param types (optional) Array containing types of axioms to count. If the argument is not 
    * provided, the total number of axioms is returned.
    * @returns Number of axioms of the given types in the ontology.
    */
   getSize: function(types)
   {
      if (!types)
      {
         return this.axioms.length;
      }
      
      var axioms = this.axioms;
      var axiomCount = axioms.length;
      var typeCount = types.length;
      var size = 0;
      
      for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
      {
         var axiom = axioms[axiomIndex];
         
         for (var typeIndex = 0; typeIndex < typeCount; typeIndex++)
         {
            if (axiom.type == types[typeIndex])
            {
               size++;
               break;
            }
         }
      }
      
      return size;
   },

   /**
    * Returns the size of ABox of the ontology.
    * 
    * @returns Size of the ABox of the ontology.
    */
   getAboxSize: function()
   {
      return this.getSize([FACT_CLASS, FACT_OPROP]);
   },
   
   /**
    * Returns the size of TBox of the ontology.
    * 
    * @returns Size of the TBox of the ontology.
    */
   getTboxSize: function()
   {
      return this.getSize([AXIOM_CLASS_EQ, AXIOM_CLASS_SUB, AXIOM_OPROP_SUB]);
   },

   /**
    * Returns the size of RBox of the ontology.
    * 
    * @returns Size of the RBox of the ontology.
    */   
   getRboxSize: function()
   {
      return this.getSize([AXIOM_OPROP_SUB]);
   }
};

/**
 * Queue implementing FIFO mechanism. 
 */
owl.Queue = function()
{
   this.queue = [];
   this.emptyElements = 0;
};

owl.Queue.prototype =
{
   /**
    * Checks if the queue has no objects.
    * 
    * @return True if there are no objects in the queue, fale otherwise.
    */
   isEmpty: function() 
   { 
      return this.queue.length == 0; 
   },
   
   /**
    * Adds an object to the queue.
    * 
    * @param obj Object to add to the queue.
    */
   enqueue: function(obj)
   {
      this.queue.push(obj);
   },
   
   /**
    * Removes the oldest object from the queue and returns it.
    * 
    * @returns The oldest object in the queue.
    */
   dequeue: function()
   {
      if (this.isEmpty())
      {
         return undefined;
      }
      
      var element = this.queue[this.emptyElements];
      this.emptyElements++;
      
      if (this.emptyElements * 2 >= this.queue.length)
      {
         this.queue = this.queue.slice(this.emptyElements);
         this.emptyElements = 0;
      }
      
      return element;
   }
};