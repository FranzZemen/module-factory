import {getValidator} from "@franzzemen/fastest-validator-wrapper";


import Validator, {AsyncCheckFunction, SyncCheckFunction, ValidationError, ValidationSchema} from 'fastest-validator';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import objectPath from 'object-path';
import {pathToFileURL} from 'url';
import {isPromise} from 'util/types';
import {importModule} from "./import-helper.cjs";
//import {importModule} from "./import-helper.cjs";

export interface ModuleFactoryLogger {
  error(err: any, ...params:any[]): any;

  warn(data: any, message?: string, ...params:any[]): any;

  info(data: any, message?: string, ...params:any[]): any;

  debug(data:any, message?: string, ...params:any[]): any;

  trace(data:any, message?: string, ...params:any[]): any;
}

function isAsyncCheckFunction(check: any | AsyncCheckFunction | SyncCheckFunction): check is AsyncCheckFunction {
  return check !== undefined && check.async === true;
}

function isSyncCheckFunction(check: any | AsyncCheckFunction | SyncCheckFunction): check is SyncCheckFunction {
  return check !== undefined && check.async === false;
}

export function isLoadSchema(schema: any | LoadSchema): schema is LoadSchema {
  return schema !== undefined && typeof schema === 'object' && 'useNewCheckerFunction' in schema && 'validationSchema' in schema;
}


export interface LoadSchema {
  validationSchema: ValidationSchema;
  useNewCheckerFunction?: boolean;
}

export class TypeOf extends Set<string> {
  static String = new TypeOf('string');
  static Number = new TypeOf('number');
  static Boolean = new TypeOf('boolean');
  static BigInt = new TypeOf('bigint');
  static Function = new TypeOf('function');
  static Symbol = new TypeOf('symbol');
  static Object = new TypeOf('object');

  private constructor(typeOf: string) {
    super();
    super.add('string');
    super.add('number');
    super.add('boolean');
    super.add('bigint');
    super.add('function');
    super.add('symbol');
    super.add('object');
    if (this.has(typeOf)) {
      this._typeOf = typeOf;
    } else {
      throw new Error('Attempt to initialize TypeOf with value not compatible with operator "typeof"');
    }
  }

  private _typeOf: string;

  get typeOf(): string {
    return this._typeOf;
  }

  override add(value: string): this {
    throw new Error('TypeOf implementation of Set is immutable');
  }

  override clear() {
    throw new Error('TypeOf implementation of Set is immutable');
  }

  override delete(value: string): boolean {
    throw new Error('TypeOf implementation of Set is immutable');
  }
}

export function isTypeOf(typeOf: any | TypeOf): typeOf is TypeOf {
  return typeOf instanceof TypeOf;
}

export type ModuleDefinition = {
  moduleName: string,
  functionName?: string,
  constructorName?: string,
  propertyName?: string,
  paramsArray?: any[],
  loadSchema?: LoadSchema | TypeOf | AsyncCheckFunction | SyncCheckFunction,
};


export function isModuleDefinition(module: any | ModuleDefinition): module is ModuleDefinition {
  const moduleNameExists = 'moduleName' in module;
  const functionNameExists = 'functionName' in module;
  const constructorNameExists = 'constructorName' in module;
  const propertyNameExists = 'propertyName' in module;
  return moduleNameExists  // moduleName must always be present
    && ((!functionNameExists && !constructorNameExists && !propertyNameExists) // None of the constraints are present
      || (functionNameExists && !(constructorNameExists || propertyNameExists)) // functionName is present but not the other two
      || (constructorNameExists && !(functionNameExists || propertyNameExists)) // constructorName is present but not the other two
      || (propertyNameExists && !(functionNameExists || constructorNameExists))); // propertyName is present but not the other two
}

export function isConstrainedModuleDefinition(module: any | ModuleDefinition): module is ModuleDefinition {
  // One of the constraints is present (and only one).
  return isModuleDefinition(module) && (module.constructorName !== undefined || module.functionName !== undefined || module.propertyName !== undefined);
}

export const moduleDefinitionSchema: ValidationSchema = {
  moduleName: {
    type: 'string',
    optional: false
  },
  functionName: {
    type: 'string',
    optional: true
  },
  constructorName: {
    type: 'string',
    optional: true
  },
  propertyName: {
    type: 'string',
    optional: true
  },
  paramsArray: {
    type: 'array',
    optional: true,
    items: 'any'
  },
  loadSchema: [{
    type: 'object',
    optional: true,
    props: {
      useNewCheckerFunction: {type: 'boolean', optional: true},
      validationSchema: {type: 'any'}
    }
  }, {
    type: 'class',
    optional: true,
    instanceOf: TypeOf
  }, {
    type: 'function',
    optional: true
  }]
};

export const moduleDefinitionSchemaWrapper: ValidationSchema = {
  type: 'object',
  optional: true,
  props: moduleDefinitionSchema
};


