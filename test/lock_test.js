require('should');

var uuid = require('node-uuid');
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
      lock.acquireLock(testKey, 1, 60, function(err, firstLockId) {
        if (err) { done(err); }
        lock.acquireLock(testKey, 1, 60, function(err, secondLockId) {
          firstLockId.should.be.ok;
          (secondLockId === null).should.be.true;
          client.multi()
            .get(secondLockId)
            .ttl(secondLockId)
            .smembers(testKey)
            .exec(function(err, replies) {
              if (err) { done(err); }
              (replies[0] === null).should.be.true;
              replies[1].should.be.eql(-1);
              replies[2].should.be.eql([firstLockId]);
              done(err);
            });
        });
      });
    });

  });
});
