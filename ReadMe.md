# Read Me

module-factory is a factory pattern that supports injecting factory objects dynamically from other modules. It finds use
in projects that leverage plugins but don't want to statically install all or any plugins, for example.

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
  moduleResolution: ModuleResolution.json,
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






## Other examples

TBD and see the unit tests

# Install

npm i @franzzemen/module-factory

# Usage

This package is published for an ECMAScript module loader. For CommonJS see below.

### ECMAScript

    import {ModuleDefintion, loadFromModule, loadJSONFromModule, loadJSONResource} from '@franzzemen/module-factory';

## CommonJS

    // Typescript allows type definition to be loaded with regular imports in CommonJS
    import {ModuleDefinition} from '@franzzemen/module-factory';

    import('@franzzemen/module-factory')
        .then(package => {
            const loadFromModule = package.loadFromModule,
            const loadJSONFromModule = package.loadJSONFromModule,
            const loadJSONResource = package.loadJSONResource
            ....
        }

# Load From Module

The @franzzemen packages often provide extensible functionality which can be defined externally and loaded dynamically.
The load-from-module module provides that capability:

1. Load a JSON object. This is the simplest format, and pretty much just encapsulates require(jason url) with some
   optional validation;
2. Load a JSON object from another package. JSON can be loaded from another package that may provide statically or
   dynamically.
3. Load a factory object to obtain a new instance of some object. A factory is exposed either as a factory function or a
   constructor and a new instance of the object is created from those.

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

The functionName, constructorName and propertyName may contain dot notation to obtain it within the target package, for
example 'myFunctions.someFactoryFunction', where the package exports 'myFunctions', but the factory function is a
property therein. In fact any format used by the package 'object-path' should work.

## Module Resolution

With the advent of support for ES modules, module resolution specification becomes important, whereas prior to this
commonjs was assumed. ES modules cannot dynamically import from other modules without becoming asynchronous, through the
import() build in method. CommonJS modules can can be imported synchronously via require/createRequire from either.

Rather than try and parse the outcome, a module resolution specification is required for ES modules to be loaded. If it
is missing or a commonjs specification, commonjs is assumed. Thus loading from a module anything but JSON will convert
processing to asynchronous if the target is an ES module.

When using relative paths for ES modules, remember to affix the ".js" suffix to the moduleName. For commonjs this can be
omitted, but it is a standard for ES modules.

### Relative Paths

Because ultimately require or import() will be used, moduleName is an installed package, a URL, an absolute path, or it
is relative to the location of the @franzzemen/module-factory module, per node standard.

S1ince most of the time one would be using relative paths from a given package, the relative path would normally begin
with '../../../' to path back out of directories factory-module, @franzzemen, and node_modules. To that one would add
the path to the desired file module.

For relative paths, it is important to remember that if you let your node packages fall out of sync, you may end up with
@franzzemen packages in nested node_module folders. Either a) keep your packages will updated or only import the top
most @franzzemen package you need that itself will install @franzzemen/app-utility, OR don't use relative paths.  
Otherwise, depending on which node_modules is used by the package loader, your relative paths may not be right.

Most will not want to resolve the relative path from @franzzemen/module-factory

## Loading JSON

    loadJSONResource<T>(moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): T | Promise<T>

    Noting that tthe method will not return a Promise so long as moduleDef.loadSchema, if provided, does not create an async result.

This wraps the normal way of loading JSON with "require", adding the ability to validate on load

If a validation schema has been provided, and that schema is marked for asynchronous validation, a Promise to the JSON
object is returned. The same holds true if a CheckFunction is provided and it is an AsyncCheckFunction. An exception is
thrown if the object cannot be loaded or if it doesn't validate (with appropriate logging).

From a security perspective, validation is not as critical as when loanding an object from a factory function, because
the returned object is stringified and parsed, which will only result in non-functional properties.

## Loading JSON From Module Factory Function

    loadInstanceFromModule<T>(module: any, moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): T | Promise<T>

If a factory function 'functionName' is specified the propertyName will be ignored. In this case, the function will be
retrieved and called to get the object. The factory function must not be asynchronous (must not return a Promise).

IMPORTANT NOTE:  The returned JSON from the factory function is expected to be a **string**, not an object! Parsing is
done by **this** package, to avoid this function being abused.

As mentioned, if moduleResolution is 'es' for the target module, the code will transition to asynchronous, and return a
Promise. You will therefore need to be able to handle promises or make a decision that your modules will always be '
commonjs' and throw an error on Promise.

Because any validations specified in the ModuleDefinition can be asynchronous, a Promise can also be returned in that
case.

From a security perspective, validation is not as critical as when loading an object from a factory function, because
the returned value from the function is a string and parsed after it is obtained.

### Object Instance Factory

    loadFromModule<T>(moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): T | Promise<T> 

This loads the target module and creates a new instance, using either the factory function or constructor supplied. If
the function name is provided, the constructor name will be ignored.

If the loaded module is of type 'es', or if any validation is asynchronous, a Promise will be returned.

The moduleDefinition can contain a validation method that could also cause the processing to return a Promise

The functionName of the moduleDefinition can point to a nested element of the module if the "." operator is used
(uses object-path syntax).

From a security perspective, providing validation method is recommended.

