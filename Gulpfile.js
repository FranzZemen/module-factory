import {cwd} from 'node:process';
import * as gulpBase from '@franzzemen/gulp-base';
import { createRequire } from "module";
import {join, dirname} from 'node:path';
import {npmu as npmuFunc} from '@franzzemen/npmu';
import {fileURLToPath} from 'url';

const requireModule = createRequire(import.meta.url);
gulpBase.init(requireModule('./package.json'), cwd() + '/tsconfig.src.json', cwd() + '/tsconfig.test.json', 100);
gulpBase.setMainBranch('main');


export const npmu  = (cb) => {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  npmuFunc([
    {
      path: join(__dirname, '../gulp-base'), packageName: '@franzzemen/gulp-base',
    }, {
      path: join(__dirname, '../npmu'), packageName: '@franzzemen/npmu',
    }, {
      path: join(__dirname, './'), packageName: '@franzzemen/app-utility',
    }])
    .then(() => {
      console.log('cb...');
      cb();
    })
}



export const test = gulpBase.test;

export const clean = gulpBase.clean;
export const buildTest = gulpBase.buildTest;
export default gulpBase.default;

export const patch = gulpBase.patch;
export const minor = gulpBase.minor;
export const major = gulpBase.major;

export const npmForceUpdateProject = gulpBase.npmForceUpdateProject;
export const npmUpdateProject = gulpBase.npmUpdateProject;
