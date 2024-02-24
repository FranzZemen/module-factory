export { importModule } from './import-helper.cjs';
import Validator from 'fastest-validator';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import objectPath from 'object-path';
import { pathToFileURL } from 'url';
import { isPromise } from 'util/types';
import { importModule } from './import-helper.cjs';
function isAsyncCheckFunction(check) {
    return check !== undefined && check.async === true;
}
function isSyncCheckFunction(check) {
    return check !== undefined && check.async === false;
}
export function isLoadSchema(schema) {
    return schema !== undefined && typeof schema === 'object' && 'useNewCheckerFunction' in schema && 'validationSchema' in schema;
}
export class TypeOf extends Set {
    constructor(typeOf) {
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
        }
        else {
            throw new Error('Attempt to initialize TypeOf with value not compatible with operator "typeof"');
        }
    }
    get typeOf() {
        return this._typeOf;
    }
    add(value) {
        throw new Error('TypeOf implementation of Set is immutable');
    }
    clear() {
        throw new Error('TypeOf implementation of Set is immutable');
    }
    delete(value) {
        throw new Error('TypeOf implementation of Set is immutable');
    }
}
TypeOf.String = new TypeOf('string');
TypeOf.Number = new TypeOf('number');
TypeOf.Boolean = new TypeOf('boolean');
TypeOf.BigInt = new TypeOf('bigint');
TypeOf.Function = new TypeOf('function');
TypeOf.Symbol = new TypeOf('symbol');
TypeOf.Object = new TypeOf('object');
export function isTypeOf(typeOf) {
    return typeOf instanceof TypeOf;
}
export function isModuleDefinition(module) {
    const moduleNameExists = 'moduleName' in module;
    const functionNameExists = 'functionName' in module;
    const constructorNameExists = 'constructorName' in module;
    const propertyNameExists = 'propertyName' in module;
    return moduleNameExists
        && ((!functionNameExists && !constructorNameExists && !propertyNameExists)
            || (functionNameExists && !(constructorNameExists || propertyNameExists))
            || (constructorNameExists && !(functionNameExists || propertyNameExists))
            || (propertyNameExists && !(functionNameExists || constructorNameExists)));
}
export function isConstrainedModuleDefinition(module) {
    return isModuleDefinition(module) && (module.constructorName !== undefined || module.functionName !== undefined || module.propertyName !== undefined);
}
export const moduleDefinitionSchema = {
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
                useNewCheckerFunction: { type: 'boolean', optional: true },
                validationSchema: { type: 'any' }
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
export const moduleDefinitionSchemaWrapper = {
    type: 'object',
    optional: true,
    props: moduleDefinitionSchema
};
const check = new Validator({ useNewCustomCheckerFunction: true }).compile(moduleDefinitionSchema);
export function validateModuleDefinition(def) {
    const result = check(def);
    if (isPromise(result)) {
        throw new Error('Result cannot be a promise when validating the actual module definition');
    }
    else {
        return result;
    }
}
async function validateRunTimeSchema(moduleName, moduleDef, obj, log = console) {
    try {
        let validationCheck;
        if (moduleDef.loadSchema) {
            if (isTypeOf(moduleDef.loadSchema)) {
                if (typeof obj === moduleDef.loadSchema.typeOf) {
                    return obj;
                }
                else {
                    const result = [{
                            actual: typeof obj,
                            expected: moduleDef.loadSchema.typeOf,
                            field: 'n/a',
                            message: `returned instance failed 'typeof instance === "${moduleDef.loadSchema.typeOf}"'`,
                            type: 'n/a'
                        }];
                    log.warn({ moduleDef, moduleName, schema: 'TypeOf', obj, result }, 'Warn: TypeOf validation failed.');
                    const err = new Error(`TypeOf validation failed for ${moduleName}`);
                    log.error(err);
                    return Promise.reject(err);
                }
            }
            else {
                if (isLoadSchema(moduleDef.loadSchema)) {
                    validationCheck = (new Validator({ useNewCustomCheckerFunction: moduleDef.loadSchema.useNewCheckerFunction })).compile(moduleDef.loadSchema.validationSchema);
                }
                else {
                    validationCheck = moduleDef.loadSchema;
                }
                if (isSyncCheckFunction(validationCheck)) {
                    let result;
                    try {
                        result = validationCheck(obj);
                    }
                    catch (err) {
                        return Promise.reject(err);
                    }
                    if (result === true) {
                        return Promise.resolve(obj);
                    }
                    else {
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
                }
                else if (isAsyncCheckFunction(validationCheck)) {
                    const result = await validationCheck(obj);
                    if (result === true) {
                        return obj;
                    }
                    else {
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
                }
            }
        }
        else {
            return Promise.resolve(obj);
        }
    }
    catch (err) {
        log.error(err);
        return Promise.reject(err);
    }
}
export async function loadJSONResource(moduleDef, log = console) {
    try {
        const jsonContents = await readFile(moduleDef.moduleName, { encoding: 'utf-8' });
        return await validateRunTimeSchema(moduleDef.moduleName, moduleDef, JSON.parse(jsonContents), log);
    }
    catch (err) {
        log.error(err);
        return Promise.reject(err);
    }
}
function relativePath(path) {
    const relativeRegex = /^\.\/|\.\.\/[^]*$/;
    return relativeRegex.test(path);
}
function moduleAbsolutePath(path) {
    return resolve(process.cwd(), path);
}
function _validateJSONPropertyFromModule(jsonString, moduleDef, log = console) {
    if (typeof jsonString === 'string') {
        const jsonObj = JSON.parse(jsonString);
        if (moduleDef.loadSchema) {
            return validateRunTimeSchema(moduleDef.moduleName, moduleDef, jsonObj, log);
        }
        else {
            return Promise.resolve(jsonObj);
        }
    }
    else {
        const err = new Error(`module function ${moduleDef.moduleName}.${moduleDef.functionName} does not return a Promise for a string`);
        log.error(err);
        return Promise.reject(err);
    }
}
async function loadJSONPropertyFromModule(module, moduleDef, log = console) {
    if (moduleDef.functionName) {
        const resource = objectPath.get(module, moduleDef.functionName);
        if (typeof resource === 'function') {
            const jsonAsStringOrPromise = resource();
            if (isPromise(jsonAsStringOrPromise)) {
                const jsonString = await jsonAsStringOrPromise;
                return _validateJSONPropertyFromModule(jsonString, moduleDef, log);
            }
            else {
                return _validateJSONPropertyFromModule(jsonAsStringOrPromise, moduleDef, log);
            }
        }
        else {
            const err = new Error(`module property ${moduleDef.moduleName}.${moduleDef.functionName} does not point to a function`);
            log.error(err);
            return Promise.reject(err);
        }
    }
    else if (moduleDef.propertyName) {
        const resource = objectPath.get(module, moduleDef.propertyName);
        if (isPromise(resource)) {
            const jsonString = await resource;
            return _validateJSONPropertyFromModule(jsonString, moduleDef, log);
        }
        else {
            return _validateJSONPropertyFromModule(resource, moduleDef, log);
        }
    }
    else {
        const err = new Error('Either functionName or propertyName must be defined on moduleDef');
        log.error(err);
        return Promise.reject(err);
    }
}
export function loadJSONFromModule(moduleDef, log = console) {
    try {
        const functionName = moduleDef?.functionName?.trim();
        const propertyName = moduleDef?.propertyName?.trim();
        if (moduleDef?.moduleName && (functionName?.length || propertyName?.length)) {
            if (functionName?.length && propertyName?.length) {
                const err = new Error(`Only one of functionName ${moduleDef.functionName} or propertyName ${moduleDef.propertyName} may be specified for module ${moduleDef.moduleName}`);
                log.error(err);
                return Promise.reject(err);
            }
            else {
                let moduleName = moduleDef.moduleName;
                if (relativePath(moduleName)) {
                    moduleName = pathToFileURL(moduleAbsolutePath(moduleName)).toString();
                }
                return importModule(moduleName)
                    .then(module => {
                    return loadJSONPropertyFromModule(module, moduleDef, log);
                });
            }
        }
        else {
            const err = new Error(`moduleName [${moduleDef?.moduleName}] and either functionName [${moduleDef?.functionName}] or propertyName [${moduleDef.propertyName}] are required`);
            log.error(err);
            return Promise.reject(err);
        }
    }
    catch (err) {
        log.error(err);
        return Promise.reject(err);
    }
}
export async function loadFromModule(moduleDef, log = console) {
    try {
        let moduleName = moduleDef.moduleName;
        if (relativePath(moduleName)) {
            moduleName = pathToFileURL(moduleAbsolutePath(moduleName)).toString();
        }
        const module = await importModule(moduleName);
        let t;
        let factoryFunctionName = moduleDef.functionName;
        if (!factoryFunctionName && !moduleDef.constructorName) {
            factoryFunctionName = 'default';
        }
        if (factoryFunctionName) {
            let factoryFunction;
            factoryFunction = objectPath.get(module, factoryFunctionName);
            if (factoryFunction) {
                if (moduleDef.paramsArray) {
                    t = factoryFunction(...moduleDef.paramsArray);
                }
                else {
                    t = factoryFunction();
                }
                if (isPromise(t)) {
                    return t
                        .then((tt) => {
                        return validateRunTimeSchema(moduleDef.moduleName, moduleDef, tt, log);
                    });
                }
                else {
                    return validateRunTimeSchema(moduleDef.moduleName, moduleDef, t, log);
                }
            }
            else {
                const err = new Error(`moduleDef.functionName ${moduleDef.functionName} provided but does not resolve to a function`);
                log.error(err);
                return Promise.reject(err);
            }
        }
        else if (moduleDef.constructorName) {
            const constructorFunction = objectPath.get(module, moduleDef.constructorName);
            if (constructorFunction) {
                if (moduleDef.paramsArray) {
                    t = new constructorFunction(...moduleDef.paramsArray);
                }
                else {
                    t = new constructorFunction();
                }
                return validateRunTimeSchema(moduleDef.moduleName, moduleDef, t, log);
            }
            else {
                const err = new Error(`moduleDef.constructorName ${moduleDef.constructorName} provided but does not resolve to a constructor`);
                log.error(err);
                return Promise.reject(err);
            }
        }
        else {
            const err = new Error(`Neither functionName nor constructorName provided`);
            log.error(err);
            return Promise.reject(err);
        }
    }
    catch (err) {
        log.error(err);
        return Promise.reject(err);
    }
}
//# sourceMappingURL=index.js.map