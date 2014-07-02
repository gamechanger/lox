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

if (config.logRequests.toLowerCase() === 'true') {
  app.use(expressWinston.logger({
    transports: [
      new winston.transports.Console({
        json: true,
        colorize: true
      })
    ],
    meta: config.debug.toLowerCase() === 'true' ? true : false,
    msg: "{{res.statusCode}} HTTP {{req.method}} {{req.url}}"
  }));
}

app.post('/lock', function(req, res) {

  if (req.body.key === undefined || req.body.concurrentKeys === undefined || req.body.ttlSeconds === undefined) {
    return res.send(400);
  }

  async.series([
    function(callback) {
      lock.reapLock(req.body.key, callback);
    },
    function(callback) {
      lock.acquireLock(req.body.key, req.body.concurrentKeys, req.body.ttlSeconds, function(err, lockId) {
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
  winston.info('lox server listening on port ' + config.port);
});

module.exports = app;
