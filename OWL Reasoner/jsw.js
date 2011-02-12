/**
 * The library contains a set of tools for working with Semantic Web (SW) technologies. Currently,
 * it includes the following features:
 *
 * OWL/XML parser/writer.
 * OWL-EL reasoner (with limitations)
 * SPARQL parser (with limitations).
 * 
 * @author Vit Stepanovs <vitaly.stepanov@gmail.com>, 2010 - 2011.
 */

/** Namespace for all library objects. */
var jsw;

if (!jsw) {
    jsw = {
        owl: {},
        rdf: {},
        util: {},
        xsd: {}
    };
} else {
    throw 'Unable to run the script! Namespace "jsw" exists already!';
}

/** Defines types of expressions the objects in OWL namespace can work with.*/
jsw.owl.EXPRESSION_TYPES = {
    /** SubClassOf axiom. */
    AXIOM_CLASS_SUB: 0,
    /** EquivalentClasses axiom. */
    AXIOM_CLASS_EQ: 1,
    /** SubObjectPropertyOf axiom. */
    AXIOM_OPROP_SUB: 2,
    /** EquivalentObjectProperties axiom. */
    AXIOM_OPROP_EQ: 3,
    /** ObjectIntersectionOf class expression. */
    CE_INTERSECT: 4,
    /** ObjectSomeValuesFrom class expression. */
    CE_OBJ_VALUES_FROM: 5,
    /** Class entity. */
    ET_CLASS: 6,
    /** ObjectProperty entity. */
    ET_OPROP: 7,
    /** (Named)Individual entity. */
    ET_INDIVIDUAL: 8,
    /** ClassAssertion fact. */
    FACT_CLASS: 9,
    /** ObjectPropertyAssertion fact. */
    FACT_OPROP: 10,
    /** ObjectPropertyChain object property expression. */
    OPE_CHAIN: 11 
};

/** Defines IRIs of important concepts in RDF namespace. */
jsw.owl.IRIS = {
    /** IRI by which the Thing concept is referred to in OWL. */
    THING: 'owl:Thing'
};

/** Defines IRIs of important concepts in RDF namespace. */
jsw.rdf.IRIS = {
    /** IRI by which the type concept is referred to in RDF. */
    TYPE: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
};

/** Contains the URIs of (some) datatypes of XML Schema. */
jsw.xsd.DATA_TYPES = {
    /** IRI of boolean data type. */
    BOOLEAN: 'http://www.w3.org/2001/XMLSchema#boolean',
    /** IRI of decimal data type. */
    DECIMAL: 'http://www.w3.org/2001/XMLSchema#decimal',
    /** IRI of a double data type. */
    DOUBLE: 'http://www.w3.org/2001/XMLSchema#double',
    /** IRI of a integer data type. */
    INTEGER: 'http://www.w3.org/2001/XMLSchema#integer',
    /** IRI of a string data type. */
    STRING: 'http://www.w3.org/2001/XMLSchema#string'
};

