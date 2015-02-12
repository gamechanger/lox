var config = require('./config');
var redisClient = require('redis').createClient(config.redis_port, config.redis_host);

var loadedScriptStrings = {};

exports.client = redisClient;

exports.ensureScript = function(client, scriptString, cb) {
  if (scriptString in loadedScriptStrings) { return cb(null); }
  client.script('load', scriptString, function(err) {
    if (err) { return cb(err); }
    loadedScriptStrings[scriptString] = true;
    return cb(null);
  });
};
