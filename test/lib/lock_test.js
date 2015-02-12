require('should');

var _ = require('underscore');
var uuid = require('node-uuid');
var async = require('async');
var lock = require('../../lib/lock');
var client = require('../../lib/redis-client');

describe("The locking module", function() {
  var testKey = null;
  var testMultipleKeys = null;

  beforeEach(function() {
    testKey = uuid.v1();
    testMultipleKeys = [uuid.v1(), uuid.v1()];
  });

  afterEach(function(done) {
    client.del(testKey, function(err, value) {
      if (err) { done(err); }
      testKey = null;
      done(err);
    });
  });

  describe("acquires a single lock", function() {

    it("on a non-existent key", function(done) {
      lock.acquireLock(testKey, 1, 60, function(err, lockId) {
        client.multi()
          .get(lockId)
          .ttl(lockId)
          .smembers(testKey)
          .exec(function(err, replies) {
            if (err) { done(err); }
            replies[0].should.equal(testKey);
            replies[1].should.be.approximately(60, 5);
            replies[2].should.eql([lockId]);
            done(err);
          });
      });
    });

    it("on an existing key with sufficient availabiilty", function(done) {
      lock.acquireLock(testKey, 5, 60, function(err, firstLockId) {
        if (err) { done(err); }
        lock.acquireLock(testKey, 5, 60, function(err, secondLockId) {
          firstLockId.should.be.ok;
          secondLockId.should.be.ok;
          client.multi()
            .get(secondLockId)
            .ttl(secondLockId)
            .smembers(testKey)
            .exec(function(err, replies) {
              if (err) { done(err); }
              replies[0].should.equal(testKey);
              replies[1].should.be.approximately(60, 5);
              replies[2].should.have.length(2);
              replies[2].should.containEql(firstLockId);
              replies[2].should.containEql(secondLockId);
              done(err);
            });
        });
      });
    });

    it("on an existing key with insufficient availability and fails", function(done) {
      async.waterfall([
        function(callback) { lock.acquireLock(testKey, 1, 60, callback); },
        function(firstLockId, callback) {
          lock.acquireLock(testKey, 1, 60, function(err, secondLockId) {
            if (err) { callback(err); }
            firstLockId.should.be.ok;
            (secondLockId === null).should.be.true;
            client.multi()
              .get(secondLockId)
              .ttl(secondLockId)
              .smembers(testKey)
              .exec(function(err, replies) {
                if (err) { done(err); }
                (replies[0] === null).should.be.true;
                replies[1].should.be.lessThan(0);
                replies[2].should.be.eql([firstLockId]);
                callback(err);
              });
          });
        }
      ], function(err, result) { done(err); });
    });

  });

  describe("acquires multiple locks", function() {

    it("on two non-existent keys", function(done) {
      lock.acquireMultipleLocks(testMultipleKeys, 1, 60, function(err, lockIdMapping) {
        if (err) { return done(err); }
        afterDone = _.after(testMultipleKeys.length, done);
        _.each(lockIdMapping, function(lockId, lockKey) {
          client.multi()
            .get(lockId)
            .ttl(lockId)
            .smembers(lockKey)
            .exec(function(err, replies) {
              if (err) { afterDone(err); }
              replies[0].should.equal(lockKey);
              replies[1].should.be.approximately(60, 5);
              replies[2].should.eql([lockId]);
              return afterDone(err);
            });
        });
      });
    });

    it("on existing keys with sufficient availability", function(done) {
      lock.acquireMultipleLocks(testMultipleKeys, 1, 60, function(err, lockIdMapping) {
        if (err) { return done(err); }
        lockIdMapping.should.be.ok;
        _.keys(lockIdMapping).length.should.equal(2);
        lock.acquireMultipleLocks(testMultipleKeys, 2, 60, function(err, lockIdMapping) {
          if (err) { return done(err); }
          afterDone = _.after(testMultipleKeys.length, done);
          _.each(lockIdMapping, function(lockId, lockKey) {
            client.multi()
            .get(lockId)
            .ttl(lockId)
            .smembers(lockKey)
            .exec(function(err, replies) {
              if (err) { return done(err); }
              replies[0].should.equal(lockKey);
              replies[1].should.be.approximately(60, 5);
              replies[2].should.have.length(2);
              replies[2].should.containEql(lockId);
              return afterDone(null);
            });
          });
        });
      });
    });

    it("on existing keys with insufficient availability and fails", function(done) {
      lock.acquireMultipleLocks(testMultipleKeys, 1, 60, function(err, lockIdMapping) {
        if (err) { return done(err); }
        lockIdMapping.should.be.ok;
        _.keys(lockIdMapping).length.should.equal(2);
        lock.acquireMultipleLocks(testMultipleKeys, 1, 60, function(err, secondLockIdMapping) {
          if (err) { return done(err); }
          (secondLockIdMapping === null).should.be.true;
          afterDone = _.after(testMultipleKeys.length, done);
          _.each(lockIdMapping, function(lockId, lockKey) {
            client.multi()
              .get(lockId)
              .ttl(lockId)
              .smembers(lockKey)
              .exec(function(err, replies) {
                if (err) { return done(err); }
                replies[0].should.equal(lockKey);
                replies[1].should.be.approximately(60, 5);
                replies[2].should.have.length(1);
                replies[2].should.containEql(lockId);
                return afterDone(null);
              });
          });
        });
      });
    });

  });

  describe("releases a lock", function() {

    it("on a non-existent or expired key", function(done) {
      lock.releaseLock(testKey, function(err) {
        if (err) { done(err); }
        client.get(testKey, function(err, value) {
          (value === null).should.be.true;
          done(err);
        });
      });
    });

    it("on an existing and current key", function(done) {
      async.waterfall([
        function(callback) { lock.acquireLock(testKey, 5, 60, callback); },
        function(firstLockId, callback) {
          lock.acquireLock(testKey, 5, 60, function(err, secondLockId) {
            callback(err, firstLockId, secondLockId);
          });
        },
        function(firstLockId, secondLockId, callback) {
          lock.releaseLock(secondLockId, function(err) {
            if (err) { callback(err); }
            firstLockId.should.be.ok;
            secondLockId.should.be.ok;
            client.multi()
              .get(firstLockId)
              .get(secondLockId)
              .smembers(testKey)
              .exec(function(err, replies) {
                if (err) { done(err); }
                replies[0].should.be.eql(testKey);
                (replies[1] === null).should.be.true;
                replies[2].should.be.eql([firstLockId]);
                callback(err);
              });
          });
        }], function(err, result) { done(err); });

      });
  });

  describe("reaps expired locks", function() {

    it("on an empty set", function(done) {
      lock.reapLock(testKey, function(err) {
        if (err) { done(err); }
        client.get(testKey, function(err, value) {
          if (err) { done(err); }
          (value === null).should.be.true;
          done(err);
        });
      });
    });

    it("on a populated set", function(done) {
      async.waterfall([
        function(callback) { lock.acquireLock(testKey, 5, 60, callback); },
        function(firstLockId, callback) {
          lock.acquireLock(testKey, 5, 60, function(err, secondLockId) {
            callback(err, firstLockId, secondLockId);
          });
        },
        function(firstLockId, secondLockId, callback) {
          client.del(secondLockId, function(err, value) {
            callback(err, firstLockId, secondLockId);
          });
        },
        function(firstLockId, secondLockId, callback) {
          lock.reapLock(testKey, function(err) {
            if (err) { callback(err); }
            firstLockId.should.be.ok;
            secondLockId.should.be.ok;
            client.multi()
              .get(firstLockId)
              .get(secondLockId)
              .smembers(testKey)
              .exec(function(err, replies) {
                if (err) { callback(err); }
                replies[0].should.be.eql(testKey);
                (replies[1] === null).should.be.true;
                replies[2].should.be.eql([firstLockId]);
                callback(err);
              });
          });
        }
      ], function(err, result) { done(err); });
    });

  });

});
