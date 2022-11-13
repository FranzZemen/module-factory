

class TestDataType {
  name = 'Test'
  eval () {
    return undefined;
  }
}
exports.TestDataType = TestDataType;

function create() {
  return new TestDataType();
}

exports.create = create;


function create2() {
  return new TestDataType();
}

exports.create2 = create2;

class BarThing {
  id = 15;
}

exports.BarThing = BarThing;

const foo = {
  id: 1,
  bar: () => {
      return new BarThing();
  }
}

exports.foo = foo;


function createString() {
  return 'hello world';
}

exports.createString = createString;


function createNumber() {
  return Promise.resolve(49);
}

exports.createNumber = createNumber;
