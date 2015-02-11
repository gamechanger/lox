var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var _s = require('underscore.string');

var initialize = function() {
  var resourcesDir = path.join(__dirname, '../resources');
  var luaFiles = fs.readdirSync(resourcesDir);
  _.each(luaFiles, function(luaFilePath) {
    if (!_s.endsWith(luaFilePath, '.lua')) { return; }
    fileName = _s.replaceAll(luaFilePath, ".lua", "");
    exports[fileName] = fs.readFileSync(path.join(__dirname, "../resources", luaFilePath)).toString();
  });
}();
