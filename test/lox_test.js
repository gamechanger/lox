require('should');

var _ = require('underscore');
var request = require('supertest');
var uuid = require('node-uuid');

var app = require('../lox');
var config = require('../lib/config');
var client = require('../lib/redis-client').client;

describe("The HTTP endpoint", function() {
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

  describe("POST /lock", function() {

    it("returns 400 without all required parameters", function(done) {
      request(app).post('/lock').expect(400, done);
    });

    it("returns 201 and lockId on acquiring a fresh lock", function(done) {
      request(app).post('/lock')
        .send({key: testKey, maximumLocks: 1, ttlSeconds: 60})
        .expect(201)
        .expect(function(res) {
          res.body.lockId.should.be.ok;
        })
        .end(done);
    });

    it("returns 204 when failing to acquire a lock", function(done) {
      var form = {key: testKey, maximumLocks: 1, ttlSeconds: 60};
      request(app).post('/lock').send(form).end(function(err, res) {
        if (err) { done(err); }
        request(app).post('/lock')
          .send(form)
          .expect(204)
          .expect(function(res) {
            res.body.should.be.eql({});
          })
          .end(done);
      });
    });
  });

  describe("POST /locks", function() {

    it("returns 400 without all required parameters", function(done) {
      request(app).post('/locks').expect(400, done);
    });

    it("returns 201 and lockIds on acquiring fresh locks", function(done) {
      request(app).post('/locks')
        .send({keys: testMultipleKeys, maximumLocks: 1, ttlSeconds: 60})
        .expect(201)
        .expect(function(res) {
          res.body.lockIds.should.be.ok;
          _.keys(res.body.lockIds).length.should.equal(2);
        })
        .end(done);
    });

    it("returns 204 when failing to acquire locks", function(done) {
      var form = {keys: testMultipleKeys, maximumLocks: 1, ttlSeconds: 60};
      request(app).post('/locks').send(form).end(function(err, res) {
        if (err) { done(err); }
        request(app).post('/locks')
          .send(form)
          .expect(204)
          .expect(function(res) {
            res.body.should.be.eql({});
          })
          .end(done);
      });
    });

  });

  describe("DELETE /lock/:lockId", function() {

    it("returns 204 on non-existent lock", function(done) {
      request(app).del('/lock/' + testKey)
        .expect(204, done);
    });

    it("returns 204 on an existing lock", function(done) {
      var form = {key: testKey, maximumLocks: 1, ttlSeconds: 60};
      request(app).post('/lock').send(form).end(function(err, res) {
        if (err) { done(err); }
        request(app).del('/lock/' + res.body.lockId)
          .expect(204, done);
      });
    });

  });

});
