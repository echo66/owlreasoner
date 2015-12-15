# Welcome to the **JSW Toolkit** Project Page! #

## Introduction ##

The project has started as an attempt to create a browser-hosted (i.e. JavaScript) [OWL](http://en.wikipedia.org/wiki/Web_Ontology_Language) reasoner. However, implementing a reasoner required to create an OWL parser first, and we chose [OWL 2 XML](http://www.w3.org/TR/2009/REC-owl2-xml-serialization-20091027/) as the syntax. Additionally, the project has been extended to allow working with [A-Box](http://en.wikipedia.org/wiki/Abox) data by using conjunctive queries. For that purpose, a [SPARQL](http://en.wikipedia.org/wiki/Sparql) parser (although yet limited) was created as well. And, since OWL itself relies on several other standards, the decision was made to reposition the project as a JavaScript library for working with various Semantic Web standards.

Currently, the library contains the following functionality:
  * OWL 2 XML parser/writer;
  * BrandT - EL+ reasoner with some extensions;
  * SPARQL parser with some limitations.

However, the design of the library accounts for extensibility and it is our intention to extend the functionality further.

## How To Use It ##

The below description provides quick tutorial on how to use the JSW Toolkit basic features. For more advanced uses, please consult with the [source code](http://code.google.com/p/owlreasoner/source/browse/#svn%2FOWL%20Reasoner).

  * [Library Files](#Library_Files.md)
  * [Ontology Object](#Ontology_Object.md)
  * [Reasoner Object](#Reasoner_Object.md)
  * [RDF Query Objects](#RDF_Query_Objects.md)
  * [Hierarchy Objects](#Hierarchy_Objects.md)
  * [TreeControl Component](#TreeControl.md)
  * [TimeInfo Object](#TimeInfo_Object.md)

### Library Files ###

There are currently three JavaScript files which can be used:
  * jsw.js - contains core code of the library
  * jswui.js - contains code for UI components.
  * query.js - contains [TrimQuery](http://code.google.com/p/trimpath/wiki/TrimQuery) library. The library is internally used by JSW Toolkit for working with A-Box data using SQL syntax.

Each file has a minified version (identified by a `*`-min suffix in the filename).

As a minimum, jsw-min.js and query-min.js **must** be included in your HTML page:

```
<script src="jsw-min.js"></script>
<script src="query-min.js"></script>
```

### Ontology Object ###

In order to use a reasoner, you first need to create an ontology object. The easiest way to do it is to use an OWL 2 XML parser provided by the library:

```
var owlXml = "<Ontology> ... </Ontology>"; // Text of your ontology
var ontology = jsw.owl.xml.parse(owlXml);
```

or

```
var url = "http://www.example.com/ontology.owx"; // URL of the ontology
var ontology = jsw.owl.xml.parseUrl(url);
```

Once created, the ontology object provides the following methods:
  * `getSize()` - returns number of statements (axioms and assertions) in the ontology
  * `getTBoxSize()` - returns number of statements (axioms) in the ontology's T-Box
  * `getABoxSize()` - returns number of statements (assertions) in the ontology's A-Box
  * `getRBoxSize()` - returns number of statements (axioms) in the ontology's R-Box (all general object property subsumption axioms)
  * `getClassCount()` - returns number of classes in the ontology
  * `getIndividualCount()` - returns number of individuals in the ontology
  * `getObjectPropertyCount()` - returns number of object properties in the ontology

Each of the following methods returns one object where property names are IRIs:
  * `getClasses()` - returns all classes in the ontology
  * `getIndividuals()` - returns all individuals in the ontology
  * `getObjectProperties()` - returns all object properties in the ontology()

In order to access an array of all statements in the ontology, you can use (at your own risk though!) `axioms` property of the ontology.

### Reasoner Object ###

To create an instance of a reasoner for the given ontology object:

```
var reasoner = new jsw.owl.BrandT(ontology);
```

The code above automatically starts ontology classification process and could therefore take much time (depending on ontology size and complexity). Once the reasoner has been created, it provides the following properties:
  * `classHierarchy` - class hierarchy inferred (see [Hierarchy Object](#Hierarchy_Object.md))
  * `objectPropertyHierarchy` - object property hierarchy inferred (see [Hierarchy Object](#Hierarchy_Object.md))
  * `timeInfo` - contains information on how long each step of building a reasoner took (see [TimeInfo Object](#TimeInfo_Object.md))

Additionally, it provides the following methods:
  * `answerQuery(query)` - executes the RDF query (see [RDFQuery Objects](#RDF_Query_Objects.md) against the ontology and returns a result data set.
  * `isSubClassOf(iri1, iri2)` - checks whether the class with the IRI iri1 is a subsumee of the class with the IRI iri2
  * `isSubObjectPropertyOf(iri1, iri2)` - checks whether the object property with the IRI iri1 is a subsumee of the object property with the IRI iri2
  * `isClassSatisfiable(iri)` - checks whether the class with the given IRI is satisfiable.

### RDF Query Objects ###
RDF Query objects can be used to query the RDF view of the ontology and allow to formulate conjunctive queries. The easiest way to create an RDF Query object is to use a SPARQL parser provided by the library:

```
var queryText = "SELECT ?x { .. }"; // Your SPARQL query text.
var query = jsw.sparql.parse(queryText);
```

The query can be executed against the ontology using a Reasoner object built for that ontology:

```
var results = reasoner.answerQuery(query);
```

The `results` returned will be an array of objects. In each object, there will be a  property for every variable mentioned in the query text.

### Hierarchy Objects ###

Hierarchy objects are recursive data-structures used to store trees. You can access root nodes of those trees by using reasoner's `classHierarchy` and `objectPropertyHierarchy` properties. Each node of the tree has the following structure:

```
var node = {
   names: [],    // names of entity represented by the node (equivalent entity names)
   children: [], // nodes representing subsumees of the class
   special: true // true indicates that subsumption between the node and its parent has been discovered by the reasoner
}
```

Given the roots of hierarchy trees it is possible to traverse the whole hierarchy. However, for displaying hierarchies a [`TreeControl` Component](#TreeControl_Component.md) is already provided.

### TreeControl Component ###

TreeControl component can be used to display hierarchies. The component is defined in `util.js` file and, therefore, in order to use it you must include the file on you HTML page:

```
<script src="util-min.js"></script>
```

To create a component for displaying class hierarchy inferred by a reasoner:

```
   var classTree = new TreeControl(reasoner.classHierarchy, 'classHierarchy', {
      titleClass: 'classLink',
      childrenCountClass: 'classChildrenCount', 
      highlightClass: 'highlightText',
      specialClass: 'special'
   });
```

The first argument in the constructor supplies the hierarchy to display, the second one gives ID of HTML element to host the component (usually DIV). The third optional argument can provide names of CSS classes used to display different elements of the tree.

The component has a method `showMatches(str)` which allows to display all entities in the hierarchy whose names partially match the given string.

### TimeInfo Object ###
TimeInfo object provides information on how long each step of building a reasoner took. It has the following properties:
  * `normalization` - time taken to normalize the ontology
  * `objectPropertySubsumption` - time taken to build object property subsumer sets
  * `classification` - time taken to build class subsumer sets
  * `aBoxRewriting` - time taken to complete A-Box of the ontology
  * `classHierarchy` - time taken to build class hierarchy object from class subsumer sets
  * `objectPropertyHierarchy` - time taken to build object property hierarchy from object property subsumer sets

The values of the above properties are **strings** in the format "**hh:mm:ss.lll**", where **l** is a position taken by miliseconds value.