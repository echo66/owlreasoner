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
 * Types of axioms (AX) understood by the reasoner.
 */
const AX_CLASS_SUB = "subClassOf",
      AX_CLASS_EQ = "equivalentClasses",
      AX_OPROP_SUB = "subObjectPropertyOf";

/**
 * Types of entities (ET) understood by the reasoner.
 */
const ET_CLASS = "class",
      ET_OPROP = "objectProperty";
      
/**
 * Types of class expressions (CE) understood by the reasoner.
 */
const CE_INTERSECT = "objectIntersectionOf",
      CE_OBJ_VALUES_FROM = "objectSomeValuesFrom";

/**
 * Types of object property expressions (OPE) understood by the reasoner.
 */      
const OPE_CHAIN = "objectPropertyChain";

/**
 * Namespace for all OWL objects.
 */
var owl = 
{
   name: "OWL Reasoner",
   version: 0.2   
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
    * @returns Ontology object representing the ontology parsed.
    */
   parse: function(owlXml)
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
         var IRI = element.getAttribute("IRI");
         var abbrIRI = element.getAttribute("abbrIRI");
         
         return ontology.createEntity(type, IRI, abbrIRI);
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
            "type": CE_INTERSECT,
            "args": classExprs
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
            
            if (node.nodeName == "ObjectProperty" && !oprop)
            {
               oprop = parseEntity(ET_OPROP, node);
            }
            else if (oprop)
            {
               if (!classExpr)
               {
                  classExpr = parseClassExpr(node);
               }
               else
               {
                  throw "The format of ObjectSomeValuesFrom expression is incorrect!";
               }
            }
         }
         
         if (!oprop || !classExpr)
         {
            throw "The format of ObjectSomeValuesFrom expression is incorrect!";
         }
         
         var objSomeValuesFromExpr = 
         {
            "type": CE_OBJ_VALUES_FROM,
            "opropExpr": oprop,
            "classExpr": classExpr
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
            case "Class": return parseEntity(ET_CLASS, element);
            case "ObjectIntersectionOf": return parseObjIntersectExpr(element);
            case "ObjectSomeValuesFrom": return parseSomeValuesFromExpr(element);
            /*
            case "DataSomeValuesFrom":
               break;
            case "ObjectOneOf":
               break;
            case "ObjectHasValue":
               break;
            case "ObjectHasSelf":
               break;
            case "DataHasValue":
               break;*/
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
            throw "The object property chain should contain at least 2 object properties.";
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
            
            if (node.nodeName == "ObjectPropertyChain")
            {
                if (firstArg)
                {
                    throw "The format of SubObjectPropertyOf axiom is incorrect!";
                }
                
                firstArg = parseOpropChain(node);
            }
            else if (node.nodeName == "ObjectProperty")
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
	               throw "The format of SubObjectPropertyOf axiom is incorrect!";
	            }
	         }
         }
         
         if (!firstArg || !secondArg)
         {
            throw "The format of SubObjectPropertyOf axiom is incorrect!";
         }
         
         var subOpropOfAxiom =
         {
            "type": AX_OPROP_SUB,
            "arg1": firstArg,
            "arg2": secondArg 
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
	            "type": type,
               "args": []
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
             throw "Class axiom contains less than " + minExprCount + " class expressions!";
          }
          
          if (!isNaN(maxExprCount) && exprCount > maxExprCount)
          {
             throw "Class axiom contains more than " + maxExprCount + " class expressions!";
          }

          return newAxiom;
      }
      
      var axioms = [];
      var xmlDoc = undefined;
      
      if (window.DOMParser)
      {
         parser = new DOMParser();
         xmlDoc = parser.parseFromString(owlXml, "text/xml");
      }
      else
      {
         xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
         xmlDoc.async = "false";
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
         
         var axiom;
         
         switch (node.nodeName)
         {
            case "SubClassOf":
               axiom = parseClassAxiom(AX_CLASS_SUB, node, 2, 2);
               break;
            case "EquivalentClasses":   
               axiom = parseClassAxiom(AX_CLASS_EQ, node, 2);
               break;
            case "SubObjectPropertyOf": 
               axiom = parseSubOpropAxiom(node);    
               break;
         }
         
         if (axiom)
         {
            axioms.push(axiom);
         }
      }
           
      ontology.axioms = axioms;
      return ontology;
  },
  
  /**
   * Builds an OWL/XML string representing the given ontology.
   * 
   * @param ontology Ontology to return the OWL/XML representation for.
   */
  write : function (ontology)
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
        var owlXml = "<" + name;
        
        if (entity.IRI)
        {
           owlXml += ' IRI="' + entity.IRI + '"';
        }
        
        if (entity.abbreviatedIRI)
        {
           owlXml += ' abbreviatedIRI="' + entity.abbreviatedIRI + '"';
        }
        
        owlXml += "/>";
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
        var owlXml = "<ObjectIntersectionOf>";
        var subExprs = expr.args;
        var subExprCount = subExprs.length;
        
        for (var subExprIndex = 0; subExprIndex < subExprCount; subExprIndex++)
        {
           owlXml += writeClassExpr(subExprs[subExprIndex]);
        }
        
        owlXml += "</ObjectIntersectionOf>";
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
        var owlXml = "<ObjectSomeValuesFrom>";
        owlXml += writeEntity(expr.opropExpr, "ObjectProperty");
        owlXml += writeClassExpr(expr.classExpr);
        owlXml += "</ObjectSomeValuesFrom>";
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
             return writeEntity(expr, "Class");
           break;
	        case CE_INTERSECT:
	          return writeObjIntersectOfExpr(expr);
           break;
           case CE_OBJ_VALUES_FROM:
             return writeSomeValuesFromExpr(expr);
           break;
           default: throw "Uncrecognized class expression!";               
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
        var owlXml = "<" + name + ">";
        var axiomArgs = axiom.args;
        var axiomArgCount = axiomArgs.length;
        
	     for (var exprIndex = 0; exprIndex < axiomArgCount; exprIndex++)
        {
           owlXml += writeClassExpr(axiomArgs[exprIndex]);
        }
        
        owlXml += "</" + name + ">";
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
        var owlXml = "<ObjectPropertyChain>";
        var args = expr.args;
        var argCount = args.length;
        
        for (var argIndex = 0; argIndex < argCount; argIndex++)
        {
           owlXml += writeEntity(args[argIndex], "ObjectProperty");
        }
        
        owlXml += "</ObjectPropertyChain>";
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
        var owlXml = "<SubObjectPropertyOf>";
        
        if (axiom.arg1.type == OPE_CHAIN)
        {
           owlXml += writeOpropChain(axiom.arg1);
        }
        else if (axiom.arg1.type == ET_OPROP)
        {
           owlXml += writeEntity(axiom.arg1, "ObjectProperty");
        }
        else
        {
           throw "Unknown type of the expression in the SubObjectPropertyOf axiom!";
        }
        
        owlXml += writeEntity(axiom.arg2, "ObjectProperty");
        owlXml += "</SubObjectPropertyOf>";
        return owlXml;
     }
     
     var owlXml = "<Ontology>";
     var axioms = ontology.axioms;
     var axiomCount = axioms.length;
     
     for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
     {
        var axiom = axioms[axiomIndex];
        
        switch (axiom.type)
        {
           case AX_CLASS_EQ:
              owlXml += writeClassAxiom(axiom, "EquivalentClasses");
           break;
           case AX_CLASS_SUB:
              owlXml += writeClassAxiom(axiom, "SubClassOf");
           break;
           case AX_OPROP_SUB:
              owlXml += writeOpropSubAxiom(axiom);
           break;
           default: throw "Unknown type of the axiom!";
        }
     }
     
     owlXml += "</Ontology>";
     return owlXml;
  }
};

