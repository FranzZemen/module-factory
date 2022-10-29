

class BadDataType {
  name;
  bar () {
    return 1;
  }
}

exports.default = function create() {
  return new BadDataType();
}

exports.createAsyncFunc = function createAsyncFunc() {
  return Promise.resolve(50);
}