/** An object allowing to work with OWL/XML format. */
jsw.owl.xml = {
    /**
     * Parses the given OWL/XML string into the Ontology object.
     * 
     * @param owlXml String containing OWL/XML to be parsed.
     * @param onError Function to be called in case if the parsing error occurs.
     * @returns Ontology object representing the ontology parsed.
     */
    parse: function (owlXml, onError) {
        var exprTypes = jsw.owl.EXPRESSION_TYPES, // Cash reference to the constants.
            node, // Will hold the current node being parsed.
            ontology = new jsw.owl.Ontology(), // The ontology to be returned.
            statements = ontology.axioms, // Will contain all statements.
            prefixes = ontology.prefixes; // Maps prefix names to IRIs.
   
        /**
         * Parses XML element representing some entity into the object. Throws an exception if the
         * name of the given element is not equal to typeName.
         * 
         * @param type Type of the entity represented by the XML element.
         * @param typeName Name of the OWL/XML element which corresponds to the given entity type.
         * @param element XML element representing some entity.
         * @returns Object representing the entity parsed. 
         */
        function parseEntity(type, typeName, element) {
            var abbrIri, colonPos, entity, iri, prefixName;
         
            if (element.nodeName !== typeName) {
                throw typeName + ' element expected, but not found!';
            }

            abbrIri = element.getAttribute('abbreviatedIRI');
            iri = element.getAttribute('IRI');

            // If both attributes or neither are defined on the entity, it is an error.
            if ((!iri && !abbrIri) || (iri && abbrIri)) {
                throw 'One and only one IRI or abbreviatedIRI attribute must be present in ' + 
                    element.nodeName + ' element!';
            }
         
            if (!abbrIri) {
                return ontology.createEntity(type, iri);
            } else {
                colonPos = abbrIri.indexOf(':');

                if (colonPos >= 0) {
                    if (colonPos === abbrIri.length - 1) {
                        throw 'Abbreviated IRI "' + abbrIri + '" does not contain anything after ' +
                            'the prefix!';
                    }

                    prefixName = abbrIri.substring(0, colonPos);

                    if (!prefixes[prefixName]) {
                        throw 'Unknown prefix "' + prefixName + '" in abbreviated  IRI "' + 
                            abbrIri + '"!';
                    }

                    iri = prefixes[prefixName] + abbrIri.substring(colonPos + 1);
                } else {
                    throw 'Abbreviated IRI "' + abbrIri + '" does not contain a prefix name!';
                }

                entity = ontology.createEntity(type, iri, prefixName);

                // Store information about abbreviated entity IRI, so that it can be used when
                // writing the ontology back in OWL/XML.
                entity.abbrIri = abbrIri;
                return true;
            }
        }
      
        /**
         * Parses XML element representing class intersection expression.
         * 
         * @param element XML element representing class intersection expression.
         * @returns Object representing the class intersection expression. 
         */
        function parseObjIntersectExpr(element) {
            var classExprs = [],
                node = element.firstChild;
            
            while (node) {
                if (node.nodeType === 1) {            
                    classExprs.push(parseClassExpr(node));
                }

                node = node.nextSibling;
            }
         
            return {
                'type': exprTypes.CE_INTERSECT,
                'args': classExprs
            };
        }
      
        /**
         * Parses XML element representing ObjectSomeValuesFrom expression.
         * 
         * @param element XML element representing the ObjectSomeValuesFrom expression.
         * @returns Object representing the expression parsed.
         */
        function parseSomeValuesFromExpr(element) {
            var oprop, classExpr, node;

            node = element.firstChild;

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }
            
                if (!oprop) {
                    oprop = parseEntity(exprTypes.ET_OPROP, 'ObjectProperty', node);
                } else if (!classExpr) {
                    classExpr = parseClassExpr(node);
                } else {
                    throw 'The format of ObjectSomeValuesFrom expression is incorrect!';
                }

                node = node.nextSibling;
            }
         
            if (!oprop || !classExpr) {
                throw 'The format of ObjectSomeValuesFrom expression is incorrect!';
            }
         
            return {
                'type': exprTypes.CE_OBJ_VALUES_FROM,
                'opropExpr': oprop,
                'classExpr': classExpr
            };
        }
      
        /**
         * Parses the given XML node into the class expression.
         *
         * @param element XML node containing class expression to parse.
         * @returns An object representing the class expression parsed.
         */
        function parseClassExpr(element) {
            switch (element.nodeName) {
            case 'ObjectIntersectionOf': 
                return parseObjIntersectExpr(element);
            case 'ObjectSomeValuesFrom': 
                return parseSomeValuesFromExpr(element);
            default: 
                return parseEntity(exprTypes.ET_CLASS, 'Class', element);
            }
        }
      
        /**
         * Parses an XML element representing the object property chain into the object.
         *
         * @param element Element representing an object property chain.
         * @returns Object representing the object property chain parsed.
         */
        function parseOpropChain(element) {
            var args = [],
                node = element.firstChild,
                opropType = exprTypes.ET_OPROP;
             
            while (node) {
                if (node.nodeType === 1) {
                    args.push(parseEntity(opropType, 'ObjectProperty', node));
                }

                node = node.nextSibling;
            }
         
            if (args.length < 2) {
                throw 'The object property chain should contain at least 2 object properties!';
            }
         
            return {
                'type': exprTypes.OPE_CHAIN,
                'args': args            
            };
        }
      
        /**
         * Parses XML element representing SubObjectPropertyOf axiom into the object.
         * 
         * @param element XML element representing SubObjectPropertyOf axiom.
         */
        function parseSubOpropAxiom(element) {
            var firstArg, secondArg, node, opropType;
            
            opropType = exprTypes.ET_OPROP;
            node = element.firstChild; 

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }
            
                if (!firstArg) {
                    if (node.nodeName === 'ObjectPropertyChain') {
                        firstArg = parseOpropChain(node);
                    } else {
                        firstArg = parseEntity(opropType, 'ObjectProperty', node);
                    }
                } else if (!secondArg) {
                    secondArg = parseEntity(opropType, 'ObjectProperty', node);
                } else {
                    throw 'The format of SubObjectPropertyOf axiom is incorrect!';
                }

                node = node.nextSibling;
            }
         
            if (!firstArg || !secondArg) {
                throw 'The format of SubObjectPropertyOf axiom is incorrect!';
            }
         
            statements.push({
                'type': exprTypes.AXIOM_OPROP_SUB,
                'arg1': firstArg,
                'arg2': secondArg 
            });
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
        function parseClassAxiom(type, element, minExprCount, maxExprCount) {
            var args = [],
                node = element.firstChild;
          
            while (node) {
                if (node.nodeType === 1) {
                    args.push(parseClassExpr(node));
                }

                node = node.nextSibling;
            }
	    
            if (!isNaN(minExprCount) && args.length < minExprCount) {
                throw 'Class axiom contains less than ' + minExprCount + ' class expressions!';
            }
          
            if (!isNaN(maxExprCount) && args.length > maxExprCount) {
                throw 'Class axiom contains more than ' + maxExprCount + ' class expressions!';
            }

            statements.push({
                'type': type,
                'args': args
            });
        }

        /**
         * Parses EquivalentObjectProperties XML element into the corresponding
         * object.
         */
        function parseEqOpropAxiom(element) {
            var args = [],
                node = element.firstChild,
                opropType = exprTypes.ET_OPROP;
          
            while (node) {
                if (node.nodeType === 1) {
                    args.push(parseEntity(opropType, 'ObjectProperty', node));
                }

                node = node.nextSibling;
            }
	    
            if (args.length < 2) {
                throw 'EquivalentObjectProperties axiom contains less than 2 child elements!';
            }

            statements.push({
                'type': exprTypes.AXIOM_OPROP_EQ,
                'args': args
            });
        }

        /**
         * Parses ClassAssertion XML element into the corresponding object.
         * 
         * @param element OWL/XML ClassAssertion element.
         */
        function parseClassAssertion(element) {
            var classExpr, individual, node;

            node = element.firstChild;
          
            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }
            
                if (!classExpr) {
                    classExpr = parseClassExpr(node);
	            } else if (!individual) {
                    individual = parseEntity(exprTypes.ET_INDIVIDUAL, 'NamedIndividual', node);
                } else {
                    throw 'Incorrect format of the ClassAssertion element!';
                }

                node = node.nextSibling;               
            }
         
            if (!classExpr || !individual) {
                throw 'Incorrect format of the ClassAssertion element!';
            }
         
            statements.push({
                'type': exprTypes.FACT_CLASS,
                'individual': individual, 
                'classExpr': classExpr
            });
        }
      
        /**
         * Parses ObjectPropertyAssertion OWL/XML element into the corresponding object.
         * 
         * @param element OWL/XML ObjectPropertyAssertion element to parse.
         */
        function parseObjectPropertyAssertion(element) {
            var individualType, leftIndividual, node, objectProperty, rightIndividual;

            individualType = exprTypes.ET_INDIVIDUAL;
            node = element.firstChild;

            while (node) {
                if (node.nodeType !== 1) {
                    node = node.nextSibling;
                    continue;
                }

                if (!objectProperty) {
                    objectProperty = parseEntity(exprTypes.ET_OPROP, 'ObjectProperty', node);
	            } else if (!leftIndividual) {
                    leftIndividual = parseEntity(individualType, 'NamedIndividual', node);
                } else if (!rightIndividual) {
	                rightIndividual = parseEntity(individualType, 'NamedIndividual', node);
                } else {
                    throw 'Incorrect format of the ObjectPropertyAssertion element!';
                }
                
                node = node.nextSibling;
            }
        
            if (!objectProperty || !leftIndividual || !rightIndividual) {
                throw 'Incorrect format of the ObjectPropertyAssertion element!';
            }
         
            statements.push({
                'type': exprTypes.FACT_OPROP,
                'leftIndividual': leftIndividual,
                'objectProperty': objectProperty, 
                'rightIndividual': rightIndividual
            });
        }
      
        /**
         * Parses the given OWL/XML Prefix element and adds the information about this prefix to the
         * ontology.
         *
         * @param element OWL/XML Prefix element.
         */
        function parsePrefixDefinition(element) {
            var prefixName = element.getAttribute('name'),
                prefixIri = element.getAttribute('IRI');

            if (prefixName === null || !prefixIri) {
                throw 'Incorrect format of Prefix element!';
            }

            ontology.addPrefix(prefixName, prefixIri);
        }
      
        node = jsw.util.xml.parseString(owlXml).documentElement.firstChild;
    
        // OWL/XML Prefix statements (if any) should be at the start of the document. We need them
        // to expand abbreviated entity IRIs.
        while (node) {
            if (node.nodeType === 1) {
                if (node.nodeName === 'Prefix') {
                    parsePrefixDefinition(node);
                } else {
                    break;
                }
            }

            node = node.nextSibling;
        }
      
        // Axioms / facts (if any) follow next.
        while (node) {
            if (node.nodeType !== 1) {
                node = node.nextSibling;
                continue;
            }
         
            try {
                switch (node.nodeName) {
                case 'SubClassOf':
                    parseClassAxiom(exprTypes.AXIOM_CLASS_SUB, node, 2, 2);
                    break;
                case 'EquivalentClasses':
                    parseClassAxiom(exprTypes.AXIOM_CLASS_EQ, node, 2);
                    break;
                case 'SubObjectPropertyOf':
                    parseSubOpropAxiom(node);
                    break;
                case 'EquivalentObjectProperties':
                    parseEqOpropAxiom(exprTypes.AXIOM_OPROP_EQ, node);
                    break;
                case 'ClassAssertion':
                    parseClassAssertion(node);
                    break;
                case 'ObjectPropertyAssertion':
                    parseObjectPropertyAssertion(node);
                    break;
                case 'Prefix':
                    throw 'Prefix elements should be at the start of the document!';
                }
            } catch (ex) {
                if (!onError || !onError(ex)) {
                    throw ex;
                }
            }

            node = node.nextSibling;
        }
      
        return ontology;
    },
  
    /**
     * Builds an OWL/XML string representing the given ontology.
     * 
     * @param ontology Ontology to return the OWL/XML representation for.
     * @returns OWL/XML representing the given ontology.
     */
    write: function (ontology) {
        var axiom, // Currently processed statement from the ontology.
            axioms = ontology.axioms,
            axiomCount = axioms.length,
            axiomIndex, // Index of the statement currently processed.
            exprTypes = jsw.owl.EXPRESSION_TYPES, // Cashed constants.
            owlXml = '<Ontology>', // Will hold ontology OWL/XML produced.
            prefixes = ontology.prefixes,
            prefixName; 
         
        /**
         * Returns OWL/XML representation for the given OWL entity.
         * 
         * @param entity Entity to return OWL/XML representation for.
         * @param entityName Name of XML tag to use for the entity.
         * @returns OWL/XML representation for the given OWL entity.
         */
        function writeEntity(entity, entityName) {
            var owlXml = '<' + entityName;
        
            if (entity.abbrIri) {
                owlXml += ' abbreviatedIRI="' + entity.abbrIri + '"';
            } else {
                owlXml += ' IRI="' + entity.IRI + '"';
            }
        
            owlXml += '/>';
            return owlXml;
        }
        
        /**
         * Returns OWL/XML representation for the given OWL class intersection expression.
         * 
         * @param expr Class intersection expression to return the OWL/XML representation for.
         * @returns OWL/XML representation for the given OWL class intersection
         * expression.
         */
        function writeObjIntersectOfExpr(expr) {
            var owlXml = '<ObjectIntersectionOf>',
                subExprs = expr.args,
                subExprCount = subExprs.length,
                subExprIndex;
        
            for (subExprIndex = 0; subExprIndex < subExprCount; subExprIndex++) {
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
        function writeSomeValuesFromExpr(expr) {
            return '<ObjectSomeValuesFrom>' +
                writeEntity(expr.opropExpr, 'ObjectProperty') + 
                writeClassExpr(expr.classExpr) +
                '</ObjectSomeValuesFrom>';
        }
     
        /**
         * Returns OWL/XML representation for the given OWL class expression.
         * 
         * @param expr Class expression to return the OWL/XML representation for.
         * @returns OWL/XML representation for the given OWL class expression.
         */
        function writeClassExpr(expr) {
            switch (expr.type) {
	        case exprTypes.ET_CLASS:
                return writeEntity(expr, 'Class');
	        case exprTypes.CE_INTERSECT:
	            return writeObjIntersectOfExpr(expr);
            case exprTypes.CE_OBJ_VALUES_FROM:
                return writeSomeValuesFromExpr(expr);
            default:
                throw 'Uncrecognized class expression!';               
	        }
        }
     
        /**
         * Returns OWL/XML representation for the given OWL class axiom.
         * 
         * @param axiom Class axiom.
         * @param elementName Name of the XML element to use.
         * @returns OWL/XML representation for the given OWL class axiom.
         */
        function writeClassAxiom(axiom, elementName) {
            var args = axiom.args,
                argCount = args.length,
                argIndex,
                owlXml = '<' + elementName + '>';
        
            for (argIndex = 0; argIndex < argCount; argIndex++) {
                owlXml += writeClassExpr(args[argIndex]);
            }
        
            owlXml += '</' + elementName + '>';
            return owlXml;
        }
     
	    /**
         * Returns OWL/XML representation for the given OWL ObjectPropertyChain expression.
         * 
         * @param expr OWL ObjectPropertyChain expression to return the OWL/XML representation for.
         * @returns OWL/XML representation for the given OWL ObjectPropertyChain expression.
         */
        function writeOpropChain(expr) {
            var args = expr.args,
                argCount = args.length,
                argIndex,
                owlXml = '<ObjectPropertyChain>';
        
            for (argIndex = 0; argIndex < argCount; argIndex++) {
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
        function writeOpropSubAxiom(axiom) {
            var owlXml = '<SubObjectPropertyOf>';
    
            if (axiom.arg1.type === exprTypes.OPE_CHAIN) {
                owlXml += writeOpropChain(axiom.arg1);
            } else if (axiom.arg1.type === exprTypes.ET_OPROP) {
                owlXml += writeEntity(axiom.arg1, 'ObjectProperty');
            } else {
                throw 'Unknown type of the expression in the SubObjectPropertyOf axiom!';
            }
        
            owlXml += writeEntity(axiom.arg2, 'ObjectProperty');
            owlXml += '</SubObjectPropertyOf>';
            return owlXml;
        }

        /**
         * Returns OWL/XML representation for the given OWL EquivalentObjectProperties axiom.
         * 
         * @param axiom An object representing EquivalentObjectProperties axiom.
         * @returns OWL/XML representation for the given axiom.
         */
        function writeEqOpropAxiom(axiom) {
            var arg,
                args = axiom.args,
                argCount = args.length,
                argIndex,
                owlXml = '<EquivalentObjectProperties>';
        
            for (argIndex = 0; argIndex < argCount; argIndex += 1) {
                arg = args[argIndex];

                if (arg && arg.type === exprTypes.ET_OPROP) {
                    owlXml += writeEntity(arg, 'ObjectProperty');
                } else {
                    throw 'Unrecognized type of expression found in the arguments of the ' +
                        'EquivalentObjectProperties axiom at the position ' + argIndex + '!';
                }
            }
        
            owlXml += '</EquivalentObjectProperties>';
            return owlXml;
        }

        /**
         * Returns an OWL/XML string representing the given OWL ObjectPropertyAssertion statement.
         *
         * @param assertion OWL ObjectPropertyAssertion statement.
         * @returns Fragment of OWL/XML representing the given statement.
         */
        function writeOpropAssertion(assertion) {
            return '<ObjectPropertyAssertion>' + 
                writeEntity(assertion.objectProperty, 'ObjectProperty') +
                writeEntity(assertion.leftIndividual, 'NamedIndividual') +
                writeEntity(assertion.rightIndividual, 'NamedIndividual') +
                '</ObjectPropertyAssertion>';
        }
        
        /**
         * Returns an OWL/XML string representing the given OWL ClassAssertion statement.
         *
         * @param assertion OWL ClassAssertion statement.
         * @returns Fragment of OWL/XML representing the given statement.
         */
        function writeClassAssertion(assertion) {
            return '<ClassAssertion>' +
                writeEntity(assertion.className, 'Class') +
                writeEntity(assertion.individual, 'NamedIndividual') +
                '<ClassAssertion>';
        }

        /**
         * Returns an OWL/XML string with the definition of the prefix with the given name and IRI.
         *
         * @param prefixName Name of the prefix.
         * @param prefixIri IRI of the prefix.
         * @returns Fragment of OWL/XML with the definition of the prefix.
         */
        function writePrefixDefinition(prefixName, prefixIri) {
            return '<Prefix name="' + prefixName + '" IRI="' + prefixIri + '"/>';
        }

        // MAIN BODY

        // We output prefixes first.
        for (prefixName in prefixes) {
            if (prefixes.hasOwnProperty(prefixName)) {
                owlXml += writePrefixDefinition(prefixName, prefixes[prefixName]);
            }
        }

        // And then output axioms/facts.
        for (axiomIndex = 0; axiomIndex < axiomCount; axiomIndex++) {
            axiom = axioms[axiomIndex];
        
            switch (axiom.type) {
            case exprTypes.AXIOM_CLASS_EQ:
                owlXml += writeClassAxiom(axiom, 'EquivalentClasses');
                break;
            case exprTypes.AXIOM_CLASS_SUB:
                owlXml += writeClassAxiom(axiom, 'SubClassOf');
                break;
            case exprTypes.AXIOM_OPROP_SUB:
                owlXml += writeOpropSubAxiom(axiom);
                break;
            case exprTypes.AXIOM_OPROP_EQ:
                owlXml += writeEqOpropAxiom(axiom);
                break;
            case exprTypes.FACT_CLASS:
                owlXml += writeClassAssertion(axiom);
                break;
            case exprTypes.FACT_OPROP:
                owlXml += writeOpropAssertion(axiom);
                break;
            default:
                throw 'Unknown type of the axiom!';
            }
        }
     
        owlXml += '</Ontology>';
        return owlXml;
    }
};

/** Represents a query to the RDF data. */
jsw.rdf.Query = function () {
    /** IRI to serve as a base of all IRI references in the query. */
    this.baseIri = null;
    /** Indicates that all non-unique matches should be eliminated from the results. */
    this.distinctResults = false;
    /** Number of results the query should return. */
    this.limit = 0;
    /** The number of a record to start returning results from. */
    this.offset = 0;
    /** Array of values to sort the query results by. */
    this.orderBy = [];
    /** An array containing all prefix definitions for the query. */
    this.prefixes = [];
    /** Indicates if some of the non-unique matches can be eliminated from the results. */
    this.reducedResults = false;
    /** An array of RDF triples which need to be matched. */
    this.triples = [];

    /**
     * Array containing the names of variables to return as a result of a query run. If the array is
     * empty, all variables in the query need to be returned.
     */
    this.variables = [];
};

/** Prototype for all jsw.rdf.Query objects. */
jsw.rdf.Query.prototype = {
    /** Defines constants by which different expressions can be distinguished in the query. */
    EXPR_TYPES: {
        VAR: 0,
        LITERAL: 1,
        IRI_REF: 2
    },

    /**
     * Adds the given prefix to the query. Throws an error if the prefix with the given name but 
     * different IRI has been defined already.
     *
     * @param prefixName Name of the prefix to add.
     * @param iri IRI associated with the prefix.
     */
    addPrefix: function (prefixName, iri) {
        var existingIri = this.getPrefixIri(prefixName);

        if (existingIri === null) {
            this.prefixes.push({
                'prefixName': prefixName,
                'iri': iri
            });
        } else if (iri !== existingIri) {
            throw 'The prefix "' + prefixName + '" has been defined already in the query!';
        }
    },

    /**
     * Adds an RDF triple which needs to be matched to the query.
     */
    addTriple: function (subject, predicate, object) {
        this.triples.push({
            'subject': subject,
            'predicate': predicate,
            'object': object
        });
    },

    /**
     * Returns IRI for the prefix with the given name in the query.
     *
     * @param prefixName Name of the prefix.
     * @returns IRI associated with the given prefix name in the query or null if no prefix with the
     * given name is defined.
     */
    getPrefixIri: function (prefixName) {
        var prefix,
            prefixes = this.prefixes,
            prefixIndex = prefixes.length - 1;

        if (prefixIndex < 0) {
            return null;
        }
        
        do {
            prefix = prefixes[prefixIndex];

            if (prefix.prefixName === prefixName) {
                return prefix.iri.value;
            }
        } while (prefixIndex--);

        return null;
    }
};

/**
 * An object which can be used to work with SPARQL queries.
 * 
 * The features currently not supported by the parser:
 *      - Proper relative IRI resolution;
 *      - Blank Nodes;
 *      - Comments;
 *      - Nested Graph Patterns;
 *      - FILTER expressions;
 *      - ORDER BY: expressions other than variables;
 *      - RDF Collections;
 *      - OPTIONAL patterns;
 *      - UNION of patterns;
 *      - FROM clause (and, hence, GRAPH clause and named graphs).
 */
jsw.sparql = {
    /** Defines data types of literals which can be parsed */
    DATA_TYPES: jsw.xsd.DATA_TYPES,
    /** Defines types of expressions which can be parsed */
    EXPR_TYPES: jsw.rdf.Query.prototype.EXPR_TYPES,

    /** Regular expression for SPARQL absolute IRI references. */
    absoluteIriRegExp: null, 
    /** Regular expression for SPARQL boolean literals. */
    boolRegExp: null,
    /** Regular expression for SPARQL decimal literals. */
    decimalRegExp: null,
    /** Regular expression for SPARQL double literals. */
    doubleRegExp: null,
    /** Regular expression for SPARQL integer literals. */
    intRegExp: null,
    /** Regular expression for SPARQL IRI references. */
    iriRegExp: null,
    /** Regular expression representing one of the values in the ORDER BY clause. */
    orderByValueRegExp: null,
    /** Regular expression for SPARQL prefixed names. */
    prefixedNameRegExp: null,
    /** Regular expression for SPARQL prefix name. */
    prefixRegExp: null,
    /** Regular expression for RDF literals. */
    rdfLiteralRegExp: null,
    /** Regular expression for SPARQL variables. */
    varRegExp: null,

    /**
     * Expands the given prefixed name into the IRI reference.
     *
     * @param prefix Prefix part of the name.
     * @param localName Local part of the name.
     * @returns IRI reference represented by the given prefix name.
     */
    expandPrefixedName: function (prefix, localName, query) {
        var iri;

        if (!prefix && !localName) {
            throw 'Can not expand the given prefixed name, since both prefix and local name are ' +
                'empty!';
        }

        prefix = prefix || '';
        localName = localName || '';
                
        iri = query.getPrefixIri(prefix);

        if (iri === null) {
            throw 'Prefix "' + prefix + '" has not been defined in the query!';
        }
                    
        return iri + localName;
    },

    /**
     * Initializes regular expressions used by parser.
     */
    init: function () {
        var pnCharsBase = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D" +
            "\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF" +
            "\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u10000-\\uEFFFF",
            pnCharsU = pnCharsBase + "_",
            pnChars = pnCharsU + "0-9\\-\\u00B7\\u0300-\\u036F\\u203F-\\u2040",
            pnNameNs = "([" + pnCharsBase + "][" + pnChars + ".]*[" + pnChars + "])?:",
            pnLocal = "([" + pnCharsU + "0-9](?:[" + pnChars + ".]*[" + pnChars + "])?)?",
            varRegExp = "[?$][" + pnCharsU + "0-9][" + pnCharsU + "0-9\\u00B7\\u0300-\\u036F" +
            "\\u203F-\\u2040]*",
            string = "'((?:[^\\x27\\x5C\\xA\\xD]|\\[tbnrf\\\"'])*)'|" +
            '"((?:[^\\x22\\x5C\\xA\\xD]|\\[tbnrf\\"\'])*)"|' + 
            '"""((?:(?:"|"")?(?:[^"\\]|\\[tbnrf\\"\']))*)"""|' + 
            "'''((?:(?:'|'')?(?:[^'\\]|\\[tbnrf\\\"']))*)'''",
            iriRef = '<[^-<>"{}|^`\\][\\x00-\\x20]*>',
            prefixedName = pnNameNs + pnLocal,
            exponent = '[eE][+-]?[0-9]+';

        this.absoluteIriRegExp = /^<\w*:\/\//; // TODO: This is not precise.
        this.boolRegExp = /^true$|^false$/i;
        this.intRegExp = /^(?:\+|-)?[0-9]+$/;
        this.decimalRegExp = /^(?:\+|-)?(?:[0-9]+\.[0-9]*|\.[0-9]+)$/;
        this.doubleRegExp = new RegExp('^(?:\\+|-)?(?:[0-9]+\\.[0-9]*' + exponent + '|\\.[0-9]+' +
            exponent + '|[0-9]+' + exponent + ')$');
        this.iriRegExp = new RegExp('^' + iriRef + '$');
        this.orderByValueRegExp = new RegExp('^(ASC|DESC)\\((' + varRegExp + ')\\)$|^' + varRegExp +
            '$', "i");
        this.prefixRegExp = new RegExp("^" + pnNameNs + "$");
        this.prefixedNameRegExp = new RegExp("^" + prefixedName + "$");
        this.rdfLiteralRegExp = new RegExp('^(?:' + string + ')(?:@([a-zA-Z]+(?:-[a-zA-Z0-9]+)*)|' +
            '\\^\\^(' + iriRef + ')|\\^\\^' + prefixedName + ')?$');
        this.varRegExp = new RegExp('^' + varRegExp + '$');
    },

    /**
     * Parses the given SPARQL string into the query. 
     * 
     * @param queryTxt SPARQL string to parse into the query.
     * @returns An object representing the query parsed.
     */
    parse: function (queryTxt) {
        var iri, object, predicate, prefix, query, subject, token, tokens, tokenCount, 
            tokenIndex, valueToRead, variable, vars;

        if (!queryTxt) {
            throw 'The query text is not specified!';
        }
        
        query = new jsw.rdf.Query();
        tokens = queryTxt.split(/\s+/);
        tokenCount = tokens.length;
        tokenIndex = 0;

        if (tokens[tokenIndex].toUpperCase() === 'BASE') {
            tokenIndex++;
            
            query.baseIri = this.parseAbsoluteIri(tokens[tokenIndex]);
            
            if (query.baseIri === null) {
                throw 'BASE statement does not contain a valid IRI reference!';
            }

            tokenIndex++;
        }

        // Read all PREFIX statements...
        while (tokenIndex < tokenCount) {
            token = tokens[tokenIndex];

            if (token.toUpperCase() !== 'PREFIX') {
                break;
            }

            tokenIndex++;

            if (tokenIndex === tokenCount) {
                throw 'Prefix name expected, but end of the query text found!';
            }

            prefix = this.parsePrefixName(tokens[tokenIndex]);

            if (prefix === null) {
                throw 'Token "' + token + '" does not represent a valid IRI prefix!';
            }

            tokenIndex++;
            
            if (tokenIndex === tokenCount) {
                throw 'Prefix IRI expected, but end of the query text found!';
            }

            iri = this.parseIriRef(tokens[tokenIndex], query);

            if (iri === null) {
                throw 'Incorrect format of the IRI encountered!';
            }

            query.addPrefix(prefix, iri);

            tokenIndex++;
        }
        
        // Parse SELECT clause.
        if (tokenIndex === tokenCount) {
            return query;
        } else if (token.toUpperCase() !== 'SELECT') {
            throw 'SELECT statement expected, but "' + token + '" was found!';
        }

        tokenIndex++;
        
        if (tokenIndex === tokenCount) {
            throw 'DISTINCT/REDUCED or variable declaration expected after "SELECT", but the end ' +
                'of query text was found!';
        }

        token = tokens[tokenIndex].toUpperCase();

        if (token === 'DISTINCT') {
            query.distinctResults = true;
            tokenIndex++;
        } else if (token === 'REDUCED') {
            query.reducedResults = true;
            tokenIndex++;
        }

        if (tokenIndex === tokenCount) {
            throw 'Variable declarations are expected after DISTINCT/REDUCED, but the end of ' +
                'the query text was found!';
        }

        token = tokens[tokenIndex];

        if (token === '*') {
            tokenIndex++;

            token = tokens[tokenIndex];
        } else {
            vars = [];

            // Parse SELECT variables.
            while (tokenIndex < tokenCount) {
                token = tokens[tokenIndex];

                if (token.toUpperCase() === 'WHERE' || token === '{') {
                    break;
                }

                variable = this.parseVar(token);
            
                if (variable) {
                    vars.push(variable);
                } else {
                    throw 'The token "' + token + '" does not represent the valid variable!';
                }

                tokenIndex++;
            }

            if (vars.length === 0) {
                throw 'No variable definitions found in the SELECT clause!';
            }

            query.variables = vars;
        }

        if (tokenIndex === tokenCount) {
            return query;
        } else if (token.toUpperCase() === 'WHERE') {
            if (tokens[tokenIndex + 1] === '{') {
                tokenIndex += 2; // Skip to the next token after '{'.    
            } else {
                throw 'WHERE clause should be surrounded with "{}"!';
            }
        } else if (token === '{') {
            tokenIndex++;
        } else {
            throw 'WHERE clause was expected, but "' + token + '" was found!';
        }

        // Parsing WHERE clause.
        valueToRead = 0;

        while (tokenIndex < tokenCount) {
            // TODO: Add parsing filters.
            token = tokens[tokenIndex];

            if (token === '}') {
                if (valueToRead === 0) {
                    break;
                } else {
                    throw 'RDF triple is not complete but the end of WHERE clause was found!';
                }
            }

            if (valueToRead === 0) {
                subject = this.parseVarOrTerm(token, query);

                if (subject === null) {
                    throw 'Subject variable or term was expected but "' + token + '" was found!';
                }

                tokenIndex++;
                valueToRead++;

                if (tokenIndex === tokenCount) {
                    throw 'Predicate of the RDF triple expected, reached the end of text instead!';
                }
            } else if (valueToRead === 1) {
                predicate = this.parseVerb(token, query);

                if (predicate === null) {
                    throw 'Predicate verb was expected but "' + token + '" was found!';
                }

                tokenIndex++;
                valueToRead++;

                if (tokenIndex === tokenCount) {
                    throw 'Object of the RDF triple expected, reached the end of text instead!';
                }
            } else if (valueToRead === 2) {
                object = this.parseVarOrTerm(token, query);

                if (object === null) {
                    throw 'Object variable or term was expected but "' + token + '" was found!';
                }

                query.addTriple(subject, predicate, object);

                valueToRead = 0;
                tokenIndex++;

                switch (tokens[tokenIndex]) {
                case '.':
                    valueToRead = 0;
                    tokenIndex++;
                    break;
                case ';':
                    valueToRead = 1;
                    tokenIndex++;
                    break;
                case ',':
                    valueToRead = 2;
                    tokenIndex++;
                    break;
                }
            }
        }

        if (tokenIndex === tokenCount) {
            throw '"}" expected but the end of query text found!';
        }

        tokenIndex++;

        if (tokenIndex === tokenCount) {
            return query;
        }
    
        if (tokens[tokenIndex].toUpperCase() === 'ORDER') {
            tokenIndex++;

            token = tokens[tokenIndex];

            if (token.toUpperCase() !== 'BY') {
                throw '"BY" expected after "ORDER", but "' + token + '" was found!';
            }

            tokenIndex++;

            while (tokenIndex < tokenCount) {
                token = tokens[tokenIndex];

                if (token.toUpperCase() === 'LIMIT' || token.toUpperCase() === 'OFFSET') {
                    break;
                }

                variable = this.parseOrderByValue(token);

                if (variable === null) {
                    throw 'Unknown token "' + token + '" was found in the ORDER BY clause!';
                }

                query.orderBy.push(variable);
                tokenIndex++;
            }
        }

        while (tokenIndex < tokenCount) {
            token = tokens[tokenIndex].toUpperCase();
            
            // Parse LIMIT clause.
            if (token === 'LIMIT') {
                tokenIndex++;

                if (tokenIndex === tokenCount) {
                    throw 'Integer expected after "LIMIT", but the end of query text found!';
                }

                token = tokens[tokenIndex];
                query.limit = parseInt(token, 10);

                if (isNaN(query.limit)) {
                    throw 'Integer expected after "LIMIT", but "' + token + '" found!';
                }

                tokenIndex++;
            } else if (token === 'OFFSET') {
                // Parse OFFSET clause.
                tokenIndex++;

                if (tokenIndex === tokenCount) {
                    throw 'Integer expected after "OFFSET", but the end of query text found!';
                }

                token = tokens[tokenIndex];
                query.offset = parseInt(token, 10);

                if (isNaN(query.offset)) {
                    throw 'Integer expected after "OFFSET", but "' + token + '" found!';
                }

                tokenIndex++;
            } else {
                throw 'Unexpected token "' + token + '" found!';
            }
        }

        return query;
    },

    /**
     * Parses the given string into the absolute IRI.
     *
     * @param token String containing the IRI.
     * @returns Absolute IRI parsed from the string or null if the given string does not represent
     * an absolute IRI.
     */
    parseAbsoluteIri: function (token) {
        if (!this.iriRegExp) {
            this.init();
        }

        if (this.iriRegExp.test(token) && this.absoluteIriRegExp.test(token)) {
            return token.substring(1, token.length - 1);
        } else {
            return null;
        }
    },

    /**
     * Parses the given string into the object representing an IRI.
     *
     * @param token String containing the IRI.
     * @param baseIri IRI to use for resolving relative IRIs.
     * @returns Object representing the IRI parsed or null if the given string does not represent an
     * IRI.
     */
    parseIriRef: function (token, baseIri) {
        var iriRef;

        if (!this.iriRegExp) {
            this.init();
        }

        if (!this.iriRegExp.test(token)) {
            return null;
        }
        
        if (!baseIri || this.absoluteIriRegExp.test(token)) {
            iriRef = token.substring(1, token.length - 1);
        } else {
            // TODO: This is very basic resolution!
            iriRef = baseIri + token.substring(1, token.length - 1);
        }

        return {
            'type': this.EXPR_TYPES.IRI_REF,
            'value': iriRef
        };
    },

    /**
     * Parses the given string into a literal.
     *
     * @param token String containing the literal.
     * @returns Literal parsed from the string or null if the token does not represent a valid
     * literal.
     */
    parseLiteral: function (token, query) {
        var dataTypeIri, localName, matches, matchIndex, prefix, value;

        if (!this.rdfLiteralRegExp) {
            this.init();
        }

        matches = token.match(this.rdfLiteralRegExp);

        if (matches) {
            for (matchIndex = 1; matchIndex <= 4; matchIndex++) {
                value = matches[matchIndex];

                if (value) {
                    break;
                }
            }

            dataTypeIri = matches[6] || null;

            if (!dataTypeIri) {
                prefix = matches[7] || '';
                localName = matches[8] || '';
                
                if (prefix !== '' || localName !== '') {
                    dataTypeIri = this.expandPrefixedName(prefix, localName, query);
                } else {
                    dataTypeIri = this.DATA_TYPES.STRING;
                }
            }

            return {
                'type': this.EXPR_TYPES.LITERAL,
                'value': value,
                'lang': matches[5] || null,
                'dataType': dataTypeIri
            };
        }

        if (this.intRegExp.test(token)) {
            return {
                'type': this.EXPR_TYPES.LITERAL,
                'value': token,
                'dataType': this.DATA_TYPES.INTEGER
            };
        }

        if (this.decimalRegExp.test(token)) {
            return {
                'type': this.EXPR_TYPES.LITERAL,
                'value': token,
                'dataType': this.DATA_TYPES.DECIMAL
            };
        }

        if (this.doubleRegExp.test(token)) {
            return {
                'type': this.EXPR_TYPES.LITERAL,
                'value': token,
                'dataType': this.DATA_TYPES.DOUBLE
            };
        }

        if (this.boolRegExp.test(token)) {
            return {
                'type': this.EXPR_TYPES.LITERAL,
                'value': token,
                'dataType': this.DATA_TYPES.BOOLEAN
            };
        }

        return null;
    },

    /**
     * Parses the given string into the object representing some value found in the order by clause.
     *
     * @param token String to parse.
     * @returns Object representing the order by value parsed or null if token does not reperesent
     * a valid order by value.
     */
    parseOrderByValue: function (token) {
        // TODO: support not only variables in ORDER BY.
        var match, prefix;

        if (!this.orderByValueRegExp) {
            this.init();
        }

        match = token.match(this.orderByValueRegExp);

        if (match) {
            prefix = match[1];

            if (!prefix) {
                return {
                    'type': this.EXPR_TYPES.VAR,
                    'value': match[0].substring(1), // remove the ? or $ in the variable
                    'order': 'ASC'
                };
            }

            return {
                'type': this.EXPR_TYPES.VAR,
                'value': match[2].substring(1), // remove the ? or $ in the variable
                'order': match[1].toUpperCase()
            };
        }

        return null;
    },

    /**
     * Parses the given string into the IRI, assuming that it is a prefixed name.
     *
     * @param token String containing prefixed name.
     * @param query Query object with defined prefixes, which can be used for name expansion.
     * @returns Object representing the prefixed name parsed or null if the token is not a prefixed
     * name.
     */
    parsePrefixedName: function (token, query) {
        var match;

        if (!this.prefixedNameRegExp) {
            this.init();
        }
        
        match = token.match(this.prefixedNameRegExp);

        if (!match) {
            return null;
        }

        return {
            'type': this.EXPR_TYPES.IRI_REF,
            'value': this.expandPrefixedName(match[1], match[2], query)
        };
    },

    /**
     * Parses the given string into the string representing the prefix name.
     *
     * @param token String containing the prefix name.
     * @returns Prefix name parsed or null if the given string does not contain a prefix name.
     */
    parsePrefixName: function (token) {
        if (!this.prefixRegExp) {
            this.init();
        }

        return (this.prefixRegExp.test(token)) ? token.substring(0, token.length - 1) : null;
    },

    /**
     * Returns a SPARQL variable or term represented by the given string.
     *
     * @param token String to parse into the variable or term.
     * @param query Reference to the query for which the variable or term is parsed.
     * @returns Object representing the variable or a term parsed.
     */
    parseVarOrTerm: function (token, query) {
        // See if it is a variable.
        var value = this.parseVar(token);
        
        if (value) {
            return value;
        }

        // See if it is an IRI reference.
        value = this.parseIriRef(token, query.baseIri);

        if (value) {
            return value;
        }

        // See if it is a prefixed name.
        value = this.parsePrefixedName(token, query);

        if (value) {
            return value;
        }

        // See if it is a literal.
        value = this.parseLiteral(token, query);
        
        if (value) {
            return value;
        }

        return null;
    },

    /**
     * Parses a token into the variable.
     *
     * @param token Contains the text representing SPARQL variable.
     * @returns Object representing the SPARQL variable, or null if the given token does not
     * represent a valid SPARQL variable.
     */
    parseVar: function (token) {
        if (this.varRegExp === null) {
            this.init();
        }        
        
        if (!this.varRegExp.test(token)) {
            return null;
        }

        return {
            'type': this.EXPR_TYPES.VAR,
            'value': token.substring(1) // Skip the initial '?' or '$'
        };
    },

    /**
     * Parses a token into the SPARQL verb.
     *
     * @param token String containing a SPARQL verb.
     * @param query Reference to the query for which the variable or term is parsed.
     * @returns Object representing the SPARQL verb, or null if the given token does not represent a
     * valid SPARQL verb.
     */
    parseVerb: function (token, query) {
        // See if it is a variable.
        var value = this.parseVar(token);
        
        if (value) {
            return value;
        }

        // See if it is an IRI reference.
        value = this.parseIriRef(token, query.baseIri);

        if (value) {
            return value;
        }

        // See if it is a prefixed name.
        value = this.parsePrefixedName(token, query);

        if (value) {
            return value;
        }

        if (token === 'a') {
            return {
                'type': this.EXPR_TYPES.IRI_REF,
                'value':  jsw.rdf.IRIS.TYPE
            };
        }

        return null;
    }
};

/** Allows to work with SQL representation of queries against RDF data. */
jsw.sql = {
    /**
     * Returns an SQL representation of the given RDF query. It is assumed that all class assertions
     * are stored in one table and all object property assertions in another one.
     *
     * @param query jsw.rdf.Query to return the SQL representation for.
     * @param classAssertionTable Name of the table where all class assertions are stored.
     * @param opropAssertionTable Name of the table where all object property assertions are stored.
     * @returns SQL representation of the given RDF query.
     */
    write: function (query, classAssertionTable, opropAssertionTable) {
        var from, limit, objectField, orderBy, predicate, predicateType, predicateValue, rdfTypeIri,
            select, subjectField, table, triple, triples, tripleCount, tripleIndex, exprTypes,
            variable, vars, varCount, varField, varFields, varIndex, where;

        from = '';
        where = '';
        rdfTypeIri = jsw.rdf.IRIS.TYPE;
        exprTypes = jsw.rdf.Query.prototype.EXPR_TYPES;
        varFields = {};

        /** Appends a condition to the where clause based on the given expression.
         *
         * @param expr Expression to use for constructing a condition.
         * @param table Name of the table corresponding to the expression.
         * @param field Name of the field corresponding to the expression.
         */
        function writeExprCondition(expr, table, field) {
            var type = expr.type,
                value = expr.value,
                varField;

            if (type === exprTypes.IRI_REF) {
                where += table + '.' + field + "=='" + value + "' AND ";
            } else if (type === exprTypes.VAR) {
                varField = varFields[value];

                if (varField) {
                    where += table + '.' + field + '==' + varField + ' AND ';
                } else {
                    varFields[value] = table + '.' + field;
                }
            } else if (type === exprTypes.LITERAL) {
                throw 'Literal expressions in RDF queries are not supported by the library yet!';
            } else {
                throw 'Unknown type of expression found in the RDF query: ' + subjectType + '!';
            }
        }
        
        triples = query.triples;
        tripleCount = triples.length;

        for (tripleIndex = 0; tripleIndex < tripleCount; tripleIndex++) {
            triple = triples[tripleIndex];

            predicate = triple.predicate;
            predicateType = predicate.type;
            predicateValue = predicate.value;
            subjectField = 'leftIndividual';
            objectField = 'rightIndividual';
            table = 't' + tripleIndex;

            if (predicateType === exprTypes.IRI_REF) {
                if (predicateValue === rdfTypeIri) {
                    from += classAssertionTable + ' AS ' + table + ', ';
                    subjectField = 'individual';
                    objectField = 'className';
                } else {
                    from += opropAssertionTable + ' AS ' + table + ', ';
                    where += table + ".objectProperty=='" + predicateValue + "' AND ";
                }
            } else if (predicateType === exprTypes.VAR) {
                from += opropAssertionTable + ' AS ' + table + ', ';
                varField = varFields[predicateValue];

                if (varField) {
                    where += table + '.objectProperty==' + varField + ' AND ';
                } else {
                    varFields[predicateValue] = table + '.objectProperty';
                }
            } else {
                throw 'Unknown type of a predicate expression: ' + predicateType + '!';
            }

            writeExprCondition(triple.subject, table, subjectField);
            writeExprCondition(triple.object, table, objectField);
        }

        if (tripleCount > 0) {
            from = ' FROM ' + from.substring(0, from.length - 2);
        }

        if (where.length > 0) {
            where = ' WHERE ' + where.substring(0, where.length - 5);
        }

        select = '';
        vars = query.variables;
        varCount = vars.length;

        if (varCount > 0) {
            for (varIndex = 0; varIndex < varCount; varIndex++) {
                variable = vars[varIndex].value;
                varField = varFields[variable];

                if (varField) {
                    select += varField + ' AS ' + variable + ', ';
                } else {
                    select += "'' AS " + variable + ', ';
                }
            }
        } else {
            for (variable in varFields) {
                if (varFields.hasOwnProperty(variable)) {
                    select += varFields[variable] + ' AS ' + variable + ', ';
                }
            }
        }

        if (select.length > 0) {
            select = select.substring(0, select.length - 2);
        } else {
            throw 'The given RDF query is in the wrong format!';
        } 

        if (query.distinctResults) {
            select = 'SELECT DISTINCT ' + select;
        } else {
            select = 'SELECT ' + select;
        }

        orderBy = '';
        vars = query.orderBy;
        varCount = vars.length;

        for (varIndex = 0; varIndex < varCount; varIndex++) {
            variable = vars[varIndex];

            if (variable.type != exprTypes.VAR) {
                throw 'Unknown type of expression found in ORDER BY: ' + variable.type + '!';
            }

            orderBy += variable.value + ' ' + variable.order + ', ';
        }

        if (varCount > 0) {
            orderBy = ' ORDER BY ' + orderBy.substring(0, orderBy.length - 2);
        }

        limit = '';

        if (query.limit !== 0) {
            limit = ' LIMIT ' + query.limit;
            if (query.offset !== 0) {
                limit += ', ' + query.offset;
            }
        } else if (query.offset !== 0) {
            limit = ' LIMIT 0, ' + query.offset;
        }

        return select + from + where + orderBy + limit;
    }
};

/**
 * An object representing an OWL-EL reasoner. Currently, it has some limitations and does not allow
 * reasoning on full EL++, but it does cover EL+ and its minor extensions.
 */
jsw.owl.Reasoner = function (ontology) {  
    var clock, normalizedOntology, objectPropertySubsumers;
    
    /**
     * Stores information about how much time different steps of building a 
     * reasoner took.
     */
    this.timeInfo = {};
    
    /**
     * Original ontology from which the reasoner was built.
     */
    this.originalOntology = ontology;
   
    /**
     * Class subsumption relation for the ontology.
     */
    this.classSubsumers = null;
    
    /**
     * Rewritten A-Box of the ontology.
     */
    this.aBox = null;
   
    clock = new jsw.util.Stopwatch();

    clock.start();
    normalizedOntology = this.normalizeOntology(ontology);
    this.timeInfo.normalization = clock.stop(); 
   
    clock.start();
    objectPropertySubsumers = this.buildObjectPropertySubsumerSets(normalizedOntology);
    this.timeInfo.objectPropertySubsumption = clock.stop();
   
    clock.start();
    this.classSubsumers = this.buildClassSubsumerSets(normalizedOntology, objectPropertySubsumers);
    this.timeInfo.classification = clock.stop();
   
    clock.start();
    this.aBox = this.rewriteAbox(normalizedOntology, objectPropertySubsumers);
    this.timeInfo.aBoxRewriting = clock.stop();
};

/** Prototype for all jsw.owl.Reasoner objects. */
jsw.owl.Reasoner.prototype = {
    /** The object which can be used to send queries against ABoxes. */
    queryLang: TrimPath.makeQueryLang({
        ClassAssertion          : { individual      : { type: 'String' },
                                    className       : { type: 'String' }},
        ObjectPropertyAssertion : { objectProperty  : { type: 'String' },
                                    leftIndividual  : { type: 'String' },
                                    rightIndividual : { type: 'String' }}
    }),

    /**
     * Builds an object property subsumption relation implied by the ontology.
     * 
     * @param ontology Normalized ontology to be use for building the subsumption relation. 
     * @returns 2-tuple storage hashing the object property subsumption relation implied by the 
     * ontology.
     */
    buildObjectPropertySubsumerSets: function (ontology) {
        var axiom, axioms, axiomIndex, exprTypes, objectProperties, objectProperty, 
            objectPropertySubsumers, opropType, reqAxiomType, queue, subsumer, subsumers;
      
        objectPropertySubsumers = new jsw.util.PairStorage();
        objectProperties = ontology.getObjectProperties();

        for (objectProperty in objectProperties) {
            if (objectProperties.hasOwnProperty(objectProperty)) {
                // Every object property is a subsumer for itself.
                objectPropertySubsumers.add(objectProperty, objectProperty);
            }
        }
      
        axioms = ontology.axioms;
        axiomIndex = axioms.length - 1;

        if (axiomIndex < 0) {
            // No axioms in the ontology - nothing to do.
            return objectPropertySubsumers;
        }

        exprTypes = jsw.owl.EXPRESSION_TYPES;
        opropType = exprTypes.ET_OPROP;
        reqAxiomType = exprTypes.AXIOM_OPROP_SUB;

        // Add object property subsumptions explicitly mentioned in the ontology.
        do {
            axiom = axioms[axiomIndex];
         
            if (axiom.type !== reqAxiomType || axiom.arg1.type !== opropType) {
                continue;
            }
         
            objectPropertySubsumers.add(axiom.arg1.IRI, axiom.arg2.IRI);
        } while (axiomIndex--);

        queue = new jsw.util.Queue();

        for (objectProperty in objectProperties) {
            if (!objectProperties.hasOwnProperty(objectProperty)) {
                continue;
            }
        
            subsumers = objectPropertySubsumers.get(objectProperty);
        
            for (subsumer in subsumers) {
                if (subsumers.hasOwnProperty(subsumer)) {
                    queue.enqueue(subsumer);
                }
            }
         
            // Discover implicit subsumptions via intermediate object properties.
            while (!queue.isEmpty()) {
                subsumers = objectPropertySubsumers.get(queue.dequeue());
                
                for (subsumer in subsumers) {
                    if (subsumers.hasOwnProperty(subsumer)) {
                        // If the objectProperty has subsumer added in its subsumer set, then that
                        // subsumer either was processed already or has been added to the queue - no
                        // need to process it for the second time.
                        if (!objectPropertySubsumers.exists(objectProperty, subsumer)) {
                            objectPropertySubsumers.add(objectProperty, subsumer);
                            queue.enqueue(subsumer);
                        }
                    }
                }
            }
        }
      
        return objectPropertySubsumers;
    },
   
    /**
     * Builds a class subsumption relation implied by the ontology.
     * 
     * @param ontology Ontology to use for building subsumer sets. The ontology has to be
     * normalized.
     * @param objectPropertySubsumers 2-tuple storage hashing the object property subsumption
     * relation implied by the ontology. 
     * @returns 2-tuple storage containing the class subsumption relation implied by the ontology.
     */
    buildClassSubsumerSets: function (ontology, objectPropertySubsumers) {
        var axioms = ontology.axioms,
            axiomCount = axioms.length,           
            // Provides quick access to axioms like r o s <= q.
            chainSubsumers = this.buildChainSubsumerSets(ontology),     
            // Stores labels for each node.
            classSubsumers = new jsw.util.PairStorage(),
            // Stores labels for each edge.
            edgeLabels = new jsw.util.TripletStorage(),
            exprTypes = jsw.owl.EXPRESSION_TYPES, // Cash the constants.
            instruction,
            leftChainSubsumers = chainSubsumers.left,
            node,
            queue,
            queues = {},
            rightChainSubsumers = chainSubsumers.right,
            someInstructionFound;
      
        /**
         * Checks if the given axiom is in the form
         * 
         * A1 n A2 n ... n A n ... n An <= C, n >= 0
         * 
         * where A is the given class and Ai, C are atomic classes. 
         * 
         * @param axiom Axiom to check.
         * @param classIri Class to look for in the left part of the axiom.
         * @returns True if the axiom is in the required form, false otherwise.
         */
        function canUseForLabelNodeInstruction(axiom, classIri) {
            var classes, classIndex, firstArg, firstArgType;

            if (axiom.type !== exprTypes.AXIOM_CLASS_SUB) {
                return false;
            }

            firstArg = axiom.args[0];
            firstArgType = firstArg.type;
         
            if (firstArgType === exprTypes.ET_CLASS && firstArg.IRI === classIri) {
                return true;
            } else if (firstArgType !== exprTypes.CE_INTERSECT) {
                return false;
            }
            
            classes = firstArg.args;
            classIndex = classes.length - 1;
            
            do {
                // Could use binary search here, since classes is sorted. BUT usually there are not
                // many elements in classes array and binary search proves less efficient.
                if (classes[classIndex].IRI === classIri) {
                    return true;
                }
            } while (classIndex--);
         
            return false;
        }
      
        /**
         * Adds instructions 
         * 
         * 'Label B as C if it is labeled A1, A2, ..., Am already' 
         * 
         * to the queue of B for all axioms like
         * 
         * A1 n A2 n ... n A n ... n Am <= C.
         * 
         * @param A IRI of the class to look for in the left part of axioms.
         * @param B IRI of the class to add instructions to.
         */
        function addLabelNodeIfInstructions(a, b) {
            var axiom, allAxioms, args, axiomIndex, classes, classIndex, classIri, firstArg,
                intersectType, newClassIndex, reqLabels;
            
            intersectType = exprTypes.CE_INTERSECT;
            allAxioms = axioms;
            axiomIndex = axiomCount - 1;        

            do {
                axiom = allAxioms[axiomIndex];
   
                if (!canUseForLabelNodeInstruction(axiom, a)) {
                    continue;
                }
                
                reqLabels = null;
                args = axiom.args;
                firstArg = args[0]; 
            
                if (firstArg.type === intersectType) {
                    classes = firstArg.args;
                    // classes.length > 0, since otherwise exception would be thrown in 
                    // canUseForLabelNodeInstruction.
                    classIndex = classes.length - 1;
                    newClassIndex = classIndex - 1;
                    reqLabels = {};
                    
                    do {
                        classIri = classes[classIndex].IRI;
                  
                        if (classIri !== a) {
                            reqLabels[classIri] = true;
                        }
                    } while (classIndex--);
                }
            
                queues[b].enqueue({
                    'type': 0, 
                    'node': b,
                    'label': args[1].IRI, 
                    'reqLabels': reqLabels
                });
            } while (axiomIndex--);
        }
      
        /**
         * Adds instructions 
         * 
         * 'Label B with C' 
         * 
         * to the queue of B for all axioms like
         * 
         * E P.A <= C.
         * 
         * @param p IRI of the object property to look for in axioms.
         * @param a IRI of the class to look for in the left part of axioms.
         * @param b IRI of the class to add instructions to.
         */
        function addLabelNodeInstructions(p, a, b) {
            var allAxioms, args, axiom, axiomIndex, classExpr, classType, firstArg, oprop,
                opropType, reqAxiomType, reqExprType;

            classType = exprTypes.ET_CLASS;
            opropType = exprTypes.ET_OPROP;
            reqAxiomType = exprTypes.AXIOM_CLASS_SUB;
            reqExprType = exprTypes.CE_OBJ_VALUES_FROM;
            allAxioms = axioms;
            axiomIndex = axiomCount - 1;
        
            do {
                axiom = allAxioms[axiomIndex];
            
                if (axiom.type !== reqAxiomType) {
                    continue;
                }
                
                args = axiom.args;
                firstArg = args[0];
         
                if (!firstArg || firstArg.type !== reqExprType) {
                    continue;
                }

                oprop = firstArg.opropExpr;
                classExpr = firstArg.classExpr;
                
                if (oprop.type === opropType && oprop.IRI === p && classExpr.type === classType && 
                        classExpr.IRI === a) {
                    queues[b].enqueue({
                        'type': 0,
                        'node': b,
                        'label': args[1].IRI
                    });
                }
            } while (axiomIndex--);
        }
      
        /**
         * Adds instructions 
         * 
         * 'Label the edge (B, C) as P' 
         * 
         * to the queue of B for all axioms like
         * 
         * A <= E P.C
         * 
         * @param A IRI of the class to look for in the left part of axioms.
         * @param B IRI of the class to add instructions to.
         */
        function addLabelEdgeInstructions(a, b) {
            var allAxioms, args, axiom, axiomIndex, classType, firstArg, reqAxiomType, reqExprType,
                secondArg;

            classType = exprTypes.ET_CLASS;
            reqAxiomType = exprTypes.AXIOM_CLASS_SUB;
            reqExprType = exprTypes.CE_OBJ_VALUES_FROM;
            allAxioms = axioms;
            axiomIndex = axiomCount - 1;

            do {
                axiom = allAxioms[axiomIndex];
            
                if (!axiom.args) {
                    continue;
                }
            
                args = axiom.args;
                firstArg = args[0];
                secondArg = args[1];
         
                if (axiom.type !== reqAxiomType || !firstArg || firstArg.type !== classType || 
                        firstArg.IRI !== a || !secondArg || secondArg.type !== reqExprType) {
                    continue;
                }
            
                queues[b].enqueue({
                    'type': 1,
                    'node1': b, // IRI of te source node of the edge.
                    'node2': secondArg.classExpr.IRI, // IRI of the destination node of the edge.
                    'label': secondArg.opropExpr.IRI // IRI of the label to add to the edge.
                });
            } while (axiomIndex--);
        }
      
        /**
         * Adds instructions to the queue of class B for axioms involving class A.
         * 
         * @param a IRI of the class to look for in axioms.
         * @param b IRI of the class to add instructions for.
         */
        function addInstructions(a, b) {
            addLabelNodeIfInstructions(a, b);
            addLabelEdgeInstructions(a, b);
        }
      
        /**
         * Initialises a single node of the graph before the subsumption algorithm is run.
         *
         * @param classIri IRI of the class to initialize a node for.
         */
        function initialiseNode(classIri) {
            // Every class is a subsumer for itself.
            classSubsumers.add(classIri, classIri);
         
            // Initialise an instruction queue for the node.
            queues[classIri] = new jsw.util.Queue();
         
            // Add any initial instructions about the class to the queue.
            addInstructions(classIri, classIri);
        }
      
        /**
         * Initialises data structures before the subsumption algorithm is run.
         */
        function initialise() {
            var classes = ontology.getClasses(),
                classIri,
                thing = jsw.owl.IRIS.THING;
            
            // Create a node for Thing (superclass).
            initialiseNode(thing);
         
            for (classIri in classes) {
                if (classes.hasOwnProperty(classIri)) {
                    // Create a node for each class in the Ontology.
                    initialiseNode(classIri);
            
                    // Mark Thing as a subsumer of the class.
                    classSubsumers.add(classIri, thing);   
   
                    // All axioms about Thing should also be true for any class.
                    addInstructions(thing, classIri);
                }
            }
        }

        /**
         * Processes an instruction to add a new edge.
         *
         * @param node1 The source node of the edge.
         * @param node2 The destination node of the edge.
         * @param label Label to use for the edge.
         */
        function processNewEdge(a, b, p) {
            var bSubsumers, c, classes, edges, lChainSubsumers, q, r, rChainSubsumers, s;

            classes = classSubsumers.get();
            edges = edgeLabels;
            bSubsumers = classSubsumers.get(b);
            lChainSubsumers = leftChainSubsumers;
            rChainSubsumers = rightChainSubsumers;

            // For all subsumers of object property P, including P itself.
            for (q in objectPropertySubsumers.get(p)) {  
                // Add q as a label between node1 and node2.
                edges.add(a, b, q);
         
                // Since we discovered that A <= E Q.B, we know that A <= E Q.C, where C is any
                // subsumer of B. We therefore need to look for new subsumers D of A by checking
                // all axioms like form E Q.C <= D.
                for (c in bSubsumers) {
                    addLabelNodeInstructions(q, c, a);
                }
               
                // We want to take care of object property chains. We now know that Q: A -> B.
                // If there is another property R: C -> A for some class C and property S, such that
                // R o Q <= S, we want to label edge (C, B) with S.
                for (r in rChainSubsumers.get(q)) {
                    for (s in rChainSubsumers.get(q, r)) {
                        for (c in classes) {
                            if (edges.exists(c, a, r) && !edges.exists(c, b, s)) {
                                processNewEdge(c, b, s);
                            }
                        }
                    }
                }
            
                // We want to take care of object property chains. We now know that Q: A -> B. 
                // If there is another property R: B -> C for some class C and property S, such that
                // Q o R <= S, we want to label edge (A, C) with S.
                for (r in lChainSubsumers.get(q)) {
                    for (s in lChainSubsumers.get(q, r)) {
                        for (c in classes) {
                            if (edges.exists(b, c, r) && !edges.exists(a, c, s)) {
                                processNewEdge(a, c, s);
                            }
                        }
                    }
                }
            }
        }

        /**
         * Processes the given Label Edge instruction.
         *
         * @param instruction Label Edge instruction to process.
         */
        function processLabelEdgeInstruction(instruction) {
            var p = instruction.label,
                a = instruction.node1,  
                b = instruction.node2;

            // If the label exists already, no need to process the instruction.
            if (edgeLabels.exists(a, b, p)) {
                processNewEdge(a, b, p);
            }
        }
    
        /**
         * Processes the given Label Node instruction.
         *
         * @param instruction Label Node instruction to process.
         */
        function processLabelNodeInstruction(instruction) { 
            var a, b, c, edges, p, subsumers;

            a = instruction.node;
            b = instruction.label;
            edges = edgeLabels;
            subsumers = classSubsumers;
                       
            if (subsumers.exists(a, b) || !subsumers.existAll(a, instruction.reqLabels)) {
                // The node is not labeled with all required labels yet or it has been labeled
                // with the new label already - there is no point to process the operation anyway.
                return;
            }
         
            // Otherwise, add a label to the node. 
            subsumers.add(a, b);
         
            // Since B is a new discovered subsumer of A, all axioms about B apply to A as well - 
            // we need to update node instruction queue accordingly.
            addLabelNodeIfInstructions(b, a);
         
            // We have discovered a new information about A, so we need to update all other nodes
            // linked to it.
            for (c in edges.get()) {
                for (p in edges.get(c, a)) {
                    // For all C <= E P.A, we now know that C <= E P.B. And therefore C should have
                    // the same subsumers as E P.B.
                    addLabelNodeInstructions(p, b, c);
                }
            }
        }
      
        // Initialise queues and labels.
        initialise();
      
        do { 
            someInstructionFound = false;
         
            // Get a queue which is not empty.
            for (node in queues) {
                queue = queues[node];
            
                if (!queue.isEmpty()) {
                    // Process the oldest instruction in the queue.
                    instruction = queue.dequeue();

                    switch (instruction.type) {
                    case 0:
                        processLabelNodeInstruction(instruction);
                        break;
                    case 1:
                        processLabelEdgeInstruction(instruction);
                        break;
                    default:
                        throw 'Unrecognized type of instruction found in the queue!';
                    }

                    someInstructionFound = true;
                    break;
                }
            }
        } while (someInstructionFound);
      
        return classSubsumers;
    },

    /**
     * Creates an object which hashes axioms like r o s <= q, so that all axioms related to either
     * q or s can be obtained efficiently.
     * 
     * @param ontology Normalized ontology containing the axioms to hash.
     * @returns Object hashing all object property chain subsumptions.
     */
    buildChainSubsumerSets: function (ontology) {
        var args, axiom, axioms, axiomIndex, chainSubsumer, exprTypes, leftSubsumers, leftOprop,
            opropChainType, reqAxiomType, rightOprop, rightSubsumers;
      
        axioms = ontology.axioms;
        axiomIndex = axioms.length - 1;
        
        leftSubsumers = new jsw.util.TripletStorage();
        rightSubsumers = new jsw.util.TripletStorage();

        if (axiomIndex < 0) {
            return {
                'left': leftSubsumers,
                'right': rightSubsumers
            };
        }

        exprTypes = jsw.owl.EXPRESSION_TYPES;
        reqAxiomType = exprTypes.AXIOM_OPROP_SUB;
        opropChainType = exprTypes.OPE_CHAIN;

        do {
            axiom = axioms[axiomIndex];
               
	        if (axiom.type !== reqAxiomType || axiom.arg1.type !== opropChainType) {
                continue;
	        }
               
            args = axiom.arg1.args;
	        leftOprop = args[0].IRI;
	        rightOprop = args[1].IRI;
	        chainSubsumer = axiom.arg2.IRI;
         
            leftSubsumers.add(leftOprop, rightOprop, chainSubsumer);
            rightSubsumers.add(rightOprop, leftOprop, chainSubsumer);
        } while (axiomIndex--);
      
        return {
            'left': leftSubsumers,
            'right': rightSubsumers
        };
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
    rewriteAbox: function (ontology, objectPropertySubsumers) {
        var axioms = ontology.axioms,
            exprTypes = jsw.owl.EXPRESSION_TYPES,
            lastAxiomIndex = axioms.length - 1,
            originalOntology = this.originalOntology,
            reasoner = this;
      
        /**
         * Puts class assertions implied by the ontology into the database.
         * rewriteAbox
         * @returns Array containing all class assertions implied by the ontology. 
         */
        function rewriteClassAssertions() {
            var assertions, axiom, axiomIndex, classFactType, classIri, individualClasses,
                individualIri, subsumerIri, subsumerSets;

            if (lastAxiomIndex < 0) {
                return [];
            }

            axiomIndex = lastAxiomIndex;
            individualClasses = new jsw.util.PairStorage();
            subsumerSets = reasoner.classSubsumers; 

            classFactType = exprTypes.FACT_CLASS;

            do {
                axiom = axioms[axiomIndex];
         
                if (axiom.type !== classFactType) {
                    continue;
                }
            
                individualIri = axiom.individual.IRI;
                classIri = axiom.classExpr.IRI;
            
                for (subsumerIri in subsumerSets.get(classIri)) {
                    if (originalOntology.containsClass(subsumerIri)) {
                        individualClasses.add(individualIri, subsumerIri);
                    }                
                }
            } while (axiomIndex--);
         
            assertions = [];

            // Put class assertions into the database.
            for (individualIri in individualClasses.get()) {
                for (classIri in individualClasses.get(individualIri)) {
                    assertions.push({
                        individual: individualIri,
                        className: classIri
                    });
                }
            }
         
            return assertions;
        }
      
        /** 
         * Puts role assertions implied by the ontology into the database.
         *
         * @returns Array containing all object property assertions implied by the ontology.
         */
        function rewriteObjectPropertyAssertions() {
            var args, assertions, axiom, axiomIndex, centerInd, chainSubsumer, changesHappened, 
                opropSubsumer, leftInd, leftOprop, oprop, opropType, reqAxiomType, reqExprType,
                rightInd, rightOprop, subsumers, storage;
            
            if (lastAxiomIndex < 0) {
                return [];
            }

            subsumers = objectPropertySubsumers;
            storage = new jsw.util.TripletStorage();
            opropType = exprTypes.FACT_OPROP;
            axiomIndex = lastAxiomIndex;

            do {
                axiom = axioms[axiomIndex];
         
                if (axiom.type !== opropType) {
                    continue;
                }
            
                leftInd = axiom.leftIndividual.IRI;
                rightInd = axiom.rightIndividual.IRI;
                oprop = axiom.objectProperty.IRI;
            
                for (opropSubsumer in subsumers.get(oprop)) {
                    storage.add(opropSubsumer, leftInd, rightInd);
                }
            } while (axiomIndex--);
         
            reqAxiomType = exprTypes.AXIOM_OPROP_SUB;
            reqExprType = exprTypes.OPE_CHAIN;

            do {
                changesHappened = false;
                axiomIndex = lastAxiomIndex;
            
                do {
                    axiom = ontology.axioms[axiomIndex];
               
                    if (axiom.type !== reqAxiomType || axiom.arg1.type !== reqExprType) {
                        continue;
                    }
               
                    args = axiom.arg1.args;
                    leftOprop = args[0].IRI;
                    rightOprop = args[1].IRI;
                    chainSubsumer = axiom.arg2.IRI;
               
                    for (leftInd in storage.get(leftOprop)) {
                        for (centerInd in storage.get(leftOprop, leftInd)) {
                            for (rightInd in storage.get(rightOprop, centerInd)) {
                                for (opropSubsumer in subsumers.get(chainSubsumer)) {
                                    if (!storage.exists(opropSubsumer, leftInd, rightInd)) {
	                                    storage.add(opropSubsumer, leftInd, rightInd);
	                                    changesHappened = true;
	                                }
                                }
                            }
                        }
	                }
                } while (axiomIndex--);
            } while (changesHappened);
         
            assertions = [];

            // Put object property assertions into the database.
            for (oprop in storage.get()) {
                if (!originalOntology.containsObjectProperty(oprop)) {
                    continue;
                }
            
                for (leftInd in storage.get(oprop)) {
                    for (rightInd in storage.get(oprop, leftInd)) {
                        assertions.push({
                            'objectProperty': oprop,
                            'leftIndividual': leftInd,
                            'rightIndividual': rightInd
                        });
                    }
                }
            }
         
            return assertions;
        }
      
        return {
            ClassAssertion: rewriteClassAssertions(),
	        ObjectPropertyAssertion: rewriteObjectPropertyAssertions()
	    };
    },

    /**
     * Checks if the given class is the subclass of another class.
     *
     * @param class1 IRI of one class.
     * @param class2 IRI of another class.
     * @returns True if class1 is a subclass of class2, false otherwise. 
     */
    isSubclass: function (class1, class2) {
        var classes = this.originalOntology.getClasses();
      
        if (!classes[class1]) {
            throw 'The ontology does not contain a class \'' + class1 + '\'';
        }
      
        if (!classes[class2]) {
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
    answerQuery: function (query) {
        var sql;

        if (!query) {
            throw 'The query is not specified!'; 
        }

        sql = jsw.sql.write(query, 'ClassAssertion', 'ObjectPropertyAssertion');

        return this.queryLang.parseSQL(sql).filter(this.aBox);
    },
   
    /**
     * Normalizes the given ontology.
     * 
     * @returns New ontology which is a normalized version of the given one.
     */
    normalizeOntology: function (ontology) {  
        var axiom, axioms, axiomIndex, lastRuleIndex, queue, exprTypes, resultAxioms,
            resultOntology, rules, ruleIndex;
      
        /**
         * Copies all entities from the source ontology to the result ontology.
         */
        function copyEntities() {
            var entities, entitiesOfType, entityIri, entityType;
    
            entities = ontology.entities;

            for (entityType in entities) {
                if (entities.hasOwnProperty(entityType)) {
                    entitiesOfType = entities[entityType];
         
                    for (entityIri in entitiesOfType) {
                        if (entitiesOfType.hasOwnProperty(entityIri)) {
                            resultOntology.entities[entityType][entityIri] = 
                                entitiesOfType[entityIri];
                        }
                    }
                }
            }
        }

        axioms = ontology.axioms;
        exprTypes = jsw.owl.EXPRESSION_TYPES;
        resultOntology = new jsw.owl.Ontology();

        rules = [
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
             * null if the rule could not be applied.
             */
            function (axiom) {
                var lastOpropIndex, newOprop, normalized, opropChainType, opropIndex, opropType,
                    prevOprop, reqAxiomType, srcChain;
         
                opropChainType = exprTypes.OPE_CHAIN;
                reqAxiomType = exprTypes.AXIOM_OPROP_SUB;

                if (axiom.type !== reqAxiomType || axiom.arg1.type !== opropChainType ||
                        axiom.arg1.args.length <= 2) {
                    return null;
                }

                opropType = exprTypes.ET_OPROP;       
                prevOprop = resultOntology.createEntity(opropType);
                srcChain = axiom.arg1.args; 
         
                normalized = [{
                    type: reqAxiomType,
                    arg1: {
                        type: opropChainType,
                        args: [srcChain[0], srcChain[1]]
                    },
                    arg2: prevOprop 
                }];
         
                lastOpropIndex = srcChain.length - 1;
         
                for (opropIndex = 2; opropIndex < lastOpropIndex; opropIndex++) {
                    newOprop = resultOntology.createEntity(opropType);
                    normalized.push({
                        type: reqAxiomType,
                        arg1: {
                            type: opropChainType,
                            args: [prevOprop, srcChain[opropIndex]]
                        },
                        arg2: newOprop
                    });
            
                    prevOprop = newOprop;
                }
         
                normalized.push({
                    type: reqAxiomType,
                    arg1: {
                        type: opropChainType,
                        args: [prevOprop, srcChain[lastOpropIndex]]
                    },
                    arg2: axiom.arg2
                });
         
                return normalized;
            },
      
            /**
             * Checks if the given axiom is in the form A1 = A2 = ... = An, where Ai are either
             * class or object property expressions. If this is the case, transforms it into the set
             * of equivalent axioms
             *  
             * A1 <= A2 A1 <= A3 ... A1 <= An
             * A2 <= A1 A2 <= A3 ... A2 <= An
             * ...
             * An <= A1 An <= A2 ... An <= An-1
             * .
             * 
             * @param axiom Axiom to apply the rule to.
             * @returns Set of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
            function (axiom) {
                var args, argIndex1, argIndex2, firstArg, lastArgIndex, normalized, resultAxiomType;
                
                // Decide upon the type of normalized axioms based on the type the given axiom.
                if (axiom.type === exprTypes.AXIOM_CLASS_EQ) {
                    resultAxiomType = exprTypes.AXIOM_CLASS_SUB;
                } else if (axiom.type === exprTypes.AXIOM_OPROP_EQ) {
                    resultAxiomType = exprTypes.AXIOM_OPROP_SUB;
                } else {
                    return null;
                }
                
                args = axiom.args;
                lastArgIndex = args.length - 1;
                
                if (lastArgIndex < 0) {
                    throw 'Equivalence axiom has no arguments!';
                }
                
                normalized = [];
                argIndex1 = lastArgIndex;
         
                do {
                    firstArg = args[argIndex1];
                    argIndex2 = lastArgIndex;
                    
                    do {
                        if (argIndex1 !== argIndex2) {
                            normalized.push({
                                type: resultAxiomType,
                                args: [firstArg, args[argIndex2]]
                            });
                        }
                    } while (argIndex2--);
                } while (argIndex1--);
         
                return normalized;
            },
      
            /**
             * Checks if the given axiom is in the form A <= A1 n A2 n ... An., where A and Ai are 
             * class expressions. If this is the case, transforms it into the set of equivalent
             * axioms
             *  
             *  A <= A1
             *  A <= A2
             *  ...
             *  A <= An
             * .
             * 
             * @param axiom Axiom to apply the rule to.
             * @returns Set of axioms which are result of applying the rule to the given axiom or 
             * null if the rule could not be applied.
             */
            function (axiom) {
                var exprs, exprIndex, firstArg, normalized, reqAxiomType;

                reqAxiomType = exprTypes.AXIOM_CLASS_SUB;

                if (axiom.type !== reqAxiomType || axiom.args[1].type !== exprTypes.CE_INTERSECT) {
                    return null;
                }
         
                exprs = axiom.args[1].args;
                exprIndex = exprs.length - 1;
                
                if (exprIndex < 0) {
                    throw 'Class Intersection expression has no arguments!';
                }

                normalized = [];
                firstArg = axiom.args[0];
         
                do {
	                normalized.push({
	                    type: reqAxiomType,
	                    args: [firstArg, exprs[exprIndex]]
	                });
	            } while (exprIndex--);
         
                return normalized;
            },
      
            /**
             * Checks if the given axiom is in the form C <= D, where C and D are complex class
             * expressions. If this is the case, transforms the axiom into two equivalent axioms
             *
             * C <= A
             * A <= D
             * 
             * where A is a new atomic class introduced.
             * 
             * @param axiom Axiom to apply the rule to.
             * @returns Set of axioms which are result of applying the rule to the given axiom or 
             * null if the rule could not be applied.
             */
            function (axiom) {
                var classType, newClassExpr, reqAxiomType;
            
                classType = exprTypes.ET_CLASS;
                reqAxiomType = exprTypes.AXIOM_CLASS_SUB;

                if (axiom.type !== reqAxiomType || axiom.args[0].type === classType || 
                        axiom.args[1].type === classType) {
                    return null;
                }
         
	            newClassExpr = resultOntology.createEntity(classType);
         
                return [{
	                type: reqAxiomType,
	                args: [axiom.args[0], newClassExpr]
	            }, {
	                type: reqAxiomType,
	                args: [newClassExpr, axiom.args[1]]
	            }];
            },
      
            /**
             * Checks if the given axiom is in the form C1 n C2 n ... Cn <= C, where some Ci are
             * complex class expressions. If this is the case converts the axiom into the set of
             * equivalent axioms
             * 
             * Ai <= Ci
             * ..
             * C1 n ... n Ai n ... Cn <= C
             * 
             * where Ai are new atomic classes introduced to substitute complex class expressions
             * Ci in the original axiom.
             * 
             * @param axiom Axiom to try to apply the rule to.
             * @returns Set of axioms which are result of applying the rule to the given axiom or 
             * null if the rule could not be applied.
             */
            function (axiom) {
                var args, argIndex, classExpr, classType, newClassExpr, newIntersectArgs,
                    normalized, reqAxiomType, reqExprType, ruleApplied;

                reqAxiomType = exprTypes.AXIOM_CLASS_SUB;
                reqExprType = exprTypes.CE_INTERSECT;
                classType = exprTypes.ET_CLASS;
            
	            if (axiom.type !== reqAxiomType || axiom.args[0].type !== reqExprType) {
                    return null;
                }
         
                // All expressions in the intersection.
                args = axiom.args[0].args; 
                argIndex = args.length - 1;
                
                if (argIndex < 0) {
                    throw 'Class Intersection expression has no arguments!';
                }

                normalized = [];
                newIntersectArgs = [];
                ruleApplied = false;
         
                do {
                    classExpr = args[argIndex];
            
	                if (classExpr.type !== classType) {
	                    ruleApplied = true;
	                    newClassExpr = resultOntology.createEntity(classType);
                     
	                    normalized.push({
	                        type: reqAxiomType,
	                        args: [newClassExpr, classExpr]
	                    });
                     
	                    newIntersectArgs.push(newClassExpr);
	                } else {
	                    newIntersectArgs.push(classExpr);
	                }
	            } while (argIndex--);
               
	            if (ruleApplied) {
	                normalized.push({
	                    type: reqAxiomType,
	                    args: [{
	                        type: reqExprType,
	                        args: newIntersectArgs
	                    }, axiom.args[1]]
	                });
            
                    return normalized;
	            } else {
                    return null;
                }
            },
      
            /**
             * Checks if the given axiom is in the form E P.A <= B, where A is a complex class
             * expression. If this is the case converts the axiom into two equivalent axioms 
             * A1 <= A and E P.A1 <= B, where A1 is a new atomic class.
             * 
             * @param axiom Axiom to try to apply the rule to.
             * @returns Set of axioms which are result of applying the rule to the given axiom or 
             * null if the rule could not be applied.
             */
            function (axiom) {         
                var firstArg, classType, newClassExpr, newObjSomeValuesExpr, reqAxiomType,
                    reqExprType;
                
                classType = exprTypes.ET_CLASS;
                reqAxiomType = exprTypes.AXIOM_CLASS_SUB;
                reqExprType = exprTypes.CE_OBJ_VALUES_FROM;

                if (axiom.type !== reqAxiomType || axiom.args[0].type !== reqExprType || 
                        axiom.args[0].classExpr.type === classType) {
                    return null;
                }

                firstArg = axiom.args[0];
         
                newClassExpr = resultOntology.createEntity(classType);
            
                newObjSomeValuesExpr = {
	                'type': reqExprType,
	                'opropExpr': firstArg.opropExpr,
	                'classExpr': newClassExpr
	            };

                return [{
	                'type': reqAxiomType,
	                'args': [firstArg.classExpr, newClassExpr]
	            }, {
	                'type': reqAxiomType,
	                'args': [newObjSomeValuesExpr, axiom.args[1]]
	            }];
            },
      
            /**
             * Checks if the given axiom is in the form A <= E P.B, where B is a complex class
             * expression. If this is the case converts the axiom into two equivalent axioms
             * B1 <= B and A <= E P.B1, where B1 is a new atomic class.
             * 
             * @param axiom Axiom to try to apply the rule to.
             * @returns Set of axioms which are result of applying the rule to the given axiom or
             * null if the rule could not be applied.
             */
            function (axiom) {
                var classType, newClassExpr, reqAxiomType, reqExprType, secondArg;

                classType = exprTypes.ET_CLASS;
                reqAxiomType = exprTypes.AXIOM_CLASS_SUB;
                reqExprType = exprTypes.CE_OBJ_VALUES_FROM;
                                
                if (axiom.type !== reqAxiomType || axiom.args[1].type !== reqExprType || 
                        axiom.args[1].classExpr.type === classType) {
                    return null;
                }
         
	            secondArg = axiom.args[1];
         
                newClassExpr = resultOntology.createEntity(classType);
        
                return [{
	                'type': reqAxiomType,
	                'args': [secondArg.classExpr, newClassExpr]
	            }, {
	                'type': reqAxiomType,
	                'args': [axiom.args[0], {
	                    'type': reqExprType,
	                    'opropExpr': secondArg.opropExpr,
	                    'classExpr': newClassExpr
	                }]
	            }];
            },
      
            /**
             * Checks if the given statement is in the form a <= A, where a is individual and A is a
             * complex class expression. If this is the case converts the statement into two
             * equivalent statements a <= B and B <= A, where B is a new atomic class.
             *
             * @param statement Statement to try to apply the rule to.
             * @returns Set of statements which are result of applying the rule to the given
             * statement or undefined if the rule could not be applied.
             */
            function (statement) {
                var classType, newClass, reqAxiomType;
            
                classType = exprTypes.ET_CLASS;
                reqAxiomType = exprTypes.FACT_CLASS;

                if (statement.type !== reqAxiomType || statement.classExpr.type === classType) {
                    return null;
                }
         
                newClass = resultOntology.createEntity(classType);
         
                return [{
                    'type': exprTypes.AXIOM_CLASS_SUB,
                    'args': [newClass, statement.classExpr]
                }, {
                    'type': reqAxiomType,
                    'individual': statement.individual,
                    'classExpr': newClass
                }];
            }
        ];

        // Main algorithm
      
        // Copy all entities from the source to the destination ontology first.
        copyEntities();

        axiomIndex = axioms.length - 1;
            
        if (axiomIndex < 0) {
            // Input ontology has no axioms, so exit.
            return resultOntology;
        }
        
        queue = new jsw.util.Queue();      

        do {
            queue.enqueue(axioms[axiomIndex]);
        } while (axiomIndex--);
      
        lastRuleIndex = rules.length - 1;

        while (!queue.isEmpty()) {
            axiom = queue.dequeue();
            ruleIndex = lastRuleIndex;
         
            // Trying to find a rule to apply to the axiom.
            do {
                resultAxioms = rules[ruleIndex](axiom);
            
                if (resultAxioms) {
                    axiomIndex = resultAxioms.length - 1; 
               
                    // If applying the rule succeeded.
                    do {
                        queue.enqueue(resultAxioms[axiomIndex]);
                    } while (axiomIndex--);
               
                    break;
                }
            } while (ruleIndex--);
         
            if (ruleIndex < 0) {
                // If nothing can be done to the axiom, it is returned unchanged by all rule
                // functions and the axiom is in one of the normal forms already. 
                resultOntology.axioms.push(axiom);            
            }
        }
      
        return resultOntology;
    } 
};

/**
 * Onotlogy represents a set of statements about some world.
 */
jsw.owl.Ontology  = function () {	
    var exprTypes = jsw.owl.EXPRESSION_TYPES,
        classType = exprTypes.ET_CLASS,
        individualType = exprTypes.ET_INDIVIDUAL,
        opropType = exprTypes.ET_OPROP;

    /**
     * The sets of entities of different types found in the ontology.
     */
    this.entities = {};
    this.entities[opropType] = {};
    this.entities[classType] = {};
    this.entities[individualType] = {};
   
    /**
     * Contains all axioms in the ontology.
     */
    this.axioms = [];
    
    /**
     * Contains all prefixes used in abbreviated entity IRIs in the ontology.
     */
    this.prefixes = {};
   
    // Contains the numbers to be used in IRIs of next auto-generated entities.
    this.nextEntityNos = {};
    this.nextEntityNos[opropType] = 1;
    this.nextEntityNos[classType] = 1;
    this.nextEntityNos[individualType] = 1;    
   
    // Contains number of entities of each type in the ontology.
    this.entityCount = {};
    this.entityCount[opropType] = 0;
    this.entityCount[classType] = 0;
    this.entityCount[individualType] = 0;
};

jsw.owl.Ontology.prototype = {
    /** Types of expressions which the ontology can contain. */
    exprTypes: jsw.owl.EXPRESSION_TYPES,

    /**
     * Adds the given prefix to the ontology, so that the abbreviated IRIs of entities with this
     * prefix can be expanded.
     *
     * @param prefixName Name of the prefix.
     * @param iri IRI to use in abbreviated IRI expansion involving the prefix name.
     */
    addPrefix: function (prefixName, iri) {
        var existingIri = this.prefixes[prefixName];
        
        if (!existingIri) {
            this.prefixes[prefixName] = iri;
        } else if (existingIri !== iri) {
            throw 'The prefix with the name "' + prefixName + '" and different IRI "' + 
                existingIri + '" has already been added to the ontology!';          
        }
    },

    /**
     * Allows generating a new unique IRI for the entity of the given type.
     * 
     * @param type Type of the entity to generate a new unique IRI for.
     * @returns New unique IRI.
     */
    createNewIRI: function (type) {
        var entities,
            entityPrefix = this.getEntityAutoPrefix(type),
            nextEntityNo = this.nextEntityNos[type],
            iri;
      
        if (!nextEntityNo) {
            throw 'Unrecognized entity type!';
	    }
      
        entities = this.entities[type];
        iri = '';
         
        do {
            iri = entityPrefix + nextEntityNo;
	        nextEntityNo++;
	    } while (entities[iri]);
         
        this.nextEntityNos[type] = nextEntityNo;
	    return iri; 
    },
   
    /**
     * Creates a new entity of the given type with automatically generated IRI.
     * 
     * @param type Type of the entity to create.
     * @param iri (optional) IRI of the new entity. If not given, generates a new IRI.
     * @returns The new entity of the given type with the name automatically generated.
     */
    createEntity: function (type, iri) {
        var entity;
        
        if (!iri) {
            iri = this.createNewIRI(type);
        } else {
            if (this.entities[type][iri]) {
                return this.entities[type][iri];
            }
        }
         
        entity = {
            'type': type,
	        'IRI': iri
	    };

        this.entities[type][iri] = entity;
        this.entityCount[type]++;
        return entity;
    },
   
    /**
     * Checks if the ontology contains any references to the class with the given IRI.
     * 
     * @param iri IRI of the class to check.
     * @returns True if the ontology has reverences to the class, false otherwise.
     */
    containsClass: function (iri) {
        if (this.entities[this.exprTypes.ET_CLASS][iri]) {
            return true;
        } else {
            return false;
        }
    },
   
    /**
     * Checks if the ontology contains any references to the object property with the given IRI.
     * 
     * @param iri IRI of the object property to check.
     * @returns True if the ontology has reverences to the object property, false otherwise.
     */
    containsObjectProperty: function (iri) {
        if (this.entities[this.exprTypes.ET_OPROP][iri]) {
            return true;
        } else {
            return false;
        }
    },   
   
    /**
     * Returns number of classes in the ontology.
     * 
     * @returns Number of classes in the ontology.
     */
    getClassCount: function () {
        return this.entityCount[this.exprTypes.ET_CLASS];
    },
   
    /**
     * Returns an 'associative array' of all classes in the ontology.
     * 
     * @returns 'Associative array' of all classes in the ontology.
     */
    getClasses: function () {
        return this.entities[this.exprTypes.ET_CLASS];
    },

    /**
     * Returns a prefix to be used in the automatically generated nams for entities of the given
     * type.
     *
     * @param type Integer specifying the type of entity to get the name prefix for.
     * @returns Prefix to be used in the automatically generated nams for entities of the given
     * type.
     */
    getEntityAutoPrefix: function (type) {
        var exprTypes = this.exprTypes;

        switch (type) {
        case exprTypes.ET_CLASS:
            return 'C_';
        case exprTypes.ET_OPROP:
            return 'OP_';
        case exprTypes.ET_INDIVIDUAL:
            return 'I_';
        default:
            throw 'Unknown entity type "' + type + '"!';
        }
    },

    /**
     * Returns number of object properties in the ontology.
     * 
     * @returns Number of object properties in the ontology.
     */
    getObjectPropertyCount: function () {
        return this.entityCount[this.exprTypes.ET_OPROP];
    },
   
    /**
     * Returns an 'associative array' of all object properties in the ontology.
     * 
     * @returns 'Associative array' of all object properties in the ontology.
     */
    getObjectProperties: function () {
        return this.entities[this.exprTypes.ET_OPROP];
    },
   
    /**
     * Returns number of individuals in the ontology.
     * 
     * @returns Number of individuals in the ontology.
     */
    getIndividualCount: function () {
        return this.entityCount[this.exprTypes.ET_INDIVIDUAL]; 
    },

   /**
    * Returns an 'associative array' of all individuals in the ontology.
    * 
    * @returns 'Associative array' of all individuals in the ontology.
    */
    getIndividuals: function () {
        return this.entities[this.exprTypes.ET_INDIVIDUAL];
    }, 
   
    /**
     * Returns the number of axioms of the given types (optionally) in the ontology.
     *
     * @param types (optional) Array containing types of axioms to count. If the argument is not
     * provided, the total number of axioms is returned.
     * @returns Number of axioms of the given types in the ontology.
     */
    getSize: function (types) {
        var axiom, axioms, axiomIndex, lastTypeIndex, size, typeIndex;
    
        axioms = this.axioms;
        axiomIndex = axioms.length - 1;

        if (!types || axiomIndex < 0) {
            return axiomIndex + 1;
        }
      
        lastTypeIndex = types.length - 1;
        size = 0;      

        do {
            axiom = axioms[axiomIndex];
            typeIndex = lastTypeIndex;
         
            do {
                if (axiom.type === types[typeIndex]) {
                    size++;
                    break;
                }
            } while (typeIndex--);
        } while (axiomIndex--);
      
        return size;
    },

    /**
     * Returns the size of ABox of the ontology.
     * 
     * @returns Size of the ABox of the ontology.
     */
    getAboxSize: function () {
        var exprTypes = this.exprTypes;

        return this.getSize([exprTypes.FACT_CLASS, exprTypes.FACT_OPROP]);
    },
   
    /**
     * Returns the size of TBox of the ontology.
     * 
     * @returns Size of the TBox of the ontology.
     */
    getTboxSize: function () {
        var exprTypes = this.exprTypes;

        return this.getSize([exprTypes.AXIOM_CLASS_EQ, exprTypes.AXIOM_CLASS_SUB, 
            exprTypes.AXIOM_OPROP_SUB]);
    },

    /**
     * Returns the size of RBox of the ontology.
     * 
     * @returns Size of the RBox of the ontology.
     */   
    getRboxSize: function () {
        return this.getSize([this.exprTypes.AXIOM_OPROP_SUB]);
    }
};

/** An object containing utility methods for working with XML. */
jsw.util.xml = {
    /**
     * Parses string into the XML DOM object in a browser-independent way.
     *
     * @param xml String containing the XML text to parse.
     * @returns XML DOM object representing the parsed XML.
     */
    parseString: function (xml) {
        var xmlDoc, error;

        if (window.DOMParser) {
            xmlDoc = new DOMParser().parseFromString(xml, 'text/xml');
            
            if (xmlDoc.documentElement.nodeName === 'parsererror') { // Firefox
                throw xmlDoc.documentElement.childNodes[0].nodeValue;
            } else if (xmlDoc.documentElement.childNodes[0] &&
                    xmlDoc.documentElement.childNodes[0].childNodes[0] && 
                    xmlDoc.documentElement.childNodes[0].childNodes[0].nodeName === 'parsererror') {
                // Chrome
                throw xmlDoc.documentElement.childNodes[0].childNodes[0].childNodes[1].innerText;
            }

            return xmlDoc;
        } else { // IE
            xmlDoc = new ActiveXObject('Microsoft.XMLDOM');
            xmlDoc.async = 'false';
            xmlDoc.loadXML(xml); 

            error = xmlDoc.parseError;

            if (error.errorCode !== 0) {
                throw 'Can not parse the given onotology OWL/XML:' +
                    '\nError in line ' + error.line + ' position ' + error.linePos +
                    '\nError Reason: ' + error.reason;
            }
        }

        return xmlDoc;
    }
};

/**
 * Queue implementing FIFO mechanism. 
 */
jsw.util.Queue = function () {
    this.queue = [];
    this.emptyElements = 0;
};

jsw.util.Queue.prototype = {
    /**
     * Checks if the queue has no objects.
     * 
     * @return True if there are no objects in the queue, fale otherwise.
     */
    isEmpty: function () { 
        return this.queue.length === 0; 
    },
   
    /**
     * Adds an object to the queue.
     * 
     * @param obj Object to add to the queue.
     */
    enqueue: function (obj) {
        this.queue.push(obj);
    },
   
    /**
     * Removes the oldest object from the queue and returns it.
     * 
     * @returns The oldest object in the queue.
     */
    dequeue: function () {
        var element,
            emptyElements = this.emptyElements,
            queue = this.queue,
            queueLength = queue.length;

        if (queueLength === 0) {
            return null;
        }

        element = queue[emptyElements];
        emptyElements++;
  
        // If the queue has more than a half empty elements, shrink it.    
        if (emptyElements << 1 >= queueLength - 1) {
            this.queue = queue.slice(emptyElements);
            this.emptyElements = 0;
        } else {
            this.emptyElements = emptyElements;
        }
      
        return element;
    }
};

/**
 * Stopwatch allows measuring time between different events.
 */
jsw.util.Stopwatch = function () {
    var startTime, // Time (in miliseconds) when the stopwatch was started last time.
        elapsedMs = null; // Contains the number of miliseconds in the last measured period of time.
   
    /**
     * Returns textual representation of the last measured period of time.
     */
    this.getElapsedTimeAsText = function () {
        var miliseconds = elapsedMs % 1000,
            hours = Math.floor(elapsedMs / 3600000),
            minutes = Math.floor(elapsedMs % 3600000 / 60000),
            seconds = Math.floor(elapsedMs % 60000 / 1000);
        
        if (miliseconds < 10) {
            miliseconds = '00' + miliseconds.toString();
        } else if (miliseconds < 100) {
            miliseconds = '0' + miliseconds.toString();
        }

        return hours + ' : ' + minutes + ' : ' + seconds + '.' + miliseconds;
    };
   
    /**
     * Starts measuring the time.
     */
    this.start = function () {
        startTime = new Date().getTime();
        elapsedMs = null;
    };
   
    /**
     * Stops measuring the time.
     * 
     * @returns Textual representation of the measured period of time.
     */
    this.stop = function () {
        elapsedMs = new Date().getTime() - startTime;
        return this.getElapsedTimeAsText();
    };
};

/**
 * Pair storage can be used to hash 2-tuples by the values in them in some order.
 * 
 * @returns Object which can be used to hash 2-tuples by the values in them in some order.
 */
jsw.util.PairStorage = function () {
    /**
     * Data structure holding all pairs.
     */
    this.storage = {};
};

jsw.util.PairStorage.prototype = {
    /**
     * Returns an object which can be used to access all pairs in the storage with (optionally)
     * the fixed value of the first element in all pairs.
     * 
     * @param first (optional) The value of the first element of all pairs to be returned.
     * @returns Object which can be used to access all pairs in the storage.
     */
    get: function (first) {
        if (!first) {
            return this.storage;
        }
            
        return this.storage[first] || {};
    },
   
    /**
     * Checks if the tuple with the given values exists within the storage.
     * 
     * @param first First value in the pair.
     * @param second Second value in the pair.
     * @returns True if the tuple with the given value exists, false otherwise.
     */
    exists: function (first, second) {
        var firstPairs = this.storage[first];
            
        if (!firstPairs) {
            return false;
        }
            
        return firstPairs[second] || false;
    },
            
    /**
     * Checks if tuples with the given first value and all of the given second values exist within
     * the storage.
     * 
     * @param first First value in the tuple.
     * @param second Array containing the values for second element in the tuple. 
     * @returns True if the storage contains all the tuples, false otherwise.
     */
    existAll: function (first, second) {
        var secondPairs, secondValue;
            
        if (!second) {
            return true;
        }
        
        secondPairs = this.storage[first];        
    
        if (!secondPairs) {
            return false;
        }
            
        for (secondValue in second) {         
            if (!secondPairs[secondValue]) {
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
    add: function (first, second) {
        var storage = this.storage;

        if (!storage[first]) {
            storage[first] = {};
        }
            
        storage[first][second] = true;
    }
};
   
/**
 * Triplet storage can be used to hash 3-tuples by the values in them in some order.
 * 
 * @returns Object which can be used to hash 3-tuples by the values in them in some order.
 */
jsw.util.TripletStorage = function () {
    /**
     * Data structure holding all 3-tuples.
     */
    this.storage = {};
};

jsw.util.TripletStorage.prototype = {
    /**
     * Returns all triplets for a fixed value of the 1-st element in triplets and (optionally) the 
     * 2-nd one.
     *  
     * @param first Value of the first element of the returned triplets.
     * @param second (optional) Value of the second element of the returned triplets.
     * @returns Object containing the triplets requested.
     */
    get: function (first, second) {
        var firstTuples;
        
        if (!first) {
            return this.storage;
        }

        firstTuples = this.storage[first];

        if (!firstTuples) {
            return {};
        }
            
        if (!second) {
            return firstTuples;
        }
            
        return firstTuples[second] || {};
    },
         
    /**
     * Adds the given triplet to the storage.
     * 
     * @param first Value of the first element in the triplet.
     * @param second Value of the second element in the triplet.
     * @param third Value of the third element in the triplet.
     */
    add: function (first, second, third) {
        var storage = this.storage;

        if (!storage[first]) {
            storage[first] = {};
        }
            
        if (!storage[first][second]) {
            storage[first][second] = {};
        }
            
        storage[first][second][third] = true;
    },
         
    /**
     * Checks if the given triplet exists in the storage.
     * 
     * @param first Value of the first element in the triplet.
     * @param second Value of the second element in the triplet.
     * @param third Value of the third element in the triplet.
     * @returns True if the value exists, false otherwise.
     */
    exists: function (first, second, third) {
        var storage = this.storage,
            firstStorage = storage[first],
            secondStorage;

        if (!firstStorage) {
            return false;
        }
    
        secondStorage = firstStorage[second];

        if (!secondStorage) {
            return false;
        }
            
        if (!secondStorage[third]) {
            return false;
        }
            
        return true;
    }
};
