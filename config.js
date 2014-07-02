var argv = require('optimist')
    .default('lox_port', process.env.LOX_PORT || 80)
    .default('redis_host', process.env.REDIS_HOST || 'localhost')
    .default('redis_port', process.env.REDIS_PORT || 6379)
    .default('token', process.env.TOKEN || null)
    .argv;

module.exports = argv;
