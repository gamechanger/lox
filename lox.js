var express = require('express');
var bodyParser = require('body-parser');
var async = require('async');

var app = express();
app.use(bodyParser.json());

var lock = require('./lock');

app.post('/lock', function(req, res, next) {
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
        return res.status(204);
      });
    }
  ], function(err) {
    if (err) {
      return res.send(500);
    }
  });
});

app.delete('/lock/:lockId', function(req, res, next) {
  lock.releaseLock(req.params.lockId, function(err) {
    if (err) {
      return res.send(500);
    }
    return res.send(204);
  });
};

app.listen(8000, function() {
  console.log('lox server listening on port 8000');
});
