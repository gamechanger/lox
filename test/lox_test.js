require('should');

var request = require('request');
var uuid = require('node-uuid');

var app = require('../lox');
var config = require('../lib/config');

describe("The HTTP endpoint", function() {

  describe("POST /lock", function() {
    var url = 'http://localhost:' + config.port + '/lock';

    it("returns 400 without all required parameters", function(done) {
      request.post({url: url}, function(err, res, body) {
        res.statusCode.should.be.eql(400);
        done(err);
      });
    });

    it("returns 201 and lockId on acquiring a fresh lock", function(done) {
      var form = {key: uuid.v1(), concurrentKeys: 1, ttlSeconds: 60};
      request.post({url: url, json: form}, function(err, res, body) {
        res.statusCode.should.be.eql(201);
        body.lockId.should.be.ok;
        done(err);
      });
    });

    it("returns 204 when failing to acquire a lock", function(done) {
      var form = {key: uuid.v1(), concurrentKeys: 1, ttlSeconds: 60};
      request.post({url: url, json: form}, function(err, res, body) {
        request.post({url: url, json: form}, function(err, res, body) {
          res.statusCode.should.be.eql(204);
          (body === undefined).should.be.true;
          done(err);
        });
      });
    });

  });

  describe("DELETE /lock/:lockId", function() {
    var url = 'http://localhost:' + config.port + '/lock';
    var fullUrl = url + '/exampleLockId';

    it("returns 204 on non-existent lock", function(done) {
      request.del({url: fullUrl}, function(err, res, body) {
        if (err) { done(err); }
        res.statusCode.should.be.eql(204);
        done(err);
      });
    });

    it("returns 204 on an existing lock", function(done) {
      var form = {key: uuid.v1(), concurrentKeys: 1, ttlSeconds: 60};
      request.post({url: url, json: form}, function(err, res, body) {
        if (err) { done(err); }
        var lockId = body.lockId;
        request.del({url: url + '/' + lockId}, function(err, res, body) {
          if (err) { done(err); }
          res.statusCode.should.be.eql(204);
          done(err);
        });
      });
    });

  });

});
