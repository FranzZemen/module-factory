# Read Me

module-factory is a factory pattern that supports injecting factory objects dynamically from other modules. It finds use
in projects that leverage plugins but don't want to statically install all or any plugins, for example.

Currently, only available as an ES6 module but can inject commonjs modules

# Install

npm i @franzzemen/module-factory

# Inject a JSON resource

```` 
// someFile.json
````

```` json   
{
  "price": 5.0,
  "ticker": "ZEM"
}
````

```` typescript 
function loadJSONResource<T>(moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): T | Promise<T>  {//...}

let obj = loadJsonResource({
  moduleName: 'somePath/someFile.json', moduleResolution: 'json'
});
````

Here somePath is relative to the location of module-factory. This is usually in the root node-modules, in the directory
@franzzemen/module-factory. Thus, normally the path will begin with '../../../' back to the root of the project from
which one can append the remaining path. To do this automatically so that it always works:

```` javascript
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
// For CommonJS Environments __dirname is built in
// =====> Start ES6 Module Environments
import {pathToFileURL} from 'node:url';
import {dirname} from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// End ES6 Module Environments <=====

const moduleName = pathToFileURL(join(__dirname, 'yourRelativePathTo/someFile.json')).toString();

````

Of course this is only syntactical sugar (if even that) over

```` javascript
  require('someFile.json');
````

But you can also add a validation apart from ensuring it is true json:

```` typescript
let obj = loadJsonResource({
  moduleName: 'somePath/someFile.json',
  moduleResolution: ModuleResolution.json,
  loadSchema: {
    validationSchema: {
      price: {type: 'number'},
      ticker: {type: 'string'}
    }
  }
});
````

Currently, module-factory supports the fastest-validator package as it is simply said the fastest validator out there as
of this edit (2022). If you have a favorite package you would like integrate, please let us know. Time permitting we
have plans to add others such as zod.

For json validation, the loadSchema can point to the schema as shown above or to the check function (a much faster
alternative when expecting to reuse the schema).

```` typescript
const validationSchema: ValidationSchema = {
  price: {type: 'number'},
  ticker: {type: 'string'}
}
   
const check = new Validator().compile(validationSchema);
   
let obj = loadJsonResource({moduleName: 'somePath/someFile.json', moduleResolution: 'json', loadSchema: check});
````

# Inject JSON from a factory module

Get JSON from a top level property in an installed module of your choice. Regardless of whether you provide a loadSchema
in the module definition, JSON is guaranteed or an error is thrown.

*** Important - the property MUST point to a string containing JSON (stringified JSON). If you want to load an object
see further down ***

```` typescript
function loadJSONFromModule<T>(moduleDef: ModuleDefinition, log?: ModuleFactoryLogger): T | Promise<T> {}

let obj = loadJSONFromModule({
  moduleName: '@franzzemen/test-commonjs',
  propertyName: 'jsonStr',
  moduleResolution: 'commonjs'
});
````

Or from a nested property in a relative module (the nesting syntax leverages object-path).

```` typescript
function loadJSONFromModule<T>(moduleDef: ModuleDefinition, log?: ModuleFactoryLogger): T | Promise<T> {}

let obj = loadJSONFromModule({
  moduleName: 'somePath/test-commonjs',
  propertyName: 'nestedJsonStr.jsonStr',
  moduleResolution: 'commonjs'
});
````

Noting that somePath has the same treatment as above.

# Inject any value from a factory module

Inject a value using a factory function from an installed or relative module:

```` typescript
// In 'someModule', an es module
function getSomeStringFactory(): string {
   return 'Thread + uuid()';
}
````

Using ES6 module loader

```` typescript
function loadFromModule<T>(moduleDef: ModuleDefinition, log?: ModuleFactoryLogger): T | Promise<T> {}

// Returns a promise because we're dynamically loading an ES6 module.  That would not be the case for json module resolution
loadFromModule({
   moduleName: 'someModule',
   functionName: 'getSomeStringFactory',
   moduleResolution: ModuleResolution.es,
   loadSchema: TypeOf.String
}).then((value:string) => {
   console.log(`The value is ${value}`);
}).error(err => {
   console.warn(`Most likely not a string?`);
   console.error(err);
});
````

Using commonjs module loader

```` typescript
const str = loadFromModule({
  moduleName: 'someModule',
  functionName: 'getSomeStringFactory',
  moduleResolution: ModuleResolution.commonjs,
  loadSchema: TypeOf.String
})
````

Or using commonjs module loader with async factory function

```` typescript
// In 'someModule', a commonjs module
function getSomeStringFactory(): Promise<string> {
   return Promise.resolve('Thread + uuid()');
}
````

```` typescript
function loadFromModule<T>(moduleDef: ModuleDefinition, log?: ModuleFactoryLogger): T | Promise<T> {}

// Returns a promise because the factory function does.  
loadFromModule({
   moduleName: 'someModule',
   functionName: 'getSomeStringFactory',
   moduleResolution: ModuleResolution.json,
   loadSchema: TypeOf.String
}).then((value:string) => {
   console.log(`The value is ${value}`);
}).error(err => {
   console.warn(`Most likely not a string?`);
   console.error(err);
});
````

Inject an object using a factory function

```` javascript
const obj = loadFromModule({
   moduleName: 'someModule',
   functionName: 'getSomeObject',
   moduleResolution: ModuleResolution.commonjs
})
````

For example, inject a function

````
import {StockQuote} from 'somewhere';
type SomeFunction = (ticker: string, timeStamp: string) => StockQuote;

const someFunction: SomeFunction = loadFromModule<SomeFunction>({
   moduleName: 'someModule',
   functionName: 'getSomeFunction',
   moduleResolution: 'commonjs'
});

const stockQuote: StockQuote = someFunction('ZEM', '10-24-1967T15:53:00');
````

Inject an object using a factory constructor (constructors never return promises), except for classes that extend a
Promise)

```` typescript
const obj: StockQuote = loadFromModule<StockQuote>({
   moduleName: 'someModule',
   constructorName: 'StockQuote',
   moduleResolution: ModuleResolution.commonjs
})
````

## Module Definition

The Module Definition specification is:

    type ModuleDefinition = {
        moduleName: string,
        functionName?: string,
        constructorName?: string,
        propertyName?: string,
        moduleResolution?: ModuleResolution,
        paramsArray?: any[],
        loadSchema?: LoadSchema | TypeOf | AsyncCheckFunction | SyncCheckFunction,
    };

    where:
        moduleName:         The moduleName is the name of either an installed package or an absolute or  relative path,or JSONfile.
        functionName:       The name of the factory function in the loaded module.  Not used for JSON files.  
        constructorName:    The name of the factory constructor in the loaded module.  Not used for JSON files or modules providing JSON properties.
        propertyName:       The name of a JSON property in the loaded module
        moduleResolution:   The module type of the loaded module. Either 'commonjs' or 'es' or a value from the enum ModuleResolution.
        paramsArray:        Additional parameters to be provided to the factory function/constructor
        loadSchema:         A validation method for the loaded object

The functionName, constructorName and propertyName may contain dot notation (In fact any format used by the package
'object-path' should work) to obtain it within the target package, for example 'myFunctions.someFactoryFunction', where
the package exports 'myFunctions';

### Relative Paths
See the note on relative paths in one of the above examples
