var argv = require('optimist')
    .default('debug', process.env.LOX_DEBUG || 'false')
    .default('logRequests', process.env.LOX_LOG_REQUESTS || 'false')
    .default('port', process.env.LOX_PORT || 80)
    .default('redis_host', process.env.LOX_REDIS_HOST || 'localhost')
    .default('redis_port', process.env.LOX_REDIS_PORT || 6379)
    .default('token', process.env.LOX_TOKEN || null)
    .argv;

module.exports = argv;
