require('should');

var uuid = require('node-uuid');
var async = require('async');
var lock = require('../lock');
var client = require('../redis-client');

describe("The locking module", function() {

  describe("acquires a lock", function() {

    it("on a non-existent key", function(done) {
      var testKey = uuid.v1();
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
      var testKey = uuid.v1();
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
      var testKey = uuid.v1();
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

  describe("releases a lock", function() {

    it("on a non-existent or expired key", function(done) {
      var testKey = uuid.v1();
      lock.releaseLock(testKey, function(err) {
        if (err) { done(err); }
        client.get(testKey, function(err, value) {
          (value === null).should.be.true;
          done(err);
        });
      });
    });

    it("on an existing and current key", function(done) {
      var testKey = uuid.v1();
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
      var testKey = uuid.v1();
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
      var testKey = uuid.v1();
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
