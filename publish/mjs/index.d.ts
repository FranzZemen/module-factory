export { importModule } from './import-helper.cjs';
import { AsyncCheckFunction, SyncCheckFunction, ValidationError, ValidationSchema } from 'fastest-validator';
export interface ModuleFactoryLogger {
    error(err: any, ...params: any[]): any;
    warn(data: any, message?: string, ...params: any[]): any;
    info(data: any, message?: string, ...params: any[]): any;
    debug(data: any, message?: string, ...params: any[]): any;
    trace(data: any, message?: string, ...params: any[]): any;
}
export declare function isLoadSchema(schema: any | LoadSchema): schema is LoadSchema;
export interface LoadSchema {
    validationSchema: ValidationSchema;
    useNewCheckerFunction?: boolean;
}
export declare class TypeOf extends Set<string> {
    static String: TypeOf;
    static Number: TypeOf;
    static Boolean: TypeOf;
    static BigInt: TypeOf;
    static Function: TypeOf;
    static Symbol: TypeOf;
    static Object: TypeOf;
    private constructor();
    private _typeOf;
    get typeOf(): string;
    add(value: string): this;
    clear(): void;
    delete(value: string): boolean;
}
export declare function isTypeOf(typeOf: any | TypeOf): typeOf is TypeOf;
export type ModuleDefinition = {
    moduleName: string;
    functionName?: string;
    constructorName?: string;
    propertyName?: string;
    paramsArray?: any[];
    loadSchema?: LoadSchema | TypeOf | AsyncCheckFunction | SyncCheckFunction;
};
export declare function isModuleDefinition(module: any | ModuleDefinition): module is ModuleDefinition;
export declare function isConstrainedModuleDefinition(module: any | ModuleDefinition): module is ModuleDefinition;
export declare const moduleDefinitionSchema: ValidationSchema;
export declare const moduleDefinitionSchemaWrapper: ValidationSchema;
export declare function validateModuleDefinition(def: ModuleDefinition): true | ValidationError[];
export declare function loadJSONResource<T>(moduleDef: ModuleDefinition, log?: ModuleFactoryLogger): Promise<T>;
export declare function loadJSONFromModule<T>(moduleDef: ModuleDefinition, log?: ModuleFactoryLogger): Promise<T>;
export declare function loadFromModule<T>(moduleDef: ModuleDefinition, log?: ModuleFactoryLogger): Promise<T>;