const check = getValidator({useNewCustomCheckerFunction: true}).compile(moduleDefinitionSchema);

export function validateModuleDefinition(def: ModuleDefinition): true | ValidationError[] {
  const result = check(def);
  if (isPromise(result)) {
    throw new Error('Result cannot be a promise when validating the actual module definition');
  } else {
    return result;
  }
}


async function validateRunTimeSchema<T>(moduleName: string, moduleDef: ModuleDefinition, obj:NonNullable<any>, log: ModuleFactoryLogger = console): Promise<T> {
  try {
    let validationCheck: AsyncCheckFunction | SyncCheckFunction;
    if (moduleDef.loadSchema) {
      if (isTypeOf(moduleDef.loadSchema)) {
        if (typeof obj === moduleDef.loadSchema.typeOf) {
          return obj;
        } else {
          const result: ValidationError[] = [{
            actual: typeof obj,
            expected: moduleDef.loadSchema.typeOf,
            field: 'n/a',
            message: `returned instance failed 'typeof instance === "${moduleDef.loadSchema.typeOf}"'`,
            type: 'n/a'
          }];
          log.warn({moduleDef, moduleName, schema: 'TypeOf', obj, result}, 'Warn: TypeOf validation failed.');
          const err = new Error(`TypeOf validation failed for ${moduleName}`);
          log.error(err);
          return Promise.reject(err);
        }
      } else {
        if (isLoadSchema(moduleDef.loadSchema)) {
          // This is the least performant way by 100x...encourage user to pass a cached check function
          validationCheck = (getValidator({useNewCustomCheckerFunction: moduleDef.loadSchema.useNewCheckerFunction ?? false})).compile(moduleDef.loadSchema.validationSchema);
        } else {
          validationCheck = moduleDef.loadSchema;
        }
        if (isSyncCheckFunction(validationCheck)) {
          let result: true | ValidationError[];
          try {
            result = validationCheck(obj);
          } catch (err) {
            return Promise.reject(err);
          }
          if (result === true) {
            return Promise.resolve(obj);
          } else {
            log.warn({
              moduleDef,
              moduleName,
              schema: isLoadSchema(moduleDef.loadSchema) ? moduleDef.loadSchema : 'compiled',
              obj,
              result
            }, 'Warn: Sync validation failed.');
            const err = new Error(`Sync validation failed for ${moduleName}`);
            log.error(err);
            return Promise.reject(err);
          }
        } else if (isAsyncCheckFunction(validationCheck)) {
          const result = await validationCheck(obj);
          if (result === true) {
            return obj;
          } else {
            log.warn({
              moduleDef,
              moduleName,
              schema: isLoadSchema(moduleDef.loadSchema) ? moduleDef.loadSchema : 'compiled',
              obj,
              result
            }, 'Warn: Async validation failed.');
            const err = new Error(`Async failed for ${moduleName}`);
            log.error(err);
            return Promise.reject(err);
          }
        } else {
          return Promise.reject(new Error('Unreachable Code'));
        }
      }
    } else {
      return Promise.resolve(obj);
    }
  } catch (err) {
    log.error(err);
    return Promise.reject(err);
  }
}

/**
 * Load a json resource, analogous to require(), but some key differences because it leverages fs.readFile.
 *
 * @param moduleDef  The module definition.  Only the moduleName is used.
 *
 * The moduleName provides the path to the json file, and can be any string that
 * is accepted by readFile, including a file url as string, a relative path or an absolution path starting with /.  A
 * drive letter is not valid, if providing a path that starts with a drive letter you should convert it to a file URL.
 *
 * IMPORTANT:  Relative paths are resolved relative to the node process, i.e. where node was started and equivalent to
 * being relative to process.cwd. Therefore, moduleName should be  an absolute path starting with /, a relative  path
 * from where the node process launched, or an absolute path or file URL string created from some other way for example
 * using path.resolve()
 *
 * @param log
 */
export async function loadJSONResource<T>(moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): Promise<T> {
  try {
    const jsonContents = await readFile(moduleDef.moduleName, {encoding: 'utf-8'});
    return await validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, JSON.parse(jsonContents), log);
  } catch (err) {
    log.error(err);
    return Promise.reject(err);
  }
}

function relativePath(path: string): boolean {
  const relativeRegex = /^\.\/|\.\.\/[^]*$/;
  return relativeRegex.test(path);
}

function moduleAbsolutePath(path: string): string {
  return resolve(process.cwd(), path);
}

function _validateJSONPropertyFromModule<T>(jsonString: unknown, moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console) : Promise<T> {
  if (typeof jsonString === 'string') {
    const jsonObj: T = JSON.parse(jsonString);
    if (moduleDef.loadSchema) {
      return validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, jsonObj, log);
    } else {
      return Promise.resolve(jsonObj);
    }
  } else {
    const err = new Error(`module function ${moduleDef.moduleName}.${moduleDef.functionName} does not return a Promise for a string`);
    log.error(err);
    return Promise.reject(err);
  }
}


