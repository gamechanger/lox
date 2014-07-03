var uuid = require('node-uuid');
var async = require('async');
var client = require('./redis-client');

/**
 * reapLock
 * Detects any child locks referenced in the key set that have expired and removes their
 * entries from the key set. Fires a callback with err.
 * @param {string} key the identifier of the shared lock for which to reap expired child locks
 * @param {function} callback signature (err)
 */
exports.reapLock = function(key, callback) {
  client.smembers(key, function(err, members) {
    if (err) { return callback(err); }

    iterator = function(member, callback) {
      client.get(member, function(err, value) {
        if (err || value) { return callback(err); }
        client.srem(key, member, function(err) {
          return callback(err);
        });
      });
    };

    async.each(members, iterator, callback);
  });
};

/**
 * acquireLock
 * Attempt to acquire a shared lock. Acquiring the lock will fail if maximumHeldKeys
 * locks are already being held by other clients. Acquiring the lock creates a new lockId, adds it
 * to the key set, then sets the lockId with the passed TTL. Fires a callback with err and the
 * lockId if it was successfully acquired, otherwise null.
 * @param {string} key the identifier of the shared lock to acquire
 * @param {int} maximumHeldLocks the maximum number of locks that can already be held for acquisition to not fail
 * @param {number} ttlSeconds the number of seconds for which to hold the lock
 * @param {function} callback signature (err, lockId if acquired else null)
 */
exports.acquireLock = function(key, maximumHeldLocks, ttlSeconds, callback) {
  var lockId = uuid.v1();
  client.watch(key);
  client.scard(key, function(err, cardinality) {
    if (err) { return callback(err, null); }
    if (cardinality >= maximumHeldLocks) { return callback(err, null); }
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

/**
 * releaseLock
 * Release any lock that is currently held with the passed lockId. This deletes the lock's key if
 * it exists, then removes the lockId from the key set. Fires a callback with err in either case.
 * @param {string} lockId lock identifier returned from a successful lock acquisition
 * @param {function} callback signature (err)
 */
exports.releaseLock = function(lockId, callback) {
  client.get(lockId, function(err, key) {
    if (err) { return callback(err); }
    client
      .multi()
      .srem(key, lockId)
      .del(lockId)
      .exec(function(err) {
        return callback(err);
      });
  });
};