/**
 * An object representing a reasoner.
 */
owl.Reasoner = function(ontology) 
{  
   /**
    * Runs subsumption algorithm on the given ontology and produces an object which can be used
    * to find all subsumers of any class in the ontology.
    * 
    * @returns Object which can be used to find out subsumers of any class in the ontology.
    */
   function doSubsumption(srcOntology)
   {
      var ontology = srcOntology.normalize();
   
      /**
       * Stores labels for each node.
       */
      var nodeLabels =
      {
         /**
          * Array storing the labels.
          */
         nodeLabels: [],
         
         /**
          * Returns an array containing names of all nodes in the collection.
          */
         getAllNodes: function()
         {
            return this.nodeLabels;
         },
   
         /**
          * Checks if the node with the given IRI is labeled with all given labels.
          * 
          * @param node IRI of the node.
          * @param label IRI of the labels to check for.
          * @returns True if the node is labeled with the given label, false otherwise.
          */
         isNodeLabeledWith: function(node, label)
         {
            var labels = this.nodeLabels[node];
            
            if (!labels)
            {
               return false;
            }
            
            if (labels[label])
            {
               return true;
            }
            else
            {
               return false;
            }
         },
         
         /**
          * Checks if the node with the given IRI is labeled with all given labels.
          * 
          * @param node IRI of the node.
          * @param reqLabels Labels the node should be labeled with.
          * @returns True if the node is labeled with all the given labels, false otherwise.
          */
         isNodeLabeledWithAll: function(node, reqLabels)
         {
            if (!reqLabels)
            {
               return true;
            }
            
            var labels = this.nodeLabels[node];
            
            if (!labels) 
            {
               return false;
            }
            
            for (var label in reqLabels)
            {         
               if (!labels[label])
               {
                  // Not labeled with some required label - return false.
                  return false;
               }
            }
         
            return true;
         },
         
         /**
          * Returns a collection of all labels of the given node.
          *
          * @param node Node to get the labels for.
          * @returns Collection of all labels for the given node.
          */
         get: function(node)
         {
            return this.nodeLabels[node] || [];         
         },
         
         /**
          * Adds the given label to the given node.
          *
          * @param node IRI of the node to add the label to.
          * @param label IRI of the label to add.
          */
         add: function(node, label)
         {         
            if (!this.nodeLabels[node])
            {
               this.nodeLabels[node] = [];
            }
            
            if (!this.nodeLabels[node][label])
            {
               this.nodeLabels[node][label] = 1;
            }
         }
      };   
      
      /**
       * Stores labels for each edge.
       */
      var edgeLabels =
      {
         edgeLabels: [],
         
         /**
          * Gets all labels of an edge between node1 and node2.
          * 
          * @param node1 IRI of the source node of the edge.
          * @param node2 IRI of the destnation node of the edge.
          * @returns An array of all labels of the edge or undefined if there are no edge between
          * node1 and node2.
          */
         get: function(node1, node2)
         {
            if (!this.edgeLabels[node1])
            {
               return [];
            }
            
            return this.edgeLabels[node1][node2] || [];
         },
         
         /**
          * Adds the given label to the edge between node1 and node2.
          *
          * @param node1 IRI of the start node of the edge.
          * @param node2 IRI of the destination node of the edge.
          * @param label IRI of the label to add.
          */
         add: function(node1, node2, label)
         {
            if (!this.edgeLabels[node1])
            {
               this.edgeLabels[node1] = [];
            }
            
            if (!this.edgeLabels[node1][node2])
            {
               this.edgeLabels[node1][node2] = [];
            }
            
            this.edgeLabels[node1][node2][label] = 1;
         },
         
         /**
          * Checks if the edge between node1 and node2 is labeled with the given label. 
          *
          * @param node1 IRI of the source node of the edge.
          * @param node2 IRI of the destination node of the edge.
          * @param label IRI of the label to check.
          * @returns True if the edge is labeled with label, false otherwise.
          */
         isEdgeLabeledWith: function (node1, node2, label)
         {
            var labels = this.get(node1, node2);
            
            if (labels[label]) 
            {
   	         return true;
   	      }
   	      else 
   	      {
   	         return false;
   	      }
         }
      };
      
      var queues = [];
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
            if (!nodeLabels.isNodeLabeledWithAll(this.node, this.reqLabels) || 
               nodeLabels.isNodeLabeledWith(this.node, this.newLabel))
            {
               // The node is not labeled with all required labels yet or it has been labeled with
               // the new label already - there is no point to process the operation anyway.
               return;
            }
         
            // Otherwise, add a label to the node. 
            nodeLabels.add(this.node, this.newLabel);
         
            // Since newLabel is a new discovered subsumer of node, all axioms about newLabel
            // apply to node as well - we need to update node instruction queue. 
            addLabelNodeIfInstructions(this.newLabel, this.node);
         
            // We have discovered a new information about node, so we need to update all other
            // nodes linked to it.
            for (var otherNode in nodeLabels.getAllNodes())
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
            if (!edgeLabels.isEdgeLabeledWith(this.node1, this.node2, this.label))
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
            // Get all subsumers of object property P, including P itself.
            var opropSubsumers = getAllOpropSubsumers(label);
         
            for (var q in opropSubsumers)
            {  
               // Add q as a label between node1 and node2.
               edgeLabels.add(node1, node2, q);
         
               // Since we discovered that A <= E Q.B, we know that A <= E Q.C, where C is any subsumer
               // of B. We therefore need to look for new subsumers D of A by checking all axioms like 
               // form E Q.C <= D.
               for (var c in nodeLabels.get(node2))
   	         {
                  addLabelNodeInstructions(q, c, node1);
   	         }
            
               // We want to take care of object property chains. We now know that Q: A -> B.
               // If there is another property R: C -> A for some class C and property 
               // S: C -> B, such that R o Q <= S, we want to label edge (C, B) with S.
               for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
               {
                  var axiom = axioms[axiomIndex];
               
                  if (axiom.type != AX_OPROP_SUB || axiom.arg1.type != OPE_CHAIN 
                     || axiom.arg1.args[1] != q)
                  {
                     continue;
                  }
               
                  var r = axiom.arg1.args[0].IRI;
                  var s = axiom.arg2.IRI;
               
                  for (var c in nodeLabels.getAllNodes()) 
                  {
                     if (edgeLabels.isEdgeLabeledWith(c, node1, r) && 
                        !edgeLabels.isEdgeLabeledWith(c, node2, s))
                     {
                        processNewEdge(c, s, node2);               
                     }
                  }
               }
            
               // We want to take care of object property chains. We now know that Q: A -> B.
               // If there is another property R: B -> C for some class C and property 
               // S: A -> C, such that Q o R <= S, we want to label edge (A, C) with S.
               for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
               {
                  var axiom = axioms[axiomIndex];
               
                  if (axiom.type != AX_OPROP_SUB || axiom.arg1.type != OPE_CHAIN 
                     || axiom.arg1.args[0] != q)
                  {
                     continue;
                  }
               
                  var r = axiom.arg1.args[1].IRI;
                  var s = axiom.arg2.IRI;
               
                  for (var c in nodeLabels.getAllNodes()) 
                  {
                     if (edgeLabels.isEdgeLabeledWith(node2, c, r) && 
                        !edgeLabels.isEdgeLabeledWith(node1, c, s))
                     {
                        processNewEdge(node1, s, node2);               
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
         
         if (axiom.type != AX_CLASS_SUB || !firstArg || !secondArg || secondArg.type != ET_CLASS)
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
       * "Label classIRI2 as A if it is labeled A1, A2, ..., Am already" 
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
               reqLabels = [];
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
       * "Label classIRI2 with C" 
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
            var firstArg = axiom.args[0] || undefined;
         
            if (axiom.type != AX_CLASS_SUB ||
               !firstArg || firstArg.type != CE_OBJ_VALUES_FROM || 
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
       * "Label the edge (classIRI2, C) as P" 
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
         
            if (axiom.type != AX_CLASS_SUB ||
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
      
      function getAllOpropSubsumers(opropIRI)
      {
         var opropChecked = [];
         opropChecked[opropIRI] = 1;
         var opropQueue = new owl.Queue();
         opropQueue.enqueue(opropIRI);
         
         while (!opropQueue.isEmpty())
         {
            var curOpropIRI = opropQueue.dequeue();
            
            for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++)
            {
               var axiom = axioms[axiomIndex];
               
               var arg1 = axiom.arg1;
               
               if (!arg1)
               {
                  continue;
               }
               
               var newOpropIRI = axiom.arg2.IRI;
               
               if (axiom.type != AX_OPROP_SUB || arg1.type != ET_OPROP && arg1.IRI != curOpropIRI || 
                  opropChecked[newOpropIRI])
               {
                  continue;
               }
               
               opropQueue.enqueue(newOpropIRI);
               opropChecked[newOpropIRI] = 1;
            }
         }
         
         return opropChecked;
      }
      
      /**
       * Initialises a single node of the graph before the subsumption algorithm is run.
       *
       * @param classIRI IRI of the class to initialize a node for.
       */
      function initialiseNode(classIRI)
      {
         // Every class is a subsumer for itself.
         nodeLabels.add(classIRI, classIRI);
         
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
         
         var classes = ontology.entities[ET_CLASS];
         
         for (var classIRI in classes)
         {
            // Create a node for each class in the Ontology.
            initialiseNode(classIRI);
            
            // Mark Thing as a subsumer of the class.
            nodeLabels.add(classIRI, THING);   
   
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
      
      return nodeLabels;
   }

   /**
    * Checks if the given class is the subclass of another class.
    *
    * @param classIRI1 IRI of one class.
    * @param classIRI2 IRI of another class.
    * @returns True if classIRI1 is a subclass of classIRI2, false otherwise. 
    */
   this.isSubclass = function (class1, class2)
   {
      var classes = ontology.entities[ET_CLASS];
      
      if (!classes[class1])
      {
         throw 'The ontology does not contain a class \'' + class1 + '\'';
      }
      
      if (!classes[class2])
      {
         throw 'The ontology does not contain a class \'' + class2 + '\'';
      }
      
      return nodeLabels.isNodeLabeledWith(class1, class2);
   }
   
   /**
    * Answers the given user query. 
    * 
    * @param query An object representing a query to be answered.
    * @returns True if the ontology satisfies the query, false otherwise.
    */
   this.answerQuery = function (query)
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
   }
   
   var nodeLabels = doSubsumption(ontology);
}; 

/**
 * An object which can be used to parse user queries against the ontology.
 */
owl.queryParser = 
{
   /**
    * Parses the given string into the query. 
    * 
    * @param queryTxt String to parse into the query.
    * @returns An object representing the query parsed.
    */
   parse: function (queryTxt)
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
 * Queries are accepted by the reasoner to answer the user 'questions' about the ontology.
 *  
 * @param class1 IRI of the class to be checked for being a subsumee of class2.
 * @param class2 IRI of the class to be checked for being a subsumer of class1.
 */
owl.Query = function (class1, class2)
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
 * Onotlogy represents a set of facts about some world.
 */
owl.Ontology  = function()
{	
   // Contains a list of prefixes to be used for auto-generated entity IRIs (indexed by entity 
   // type).
   var entityPrefixes = [];
   entityPrefixes[ET_OPROP] = "OP_";
   entityPrefixes[ET_CLASS] = "C_";
   
   // Contains the numbers to be used in IRIs of next auto-generated entities.
   var nextEntityNos = [];
   nextEntityNos[ET_OPROP] = 1;
   nextEntityNos[ET_CLASS] = 1;
   
   // Contains number of entities of each type in the ontology.
   var entityCount = [];
   entityCount[ET_OPROP] = 0;
   entityCount[ET_CLASS] = 0; 
   
   // Contains entities of each type in the ontology.
   var entities = [];
   entities[ET_OPROP] = [];
   entities[ET_CLASS] = [];
   
   /**
    * The set of entities found in the ontology.
    */
   this.entities = entities;
   
   /**
    * The set of axioms the ontology is comprised of.
    */
   this.axioms = [];
   
   /**
    * Allows generating a new unique IRI for the entity of the given type.
    * @param type Type of the entity to generate a new unique IRI for.
    * @returns New unique IRI.
    */
   function createNewIRI(type)
   {
      var entityPrefix = entityPrefixes[type];
      var nextEntityNo = nextEntityNos[type];
      
	   if (!entityPrefix || !nextEntityNo)
	   {
	      throw "Unrecognized entity type!";
	   }
      
      var allEntities = entities[type];
	   var IRI = "";
         
	   do
	   {
	      IRI = entityPrefix + nextEntityNo;
	      nextEntityNo++;
	   }
	   while (allEntities[IRI]);
         
	   nextEntityNos[type] = nextEntityNo;
	   return IRI; 
	}
   
   /**
    * Creates a new entity of the given type with automatically generated IRI.
    * 
    * @param type Type of the entity to create.
    * @param IRI (optional) IRI of the new entity. If not given, generates a new IRI.
    * @param abbrIRI (optional) abbreviatedIRI of the new entity.
    * @returns The new entity of the given type with the name automatically generated.
    */
   this.createEntity = function(type, IRI, abbrIRI)
   {
      if (!IRI)
      {
         IRI = createNewIRI(type);
      }
      else
      {
         if (entities[type][IRI])
         {
            return entities[type][IRI];
         }
      }
         
      var entity = 
	   {
	      "type": type,
	      "IRI": IRI,
	      "abbreviatedIRI": abbrIRI
	   }
      
      entities[type][IRI] = entity;
      entityCount[type]++;
      return entity;
   };
   
   /**
    * Returns number of classes in the ontology.
    * 
    * @returns Number of classes in the ontology.
    */
   this.getClassCount = function ()
   {
      return entityCount[ET_CLASS];
   };
   
   /**
    * Returns number of object properties in the ontology.
    * 
    * @returns Number of object properties in the ontology.
    */
   this.getObjectPropertyCount = function ()
   {
      return entityCount[ET_OPROP];
   };
   
   /**
    * Normalizes the ontology.
    * 
    * @returns New ontology which is a normalized version of this one.
    */
   this.normalize = function()
   {  
      var resultOntology = new owl.Ontology();
      
      for (var entityType in this.entities)
      {
         var entitiesOfType = entities[entityType];
         
         for (var entityIRI in this.entities[entityType])
         {
            resultOntology.entities[entityType][entityIRI] = entitiesOfType[entityIRI];
         }
      }
         
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
      function applyRuleNF1(axiom)
      {
         if (axiom.type != AX_OPROP_SUB || 
            axiom.arg1.type != OPE_CHAIN || 
            axiom.arg1.args.length <= 2)
         {
            return undefined;
         }
       
         var srcChain = axiom.arg1.args; 
         var prevOprop = resultOntology.createEntity(ET_OPROP); 
         
         var normalized = [
         {
            type: AX_OPROP_SUB,
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
               type: AX_OPROP_SUB,
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
               type: AX_OPROP_SUB,
               arg1:
               {
                  type: OPE_CHAIN,
                  args: [prevOprop, srcChain[lastOpropIndex]]
               },
               arg2: axiom.arg2
	      });
         
         return normalized;
      }
      
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
      function applyRuleNF2(axiom)
      {
         if (axiom.type != AX_CLASS_EQ)
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
                  type: AX_CLASS_SUB,
                  args: [classExprs[classExpr1Index], classExprs[classExpr2Index]]
               });
            }
         }
         
         return normalized;
      }
      
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
      function applyRuleNF3(axiom)
      {
         if (axiom.type != AX_CLASS_SUB || axiom.args[1].type != CE_INTERSECT)
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
	            type: AX_CLASS_SUB,
	            args: [firstArg, args[exprIndex]]
	         });
	      }
         
         return normalized;
      }
      
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
      function applyRuleNF4(axiom)
      {
         if (axiom.type != AX_CLASS_SUB || 
            axiom.args[0].type == ET_CLASS || 
            axiom.args[1].type == ET_CLASS)
         {
            return undefined;
         }
       
	      var firstArg = axiom.args[0];
         var secondArg = axiom.args[1];
       
         var normalized = [];  
	      var newClassExpr = resultOntology.createEntity(ET_CLASS);
            
	      normalized.push(
	      {
	         type: AX_CLASS_SUB,
	         args: [firstArg, newClassExpr]
	      });
            
	      normalized.push(
	      {
	         type: AX_CLASS_SUB,
	         args: [newClassExpr, secondArg]
	      });
         
         return normalized;
      }
      
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
      function applyRuleNF5(axiom)
      {
	      if (axiom.type != AX_CLASS_SUB || axiom.args[0].type != CE_INTERSECT)
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
	               type: AX_CLASS_SUB,
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
	            type: AX_CLASS_SUB,
	            args: [newIntersectExpr, secondArg]
	         });
            
            return normalized;
	      }
         else
         {
            return undefined;
         }
      }
      
      /**
       * Checks if the given axiom is in the form E P.A <= B, where A is a complex class 
       * expression. If this is the case converts the axiom into two equivalent axioms
       * A1 <= A and E P.A1 <= B, where A1 is a new atomic class.
       * 
       * @param axiom Axiom to try to apply the rule to.
       * @returns Set of axioms which are result of applying the rule to the given axiom or
       * undefined if the rule could not be applied.
       */
      function applyRuleNF6(axiom)
      {         
         if (axiom.type != AX_CLASS_SUB || 
            axiom.args[0].type != CE_OBJ_VALUES_FROM || 
            axiom.args[0].classExpr.type == ET_CLASS)
         {
            return undefined;
         }
       
         var normalized = [];
         var firstArg = axiom.args[0];
         var secondArg = axiom.args[1];
         
         var newClassExpr = resultOntology.createEntity(ET_CLASS);
            
         var newObjSomeValuesExpr = 
	      {
	         type: CE_OBJ_VALUES_FROM,
	         opropExpr: firstArg.opropExpr,
	         classExpr: newClassExpr
	      }
            
	      normalized.push(
	      {
	         type: AX_CLASS_SUB,
	         args: [firstArg.classExpr, newClassExpr]
	      });
            
	      normalized.push(
	      {
	         type: AX_CLASS_SUB,
	         args: [newObjSomeValuesExpr, secondArg]
	      });
         
         return normalized;
      }
      
      /**
       * Checks if the given axiom is in the form A <= E P.B, where B is a complex class 
       * expression. If this is the case converts the axiom into two equivalent axioms
       * B1 <= B and A <= E P.B1, where B1 is a new atomic class.
       * 
       * @param axiom Axiom to try to apply the rule to.
       * @returns Set of axioms which are result of applying the rule to the given axiom or
       * undefined if the rule could not be applied.
       */
      function applyRuleNF7(axiom)
      {                  
         if (axiom.type != AX_CLASS_SUB ||
            axiom.args[1].type != CE_OBJ_VALUES_FROM || 
            axiom.args[1].classExpr.type == ET_CLASS)
         {
            return undefined;
         }
         
         var normalized = [];
         var firstArg = axiom.args[0];
	      var secondArg = axiom.args[1];
         
         var newClassExpr = resultOntology.createEntity(ET_CLASS);
            
	      var newObjSomeValuesExpr = 
	      {
	         type: CE_OBJ_VALUES_FROM,
	         opropExpr: secondArg.opropExpr,
	         classExpr: newClassExpr
	      }
            
	      normalized.push(
	      {
	         type: AX_CLASS_SUB,
	         args: [secondArg.classExpr, newClassExpr]
	      });
            
	      normalized.push(
	      {
	         type: AX_CLASS_SUB,
	         args: [firstArg, newObjSomeValuesExpr]
	      });
         
         return normalized;
      }
      
      var queue = new owl.Queue();
      var axioms = this.axioms;
      var axiomCount = this.axioms.length;
      
      for (var axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++) 
      {
         queue.enqueue(axioms[axiomIndex]);
      }
      
      var rules = [applyRuleNF1, applyRuleNF2, applyRuleNF3, applyRuleNF4, applyRuleNF5, 
         applyRuleNF6, applyRuleNF7];
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
            // If nothing can be done to the axiom, it is returned unchanged by applyRule() 
            // function.
            resultOntology.axioms.push(axiom);            
         }
      }
      
      return resultOntology;
   }
}

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
   isEmpty: function () 
   { 
      return this.queue.length == 0; 
   },
   
   /**
    * Adds an object to the queue.
    * 
    * @param obj Object to add to the queue.
    */
   enqueue: function (obj)
   {
      this.queue.push(obj);
   },
   
   /**
    * Removes the oldest object from the queue and returns it.
    * 
    * @returns The oldest object in the queue.
    */
   dequeue: function ()
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