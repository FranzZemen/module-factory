

export class TestDataType {
  name: string = 'Test'
  eval (): number {
    return undefined;
  }
}

export default function create() {
  return new TestDataType();
}

export function create2() {
  return new TestDataType();
}

export class BarThing {
  id = 15;
}

export const foo = {
  id: 1,
  bar: () => {
      return new BarThing();
  }
}


export function createString() {
  return 'hello world';
}

export function createNumber(): Promise<number> {
  return Promise.resolve(49);
}
