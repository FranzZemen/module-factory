import Validator, {AsyncCheckFunction, SyncCheckFunction, ValidationError, ValidationSchema} from 'fastest-validator';
import objectPath from 'object-path';
import {isPromise} from 'util/types';
import {readFile} from 'node:fs/promises';
import {importModule} from './import-helper.cjs';

export interface ModuleFactoryLogger {
  error(err, ...params);

  warn(data, message?: string, ...params);

  info(data, message?: string, ...params);

  debug(data, message?: string, ...params);

  trace(data, message?: string, ...params);
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

  add(value: string): this {
    throw new Error('TypeOf implementation of Set is immutable');
  }

  clear() {
    throw new Error('TypeOf implementation of Set is immutable');
  }

  delete(value: string): boolean {
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
    type: 'function'
  }]
};


const check = new Validator({useNewCustomCheckerFunction: true}).compile(moduleDefinitionSchema);

export function validateModuleDefinition(def: ModuleDefinition): true | ValidationError[] {
  const result = check(def);
  if (isPromise(result)) {
    throw new Error('Result cannot be a promise when validating the actual module definition');
  } else {
    return result;
  }
}


function validateRunTimeSchema<T>(moduleName: string, moduleDef: ModuleDefinition, obj, log: ModuleFactoryLogger = console): Promise<T> {
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
        validationCheck = (new Validator({useNewCustomCheckerFunction: moduleDef.loadSchema.useNewCheckerFunction})).compile(moduleDef.loadSchema.validationSchema);
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
        const resultPromise: Promise<true | ValidationError[]> = validationCheck(obj);
        return resultPromise
          .then(result => {
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
          });
      }
    }
  } else {
    return Promise.resolve(obj);
  }
}

export function loadJSONResource<T>(moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): Promise<T> {
  try {
    return readFile(moduleDef.moduleName, {encoding: 'utf-8'})
      .then(jsonContents => {
        try {
          return validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, JSON.parse(jsonContents), log);
        } catch (err) {
          log.error(err);loadJSONFromModule
          return Promise.reject(err);
        }
      })
      .catch(err => {
        log.error(err);
        return Promise.reject(err);
      });
  } catch(err) {
    log.error(err);
    return Promise.reject(err);
  }
}

function loadJSONPropertyFromModule<T>(module: any, moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): Promise<T> {
  if (moduleDef.functionName) {
    const resource = objectPath.get(module, moduleDef.functionName);
    if (typeof resource === 'function') {
      const jsonAsStringOrPromise = resource();
      if (isPromise(jsonAsStringOrPromise)) {
        return jsonAsStringOrPromise
          .then(jsonAsString => {
            if (typeof jsonAsString === 'string') {
              const jsonObj: T = JSON.parse(jsonAsString);
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
          });
      } else {
        if (typeof jsonAsStringOrPromise === 'string') {
          const jsonObj: T = JSON.parse(jsonAsStringOrPromise);
          if (moduleDef.loadSchema) {
            return validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, jsonObj, log);
          } else {
            return Promise.resolve(jsonObj);
          }
        } else {
          const err = new Error(`module function ${moduleDef.moduleName}.${moduleDef.functionName} does not return a string`);
          log.error(err);
          return Promise.reject(err);
        }
      }
    } else {
      const err = new Error(`module property ${moduleDef.moduleName}.${moduleDef.functionName} does not point to a function`);
      log.error(err);
      return Promise.reject(err);
    }
  } else if (moduleDef.propertyName) {
    const resource = objectPath.get(module, moduleDef.propertyName);
    if (isPromise(resource)) {
      resource
        .then((jsonAsString: string) => {
          if (typeof jsonAsString === 'string') {
            const jsonObj: T = JSON.parse(jsonAsString);
            if (moduleDef.loadSchema) {
              return validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, jsonObj, log);
            } else {
              return Promise.resolve(jsonObj);
            }
          } else {
            const err = new Error(`module property ${moduleDef.moduleName}.${moduleDef.propertyName} does not point to a Promise for a string`);
            log.error(err);
            return Promise.reject(err);
          }
        });
    } else {
      if (typeof resource === 'string') {
        const jsonObj: T = JSON.parse(resource);
        if (moduleDef.loadSchema) {
          return validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, jsonObj, log);
        } else {
          return Promise.resolve(jsonObj);
        }
      } else {
        const err = new Error(`module property ${moduleDef.moduleName}.${moduleDef.propertyName} does not point to a string`);
        log.error(err);
        return Promise.reject(err);
      }
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
        return importModule(moduleDef.moduleName)
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


export function loadFromModule<T>(moduleDef: ModuleDefinition, log: ModuleFactoryLogger = console): Promise<T> {
  // Set to false, actual loading process will determine
  // TODO: Remove
  try {
    return importModule(moduleDef.moduleName)
      .then(module => {
        let t: T;
        let factoryFunctionName = moduleDef.functionName;
        if (!factoryFunctionName && !moduleDef.constructorName) {
          factoryFunctionName = 'default';
        }
        if (factoryFunctionName) {
          let factoryFunction: (...params) => T;
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
                .then((tt: T) => {
                  return validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, tt, log);
                });
            } else {
              return Promise.resolve<T>(validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, t, log));
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
            return Promise.resolve(validateRunTimeSchema<T>(moduleDef.moduleName, moduleDef, t, log));
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
      });
  } catch (err) {
    log.error(err);
    return Promise.reject(err);
  }
}


