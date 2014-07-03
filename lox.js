var express = require('express');
var bodyParser = require('body-parser');
var _ = require('underscore');
var async = require('async');
var winston = require('winston');
var expressWinston = require('express-winston');

var app = express();
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());

var lock = require('./lib/lock');
var config = require('./lib/config');

var logger = new (winston.Logger)();
logger.add(winston.transports.Console, {timestamp: true});

if (config.log_requests.toLowerCase() === 'true') {
  app.use(expressWinston.logger({
    transports: [
      new winston.transports.Console({
        json: true,
        colorize: true,
        timestamp: true
      })
    ],
    meta: config.debug.toLowerCase() === 'true' ? true : false,
    msg: "{{res.statusCode}} HTTP {{req.method}} {{req.url}}"
  }));
}

/**
 * POST /lock
 * Attempt to acquire a shared lock. Acquiring the lock will fail if more than maximumHeldKeys
 * locks are already being held by other clients. Returns 201 with a JSON object with the acquired
 * lockId if the lock was successfully acquired otherwise 204.
 * @param {string} key the identifier of the shared lock to acquire
 * @param {integer} maximumHeldKeys the maximum number of locks that can already be held for acquisition to not fail
 * @param {number} ttlSeconds the number of seconds for which to hold the lock
 */
app.post('/lock', function(req, res) {

  if (req.body.key === undefined || req.body.maximumHeldKeys === undefined || req.body.ttlSeconds === undefined) {
    return res.send(400);
  }

  async.series([
    function(callback) {
      lock.reapLock(req.body.key, callback);
    },
    function(callback) {
      lock.acquireLock(req.body.key, req.body.maximumHeldKeys, req.body.ttlSeconds, function(err, lockId) {
        if (err) {
          return callback(err);
        }
        if (lockId) {
          return res.status(201).json({lockId: lockId});
        }
        return res.send(204);
      });
    }
  ], function(err) {
      if (err) { return res.send(500); }
  });
});

/**
 * DELETE /lock/:lockId
 * Release any lock that is currently held with the passed lockId. Returns 204.
 * @param {string} lockId the lockId to release
 */
app.delete('/lock/:lockId', function(req, res) {
  if (req.params.lockId === undefined) { return res.send(400); }

  lock.releaseLock(req.body.lockId, function(err) {
    if (err) {
      return res.send(500);
    }
    return res.send(204);
  });
});

app.listen(config.port, function() {
  logger.info('lox server listening on port ' + config.port);
});

module.exports = app;