async function loadJSONPropertyFromModule<T>(module: any, moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): Promise<T> {
  if (moduleDef.functionName) {
    const resource = objectPath.get(module, moduleDef.functionName);
    if (typeof resource === 'function') {
      const jsonAsStringOrPromise = resource();
      if (isPromise(jsonAsStringOrPromise)) {
        const jsonString = await jsonAsStringOrPromise;
        return _validateJSONPropertyFromModule<T>(jsonString, moduleDef, log);
      } else {
        return _validateJSONPropertyFromModule<T>(jsonAsStringOrPromise, moduleDef, log);
      }
    } else {
      const err = new Error(`module property ${moduleDef.moduleName}.${moduleDef.functionName} does not point to a function`);
      log.error(err);
      return Promise.reject(err);
    }
  } else if (moduleDef.propertyName) {
    const resource = objectPath.get(module, moduleDef.propertyName);
    if (isPromise(resource)) {
      const jsonString = await resource;
      return _validateJSONPropertyFromModule<T>(jsonString, moduleDef, log);
    } else {
      return _validateJSONPropertyFromModule<T>(resource, moduleDef, log);
    }
  } else {
    const err = new Error('Either functionName or propertyName must be defined on moduleDef');
    log.error(err);
    return Promise.reject(err);
  }
}

export function loadJSONFromModule<T>(moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): Promise<T> {
  try {
    const functionName = moduleDef?.functionName?.trim();
    const propertyName = moduleDef?.propertyName?.trim();
    if (moduleDef?.moduleName && (functionName?.length || propertyName?.length)) {
      if (functionName?.length && propertyName?.length) {
        const err = new Error(`Only one of functionName ${moduleDef.functionName} or propertyName ${moduleDef.propertyName} may be specified for module ${moduleDef.moduleName}`);
        log.error(err);
        return Promise.reject(err);
      } else {
        let moduleName = moduleDef.moduleName;
        if (relativePath(moduleName)) {
          moduleName = pathToFileURL(moduleAbsolutePath(moduleName)).toString();
        }
        return import(moduleName)
          .then(module => {
            return loadJSONPropertyFromModule<T>(module, moduleDef, log);
          });
      }
    } else {
      const err = new Error(`moduleName [${moduleDef?.moduleName}] and either functionName [${moduleDef?.functionName}] or propertyName [${moduleDef.propertyName}] are required`);
      log.error(err);
      return Promise.reject(err);
    }
  } catch (err) {
    log.error(err);
    return Promise.reject(err);
  }
}


export async function loadFromModule<T>(moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): Promise<T> {
  // Set to false, actual loading process will determine
  // TODO: Remove
  try {
    let moduleName = moduleDef.moduleName;
    if (relativePath(moduleName)) {
      moduleName = pathToFileURL(moduleAbsolutePath(moduleName)).toString();
    }
    const module = await importModule(moduleName);
    let t: T | Promise<T>;
    let factoryFunctionName = moduleDef.functionName;
    if (!factoryFunctionName && !moduleDef.constructorName) {
      factoryFunctionName = 'default';
    }
    if (factoryFunctionName) {
      let factoryFunction: (...params: any[]) => T;
      factoryFunction = objectPath.get(module, factoryFunctionName);
      if (factoryFunction) {
        // Note:  Factory functions can be asynchronous
        if (moduleDef.paramsArray) {
          t = factoryFunction(...moduleDef.paramsArray);
        } else {
          t = factoryFunction();
        }
        // Factory function can return a promise
        if (isPromise(t)) {
          return t
            .then((tt: any) => {
              return validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, tt, log);
            });
        } else {
          return validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, t, log);
        }
      } else {
        const err = new Error(`moduleDef.functionName ${moduleDef.functionName} provided but does not resolve to a function`);
        log.error(err);
        return Promise.reject(err);
      }
    } else if (moduleDef.constructorName) {
      // Note: Constructor functions cannot be asynchronous
      const constructorFunction = objectPath.get(module, moduleDef.constructorName);
      if (constructorFunction) {
        if (moduleDef.paramsArray) {
          t = new constructorFunction(...moduleDef.paramsArray);
        } else {
          t = new constructorFunction();
        }
        return validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, t, log);
      } else {
        const err = new Error(`moduleDef.constructorName ${moduleDef.constructorName} provided but does not resolve to a constructor`);
        log.error(err);
        return Promise.reject(err);
      }
    } else {
      const err = new Error(`Neither functionName nor constructorName provided`);
      log.error(err);
      return Promise.reject(err);
    }
  } catch (err) {
    log.error(err);
    return Promise.reject(err);
  }
}


