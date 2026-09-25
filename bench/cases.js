var fs = require('fs');
var path = require('path');
var generate = require('./generate');

var FIXTURES_DIR = path.join(__dirname, 'fixtures');

function handWritten() {
  return fs.readdirSync(FIXTURES_DIR).filter(function (file) {
    return /\.[jt]sx$/.test(file);
  }).sort();
}

// Hand-written fixtures first, then the generated ones from small to large
function names() {
  return handWritten().concat(generate.names);
}

// Returns {name, filename, source}; generated cases get a virtual .jsx filename so Babel treats them like files
function load(name) {
  if (generate.names.indexOf(name) !== -1) {
    return {
      name: name,
      filename: path.join(__dirname, 'generated', name + '.jsx'),
      source: generate.generate(name)
    };
  }
  var filename = path.join(FIXTURES_DIR, name);

  return {
    name: name,
    filename: filename,
    source: fs.readFileSync(filename, 'utf8')
  };
}

module.exports = {
  names: names,
  load: load
};
