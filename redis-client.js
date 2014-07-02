var config = require('./config');
var client = require('redis').createClient(config.redis_port, config.redis_host);
module.exports = client;
