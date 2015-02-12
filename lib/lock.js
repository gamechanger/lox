var _ = require('underscore');
var _s = require('underscore.string');
var uuid = require('node-uuid');
var async = require('async');
var client = require('./redis-client');
var lua = require('./lua');

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
 * Attempt to acquire a shared lock. Acquiring the lock will fail if maximumLocks or more
 * locks are already being held by other clients. Acquiring the lock creates a new lockId, adds it
 * to the key set, then sets the lockId with the passed TTL. Fires a callback with err and the
 * lockId if it was successfully acquired, otherwise null.
 * @param {string} key the identifier of the shared lock to acquire
 * @param {int} maximumLocks the maximum number of locks that can be held after a successful lock acquisition
 * @param {number} ttlSeconds the number of seconds for which to hold the lock
 * @param {function} callback signature (err, lockId if acquired else null)
 */
exports.acquireLock = function(key, maximumLocks, ttlSeconds, callback) {
  var lockId = uuid.v1();
  client.eval(lua.acquire_lock, 1, key, lockId, maximumLocks, ttlSeconds, function(err, response) {
    if (err) { return callback(err, null); }
    return callback(null, response ? lockId : null);
  });
};


/**
 * acquireMultipleLocks
 * Attempt to acquire multiple shared locks, all subject to the same maximumLocks and ttlSeconds.
 * Acquiring *all* of the locks will fail if maximumLocks or more locks are already being held by
 * other clients on *any* of the shared locks. If all locks are successfully acquired, separate lock
 * IDs are returned for each lock. Fires a callback with err and a mapping of keys to lock IDs if
 * all locks were successfully acquired, otherwise null.
 * @param {[string]} keys the identifiers of the shared locks to acquire
 * @param {int} maximumLocks the maximum number of locks (per key) that can be held after a successful lock acquisition
 * @param {number} ttlSeconds the number of seconds for which to hold each lock
 * @param {function} callback signature (err, lockIdMapping if acquired else null)
 */
exports.acquireMultipleLocks = function(keys, maximumLocks, ttlSeconds, callback) {
  var lockIds = _.map(keys, function(key) { return uuid.v1(); });
  var lockIdsPipeDelimited = lockIds.join('|');
  var evalArgs = _.flatten([lua.acquire_multiple_locks, keys.length, keys, lockIdsPipeDelimited, maximumLocks, ttlSeconds]);

  client.eval(evalArgs, function(err, response) {
    if (err) { return callback(err, null); }
    var lockIdMapping = _.object(keys, lockIds);
    return callback(null, response ? lockIdMapping : null);
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
