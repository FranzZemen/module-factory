import {
  isConstrainedModuleDefinition,
  isModuleDefinition,
  loadFromModule,
  loadJSONFromModule,
  loadJSONResource,
  LoadSchema,
  ModuleDefinition,
  TypeOf
  // @ts-ignore
} from '@franzzemen/module-factory';
import chai from 'chai';
import Validator, {ValidationError, ValidationSchema} from 'fastest-validator';
import 'mocha';
import {join} from 'path';
import {pathToFileURL} from 'url';
import {isPromise} from 'util/types';
import {_dirname} from './meta-help.cjs';

let should = chai.should();
let expect = chai.expect;

const unreachableCode = false;

describe('module-factory', () => {
  describe('module-factory.test', () => {
    describe('module factory tests', () => {
      it('should validate a module definition', () => {
        const moduleDefinition: ModuleDefinition = {
          moduleName: 'Hello',
          loadSchema: TypeOf.Number,
          constructorName: 'Hello',
          functionName: 'Hello',
          propertyName: 'Hello',
          asyncFactory: true,
          paramsArray: [
            'hell', 5.0, {}
          ]
        };
      });
      it('should validate module, not constrained module', () => {
        const obj = {moduleName: 'SomeModule'};
        isModuleDefinition(obj).should.be.true;
        isConstrainedModuleDefinition(obj).should.be.false;
      });
      it('should fail to validate module', () => {
        const obj = {moduleName: 'SomeModule', functionName: 'someFunction', constructorName: 'someConstructor'};
        isModuleDefinition(obj).should.be.false;
        isConstrainedModuleDefinition(obj).should.be.false;
      });
      it('should fail to validate module', () => {
        const obj = {moduleName: 'SomeModule', functionName: 'someFunction', propertyName: 'someProperty'};
        isModuleDefinition(obj).should.be.false;
        isConstrainedModuleDefinition(obj).should.be.false;
      });
      it('should fail to validate module', () => {
        const obj = {moduleName: 'SomeModule', constructorName: 'someConstructor', propertyName: 'someProperty'};
        isModuleDefinition(obj).should.be.false;
        isConstrainedModuleDefinition(obj).should.be.false;
      });
      it('should fail to validate module for constrained function', () => {
        const obj = {moduleName: 'SomeModule', functionName: 'someFunction'};
        isModuleDefinition(obj).should.be.true;
        isConstrainedModuleDefinition(obj).should.be.true;
      });
      it('should fail to validate module for constrained constructor', () => {
        const obj = {moduleName: 'SomeModule', constructorName: 'someConstructor'};
        isModuleDefinition(obj).should.be.true;
        isConstrainedModuleDefinition(obj).should.be.true;
      });
      it('should fail to validate module for constrained property', () => {
        const obj = {moduleName: 'SomeModule', constructorName: 'someProperty'};
        isModuleDefinition(obj).should.be.true;
        isConstrainedModuleDefinition(obj).should.be.true;

      });
      it('should fail to load via module default from commonjs bad-extended with no function or constructor name', async () => {
        try {
          const result = await loadFromModule<any>({
            moduleName: pathToFileURL(join(_dirname, './bad-extended.cjs')).toString()
          });
          unreachableCode.should.be.true;
        } catch (err) {
          err.should.exist;
        }
      });
      it('should load via module default from commonjs bad-extended with no function or constructor name, using default for function name', () => {
        try {
          const result = loadFromModule<any>({
            moduleName: pathToFileURL(join(_dirname, './bad-extended.cjs')).toString()
          });
          result.should.exist;
        } catch (err) {
          unreachableCode.should.be.true;
        }
      });
      it('should load a via module function from relative es extended', () => {
        const result = loadFromModule<any>({
          moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
          functionName: 'create2'
        });
        expect(result).to.exist;
        isPromise(result).should.be.true;
        return result.then(res => {
          res.name.should.equal('Test');
          return;
        }, err => {
          unreachableCode.should.be.true;
          return;
        });
      });
      it('should load a via module function from absolute es extended', () => {
        const moduleName = pathToFileURL(join(_dirname, './extended.cjs')).toString();
        const result = loadFromModule<any>({
          moduleName,
          functionName: 'create2'
        });
        expect(result).to.exist;
        isPromise(result).should.be.true;
        return result.then(res => {
          res.name.should.equal('Test');
          return;
        }, err => {
          unreachableCode.should.be.true;
          return;
        });
      });
      it('should load a via module constructor from es extended', () => {
        const result = loadFromModule<any>({
          moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
          constructorName: 'TestDataType'
        });
        expect(result).to.exist;
        isPromise(result).should.be.true;
        return result.then(res => {
          return res.name.should.equal('Test');
        }, err => {
          console.error(err);
          unreachableCode.should.be.true;
          return err;
        })
          .catch(err => {
            console.error(err);
            unreachableCode.should.be.true;
            return;
          });

      });
      it('should load json with no schema check', async () => {
        const moduleName = join(_dirname, './test-json.json');
        const testJsonObj: any = await loadJSONResource({
          moduleName
        });
        (typeof testJsonObj).should.equal('object');
        testJsonObj.name.should.exist;
        testJsonObj.id.should.exist;
      });
      it('should load json with passing schema check', async () => {
        const loadSchema: LoadSchema = {
          validationSchema: {
            name: {type: 'string'},
            id: {type: 'number'}
          },
          useNewCheckerFunction: false
        };
        try {
          const testJsonObj: any = await loadJSONResource({
            moduleName: join(_dirname, '/test-json.json'),
            loadSchema
          });
          (typeof testJsonObj).should.equal('object');
          testJsonObj.name.should.exist;
          testJsonObj.id.should.exist;
        } catch (err) {
          unreachableCode.should.be.true;
        }
      });
      it('should load json with failing schema check', async () => {
        const loadSchema: LoadSchema = {
          validationSchema: {
            name: {type: 'string'},
            id: {type: 'number'},
            doIt: {type: 'string'}
          },
          useNewCheckerFunction: false
        };
        try {
          const testJsonObj: any = await loadJSONResource({
            moduleName: join(_dirname, '/test-json.json'),
            loadSchema
          });
          unreachableCode.should.be.true;
        } catch (err) {
          err.should.exist;
        }
      });
      it('should load json with async schema check', () => {
        const loadSchema: LoadSchema = {
          validationSchema: {
            $$async: true,
            name: {type: 'string'},
            id: {type: 'number'},
            label: {
              type: 'string',
              custom: async (v, errors: ValidationError[]) => {
                if (v !== 'A') {
                  errors.push({type: 'unique', actual: v, field: 'label', expected: 'A'});
                }
                return v;
              }
            }
          },
          useNewCheckerFunction: true
        };
        const testJsonObj: any = loadJSONResource({
          moduleName: join(_dirname, './test-json.json'),
          loadSchema
        });
        isPromise(testJsonObj).should.be.true;
        return testJsonObj.then(obj => {
          obj.label.should.equal('A');
          return;
        });
      });
      it('should load json with async schema fail', () => {
        const loadSchema: LoadSchema = {
          validationSchema: {
            $$async: true,
            name: {type: 'string'},
            id: {type: 'number'},
            label: {
              type: 'string',
              custom: async (v, errors: ValidationError[]) => {
                if (v !== 'B') {
                  errors.push({
                    type: 'unique',
                    actual: v,
                    field: 'label',
                    expected: 'B',
                    message: 'Wrong value for label'
                  });
                }
                return v;
              }
            }
          },
          useNewCheckerFunction: true
        };
        const testJsonObj: any = loadJSONResource({
          moduleName: join(_dirname, './test-json.json'),
          loadSchema
        });
        isPromise(testJsonObj).should.be.true;
        return testJsonObj.then(obj => {
          unreachableCode.should.be.true;
          return;
        }, err => {
          err.should.exist;
          return;
        });
      });
      it('should load json with compiled async check', () => {
        const schema: ValidationSchema = {
          $$async: true,
          name: {type: 'string'},
          id: {type: 'number'},
          label: {
            type: 'string',
            custom: async (v, errors: ValidationError[]) => {
              if (v !== 'A') {
                errors.push({type: 'unique', actual: v, field: 'label', expected: 'A'});
              }
              return v;
            }
          }
        };
        const loadSchema = (new Validator({useNewCustomCheckerFunction: true})).compile(schema);
        const testJsonObj: any = loadJSONResource({
          moduleName: join(_dirname, './test-json.json'),
          loadSchema
        });
        isPromise(testJsonObj).should.be.true;
        return testJsonObj.then(obj => {
          obj.label.should.equal('A');
          return;
        });
      });
      it('should load a via module function from es extended with successful schema check on moduleDef', () => {
        const schema: LoadSchema = {
          validationSchema: {
            name: {type: 'string'}
          },
          useNewCheckerFunction: true
        };
        const module: ModuleDefinition = {
          moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
          functionName: 'create2',
          loadSchema: schema
        };
        const result = loadFromModule<any>(module);
        expect(result).to.exist;
        isPromise(result).should.be.true;
        return result.then(res => {
          res.name.should.equal('Test');
          return;
        }, err => {
          console.log(err);
          unreachableCode.should.be.true;
          return;
        });
      });
      it('should load a via module function from es extended with unsuccessful schema check on moduleDef', () => {
        const schema: LoadSchema = {
          validationSchema: {
            name: {type: 'string'},
            dummy: {type: 'number'}
          },
          useNewCheckerFunction: true
        };
        const result = loadFromModule<any>({
          moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
          functionName: 'create2',
          loadSchema: schema
        });
        expect(result).to.exist;
        isPromise(result).should.be.true;
        return result.then(res => {
          unreachableCode.should.be.true;
          return;
        }, err => {
          err.should.exist;
          return;
        });
      });
      it('should load a via module function from es extended, deep nested function name', () => {
        const result = loadFromModule<any>({
          moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
          functionName: 'foo.bar'
        });
        expect(result).to.exist;
        isPromise(result).should.be.true;
        return result.then(res => {
          res.id.should.equal(15);
          return;
        }, err => {
          unreachableCode.should.be.true;
          return;
        });
      });
      it('should load jason from module property', () => {
        const moduleDef: ModuleDefinition = {
          moduleName: '@franzzemen/test',
          propertyName: 'jsonStr'
        };
        const objPromise = loadJSONFromModule(moduleDef);
        objPromise.should.exist;
        if (isPromise(objPromise)) {
          return objPromise
            .then(obj => {
              obj['prop'].should.equal('jsonStr');
              return;
            }).catch(err => {
              console.error(err);
              unreachableCode.should.be.true;
              return;
            });
        } else {
          unreachableCode.should.be.true;
        }
      });
      it('should load jason from deep nested module property', () => {
        const moduleDef: ModuleDefinition = {
          moduleName: '@franzzemen/test',
          propertyName: 'nestedJsonStr.jsonStr'
        };
        const objPromise = loadJSONFromModule(moduleDef);
        objPromise.should.exist;
        if (isPromise(objPromise)) {
          return objPromise
            .then(obj => {
              obj['prop'].should.equal('jsonStr');
              return;
            }).catch(err => {
              console.error(err);
              unreachableCode.should.be.true;
              return;
            });
        } else {
          objPromise['prop'].should.equal('jsonStr');
        }
      });
      it('should load object from package', () => {
        const moduleDef: ModuleDefinition = {
          moduleName: '@franzzemen/test',
          functionName: 'getObj'
        };
        const objPromise = loadFromModule(moduleDef);
        objPromise.should.exist;
        if (isPromise(objPromise)) {
          return objPromise
            .then(obj => {
              obj['name'].should.equal('test');
              return;
            }).catch(err => {
              console.error(err);
              unreachableCode.should.be.true;
              return;
            });
        } else {
          unreachableCode.should.be.true;
        }
      });
      it('should load object from package with factory function parameters', () => {
        const moduleDef: ModuleDefinition = {
          moduleName: '@franzzemen/test',
          functionName: 'getObjWithParameters',
          paramsArray: ['year', 1999]
        };
        const objPromise = loadFromModule(moduleDef);
        objPromise.should.exist;
        if (isPromise(objPromise)) {
          return objPromise
            .then(obj => {
              obj['label'].should.equal('year');
              obj['id'].should.equal(1999);
              return;
            }).catch(err => {
              console.error(err);
              unreachableCode.should.be.true;
              return;
            });
        } else {
          unreachableCode.should.be.true;
        }
      });
      it('should load a via module function from es extended with successful TypeOf check', () => {
        const module: ModuleDefinition = {
          moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
          functionName: 'createString',
          loadSchema: TypeOf.String
        };
        const result = loadFromModule<string>(module);
        expect(result).to.exist;
        isPromise(result).should.be.true;
        if (isPromise(result)) {
          return result.then(res => {
            expect(res).to.equal('hello world');
            return;
          }, err => {
            console.error(err);
            unreachableCode.should.be.true;
            return;
          });
        }
      });
      it('should load a via module function from es extended with unsuccessful TypeOf check', () => {

        const result = loadFromModule<string>({
          moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
          functionName: 'createString',
          loadSchema: TypeOf.Number
        });
        expect(result).to.exist;
        isPromise(result).should.be.true;
        if (isPromise(result)) {
          return result.then(res => {
            unreachableCode.should.be.true;
            return;
          }, err => {
            err.should.exist;
            err.message.startsWith('TypeOf').should.be.true;
            return;
          });
        }
      });
      it('should load a via module function from es extended with successful TypeOf load schema', () => {
        const result = loadFromModule<string>({
          moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
          functionName: 'createString',
          loadSchema: TypeOf.String
        });
        expect(result).to.exist;
        isPromise(result).should.be.true;
        if (isPromise(result)) {
          return result.then(res => {
            expect(res).to.equal('hello world');
            return;
          }, err => {
            console.error(err);
            unreachableCode.should.be.true;
            return;
          });
        }
      });
      it('should load a via module function from es extended with unsuccessful TypeOf check', () => {

        const result = loadFromModule<string>({
          moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
          functionName: 'createString',
          loadSchema: TypeOf.Number
        });
        expect(result).to.exist;
        isPromise(result).should.be.true;
        if (isPromise(result)) {
          return result.then(res => {
            unreachableCode.should.be.true;
            return;
          }, err => {
            err.should.exist;
            err.message.startsWith('TypeOf').should.be.true;
            return;
          });
        }
      });
      it('should load a via module function returning a promise from es extended number 49', () => {
        const module: ModuleDefinition = {
          moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
          functionName: 'createNumber',
          loadSchema: TypeOf.Number
        };
        const result = loadFromModule<string>(module);
        expect(result).to.exist;
        isPromise(result).should.be.true;
        if (isPromise(result)) {
          return result.then(res => {
            res.should.equal(49);
            return;
          }, err => {
            unreachableCode.should.be.true;
            return;
          });
        }
      });
      it('should fail load a via module function from es extended with throwOnAsync = true', () => {
        try {
          const result = loadFromModule<string>({
            moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
            functionName: 'createString',
            loadSchema: TypeOf.Number
          });
          unreachableCode.should.be.true;
        } catch (err) {
          err.should.exist;
        }
      });
      it('should load promise via module default from commonjs bad-extended, for function name createAsyncFunc', () => {
        try {
          const module: ModuleDefinition = {
            moduleName: pathToFileURL(join(_dirname, './bad-extended.cjs')).toString(),
            functionName: 'createAsyncFunc'
          };
          const result = loadFromModule<any>(module);
          if (isPromise(result)) {
            return result
              .then(someResult => {
                someResult.should.equal(50);
                return;
              });
          } else {
            unreachableCode.should.be.true;
          }
        } catch (err) {
          unreachableCode.should.be.true;
        }
      });
      it('should not load promise via module default from commonjs bad-extended, for function name createAsyncFunc, with throwOnAsync true', () => {
        try {
          const result = loadFromModule<any>({
            moduleName: pathToFileURL(join(_dirname, './extended.cjs')).toString(),
            functionName: 'createAsyncFunc'
          });
          unreachableCode.should.be.true;
        } catch (err) {
          err.should.exist;
        }
      });
    });
    describe('Examples', () => {
      it('Example 1: An example of loading from a .json file without validation, synchronously', () => {
        type TestObj = { key: string, value: string };
        const obj = loadJSONResource<TestObj>({
          moduleName: join(_dirname, './example-json.json')
        }) as TestObj;
      });
      it('Example 1a: Example 1 with a LoadSchema', () => {
        type TestObj = { key: string, value: string };


        const loadSchema: LoadSchema = {
          validationSchema: {
            key: {type: 'string'},
            value: {type: 'number'}
          }, useNewCheckerFunction: false
        };

        try {
          const obj = loadJSONResource<TestObj>({
            moduleName: join(_dirname, '/example-json.json'),
            loadSchema
          }) as TestObj;
          unreachableCode.should.be.true;
        } catch (err) {
          // Error expected;
          unreachableCode.should.be.false;
        }
      });
    });
  });
});
