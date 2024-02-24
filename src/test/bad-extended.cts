

export class BadDataType {
  name: string = '';
  bar () {
    return 1;
  }
}

export function create() {
  return new BadDataType();
}

export function createAsyncFunc() {
  return Promise.resolve(50);
}
