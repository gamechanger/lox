var argv = require('optimist')
    .default('lox_port', 80)
    .default('redis_host', 'localhost')
    .default('redis_port', 6379)
    .argv;

module.exports = argv;
