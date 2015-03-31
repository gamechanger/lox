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
var lua = require('./lib/lua');

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

app.get('/health', function(req, res) {
  return res.send(200);
});

/**
 * GET /lock
 * Returns the number of locks currently held on the provided key.
 * You generally don't want to perform any client-side logic on this as then
 * count may be stale by the time it gets to your client. Should only be used
 * for monitoring, introspection, that sort of thing.
 * @param {string} key the identifier of the shared lock for which to get a count
 */
app.get('/lock', function(req, res) {

  if (_.isUndefined(req.query.key)) {
    return res.sendStatus(400);
  }

  async.series([
    function(callback) {
      lock.reapLock(req.query.key, callback);
    },
    function(callback) {
      lock.countLocks(req.query.key, function(err, count) {
        if (err) { return callback(err); }
        return res.status(200).json({heldLocks: count});
      });
    }
  ], function(err) {
    if (err) { return res.send(500); }
  });

});

/**
 * POST /lock
 * Attempt to acquire a shared lock. Acquiring the lock will fail if maxiumLocks or more
 * are already being held by other clients. Returns 201 with a JSON object with the acquired
 * lockId if the lock was successfully acquired otherwise 204.
 * @param {string} key the identifier of the shared lock to acquire
 * @param {integer} maximumLocks the maximum number of locks that can be held after a successful lock acquisition
 * @param {number} ttlSeconds the number of seconds for which to hold the lock
 */
app.post('/lock', function(req, res) {

  if ([req.body.key, req.body.maximumLocks, req.body.ttlSeconds].some(_.isUndefined)) {
    return res.sendStatus(400);
  }

  async.series([
    function(callback) {
      lock.reapLock(req.body.key, callback);
    },
    function(callback) {
      lock.acquireLock(req.body.key, req.body.maximumLocks, req.body.ttlSeconds, function(err, lockId) {
        if (err) { return callback(err); }
        if (lockId) { return res.status(201).json({lockId: lockId}); }
        return res.sendStatus(204);
      });
    }
  ], function(err) {
      if (err) { return res.send(500); }
  });
});

/**
 * POST /locks
 * Attempt to acquire multiple shared locks. Acquiring *all* of the locks will fail if maxiumLocks or more
 * are already being held by other clients on *any* of the keys. Returns 201 with a JSON object with a map
 * of the keys to each acquired lockId if the locks were successfully acquired, otherwise 204.
 * @param {[string]} keys the identifiers of the shared locks to acquire
 * @param {integer} maximumLocks the maximum number of locks (per key) that can be held after a successful lock acquisition
 * @param {number} ttlSeconds the number of seconds for which to hold each lock
 */
app.post('/locks', function(req, res) {

  if ([req.body.keys, req.body.maximumLocks, req.body.ttlSeconds].some(_.isUndefined)) {
    return res.sendStatus(400);
  }

  async.series([
    function(callback) {
      async.each(req.body.keys, function(key, cb) { lock.reapLock(key, cb); }, callback);
    },
    function(callback) {
      lock.acquireMultipleLocks(req.body.keys, req.body.maximumLocks, req.body.ttlSeconds, function(err, lockIdMapping) {
        if (err) { return callback(err); }
        if (lockIdMapping) { return res.status(201).json({lockIds: lockIdMapping}); }
        return res.sendStatus(204);
      });
    }], function(err) {
      if (err) { return res.send(500); }
    });

});

/**
 * DELETE /lock/:lockId
 * Release any lock that is currently held with the passed lockId. Returns 204.
 * @param {string} lockId the lockId to release
 */
app.delete('/lock/:lockId', function(req, res) {
  if (_.isUndefined(req.params.lockId)) { return res.send(400); }

  lock.releaseLock(req.params.lockId, function(err) {
    if (err) {
      return res.send(500);
    }
    return res.sendStatus(204);
  });
});

app.listen(config.port, function() {
  logger.info('lox server listening on port ' + config.port);
});

module.exports = app;
