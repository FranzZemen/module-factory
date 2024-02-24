"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFromModule = exports.loadJSONFromModule = exports.loadJSONResource = exports.validateModuleDefinition = exports.moduleDefinitionSchemaWrapper = exports.moduleDefinitionSchema = exports.isConstrainedModuleDefinition = exports.isModuleDefinition = exports.isTypeOf = exports.TypeOf = exports.isLoadSchema = exports.importModule = void 0;
var import_helper_cjs_1 = require("./import-helper.cjs");
Object.defineProperty(exports, "importModule", { enumerable: true, get: function () { return import_helper_cjs_1.importModule; } });
const fastest_validator_1 = __importDefault(require("fastest-validator"));
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const object_path_1 = __importDefault(require("object-path"));
const url_1 = require("url");
const types_1 = require("util/types");
const import_helper_cjs_2 = require("./import-helper.cjs");
function isAsyncCheckFunction(check) {
    return check !== undefined && check.async === true;
}
function isSyncCheckFunction(check) {
    return check !== undefined && check.async === false;
}
function isLoadSchema(schema) {
    return schema !== undefined && typeof schema === 'object' && 'useNewCheckerFunction' in schema && 'validationSchema' in schema;
}
exports.isLoadSchema = isLoadSchema;
class TypeOf extends Set {
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
exports.TypeOf = TypeOf;
TypeOf.String = new TypeOf('string');
TypeOf.Number = new TypeOf('number');
TypeOf.Boolean = new TypeOf('boolean');
TypeOf.BigInt = new TypeOf('bigint');
TypeOf.Function = new TypeOf('function');
TypeOf.Symbol = new TypeOf('symbol');
TypeOf.Object = new TypeOf('object');
function isTypeOf(typeOf) {
    return typeOf instanceof TypeOf;
}
exports.isTypeOf = isTypeOf;
function isModuleDefinition(module) {
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
exports.isModuleDefinition = isModuleDefinition;
function isConstrainedModuleDefinition(module) {
    return isModuleDefinition(module) && (module.constructorName !== undefined || module.functionName !== undefined || module.propertyName !== undefined);
}
exports.isConstrainedModuleDefinition = isConstrainedModuleDefinition;
exports.moduleDefinitionSchema = {
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
exports.moduleDefinitionSchemaWrapper = {
    type: 'object',
    optional: true,
    props: exports.moduleDefinitionSchema
};
const check = new fastest_validator_1.default({ useNewCustomCheckerFunction: true }).compile(exports.moduleDefinitionSchema);
function validateModuleDefinition(def) {
    const result = check(def);
    if ((0, types_1.isPromise)(result)) {
        throw new Error('Result cannot be a promise when validating the actual module definition');
    }
    else {
        return result;
    }
}
exports.validateModuleDefinition = validateModuleDefinition;
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
                    validationCheck = (new fastest_validator_1.default({ useNewCustomCheckerFunction: moduleDef.loadSchema.useNewCheckerFunction })).compile(moduleDef.loadSchema.validationSchema);
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
async function loadJSONResource(moduleDef, log = console) {
    try {
        const jsonContents = await (0, promises_1.readFile)(moduleDef.moduleName, { encoding: 'utf-8' });
        return await validateRunTimeSchema(moduleDef.moduleName, moduleDef, JSON.parse(jsonContents), log);
    }
    catch (err) {
        log.error(err);
        return Promise.reject(err);
    }
}
exports.loadJSONResource = loadJSONResource;
function relativePath(path) {
    const relativeRegex = /^\.\/|\.\.\/[^]*$/;
    return relativeRegex.test(path);
}
function moduleAbsolutePath(path) {
    return (0, node_path_1.resolve)(process.cwd(), path);
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
        const resource = object_path_1.default.get(module, moduleDef.functionName);
        if (typeof resource === 'function') {
            const jsonAsStringOrPromise = resource();
            if ((0, types_1.isPromise)(jsonAsStringOrPromise)) {
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
        const resource = object_path_1.default.get(module, moduleDef.propertyName);
        if ((0, types_1.isPromise)(resource)) {
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
function loadJSONFromModule(moduleDef, log = console) {
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
                    moduleName = (0, url_1.pathToFileURL)(moduleAbsolutePath(moduleName)).toString();
                }
                return (0, import_helper_cjs_2.importModule)(moduleName)
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
exports.loadJSONFromModule = loadJSONFromModule;
async function loadFromModule(moduleDef, log = console) {
    try {
        let moduleName = moduleDef.moduleName;
        if (relativePath(moduleName)) {
            moduleName = (0, url_1.pathToFileURL)(moduleAbsolutePath(moduleName)).toString();
        }
        const module = await (0, import_helper_cjs_2.importModule)(moduleName);
        let t;
        let factoryFunctionName = moduleDef.functionName;
        if (!factoryFunctionName && !moduleDef.constructorName) {
            factoryFunctionName = 'default';
        }
        if (factoryFunctionName) {
            let factoryFunction;
            factoryFunction = object_path_1.default.get(module, factoryFunctionName);
            if (factoryFunction) {
                if (moduleDef.paramsArray) {
                    t = factoryFunction(...moduleDef.paramsArray);
                }
                else {
                    t = factoryFunction();
                }
                if ((0, types_1.isPromise)(t)) {
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
            const constructorFunction = object_path_1.default.get(module, moduleDef.constructorName);
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
exports.loadFromModule = loadFromModule;
//# sourceMappingURL=index.js.map