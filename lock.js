var uuid = require('node-uuid');
var async = require('async');
var client = require('./redis-client');

exports.reapLock = function(key, callback) {
  client.smembers(key, function(err, members) {
    if (err) {
      return callback(err);
    }

    iterator = function(member, callback) {
      client.get(member, function(err, value) {
        if (err) {
          return callback(err);
        }
        if (!value) {
          client.srem(key, member, function(err) {
            return callback(err);
          });
        }
      });
    }

    async.each(members, iterator, callback);
  });
};

exports.acquireLock = function(key, maximumHeldLocks, ttlSeconds, callback) {
  var lockId = uuid.v1();
  client.watch(key);
  client.scard(key, function(err, cardinality) {
    if (err) {
      return callback(err, null);
    }
    if (cardinality >= maximumHeldLocks) {
      return callback(err, null);
    }
    client.multi()
      .sadd(key, lockId)
      .setex(lockId, ttlSeconds, key)
      .exec(function(err, replies) {
        if (err) {
          return callback(err, null);
        }
        return callback(err, replies ? lockId : null);
      });
  });
};

exports.releaseLock = function(lockId, callback) {
  client.get(lockId, function(err, key) {
    if (err) {
      return callback(err, null);
    }
    client
      .multi()
      .srem(key, lockId)
      .del(lockId)
      .exec(function(err) {
        return callback(err);
      });
  });
};
