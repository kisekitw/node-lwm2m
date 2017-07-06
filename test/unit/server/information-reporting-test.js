/*
 * Copyright 2017 Alexandre Moreno <alex_moreno@tutk.com>
 *
 * This file is part of iotagent-lwm2m-lib
 *
 * iotagent-lwm2m-lib is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-lwm2m-lib is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-lwm2m-lib.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

'use strict';

var should = require('should');
var url = require('url');
var lwm2m = require('../../../');
var coap = require('coap');
var Readable = require('readable-stream').Readable;
var Writable = require('readable-stream').Writable;
var Stream = require('stream');
var port = 5683;
var server, client;
var payload = '</1>,</2>,</3>,</4>,</5>';
var ep = 'test';

describe('Information Reporting' , function() {

  beforeEach(function (done) {
    server = lwm2m.createServer({ type: 'udp4' });
    client = coap.createServer({ type: 'udp4' });

    server.on('error', done);
    server.on('register', function(params, accept) {
      accept();
    });

    server.listen(port, function() {
      var req = coap.request({
        host: 'localhost',
        port: port,
        method: 'POST',
        pathname: '/rd',
        query: 'ep=' + ep + '&lt=86400&lwm2m=1.0&b=U'
      });

      var rs = new Readable();
      rs.push(payload);
      rs.push(null);
      rs.pipe(req);

      req.on('response', function(res) {
        res.code.should.equal('2.01');
        client.listen(res.outSocket.port, done);
      });
    });
  });

  afterEach(function(done) {
    server.close(function() {
      client.close(done);
    });
  });

  describe('#observe()', function() {
    it('should return an stream and pipe client messages', function(done) {
      client.on('request', function (req, res) {
        req.method.should.equal('GET');
        req.headers['Observe'].should.equal(0);

        res.should.be.an.instanceof(Writable);

        var interval = setInterval(function() {
          res.write('test');
        }, 50);

        res.setOption('Content-Format', 'text/plain');
        res.code = '2.05';

        setTimeout(function() {
          res.end();
        }, 500);

        res.on('finish', function(err) {
          clearInterval(interval);
          done();
        });

      });

      server.observe(ep, '/3/4')
      .then(function(stream) {
        stream.should.be.an.instanceof(Stream);
        stream.on('data', function(chunk) {
          chunk.should.be.equal('test');
          stream.close();
        });
        stream.on('error', done);
      })
      .catch(done);
    });

    it('should emit and `end` event when client stops sending data', function(done) {
      client.on('request', function (req, res) {
        req.method.should.equal('GET');
        req.headers['Observe'].should.equal(0);

        res.should.be.an.instanceof(Writable);
        res.setOption('Content-Format', 'text/plain');
        res.code = '2.05';

        var interval = setInterval(function() {
          res.write('test');
        }, 50);

        setTimeout(function() {
          res.end();
        }, 500);

        res.on('finish', function(err) {
          clearInterval(interval);
        });
      });

      server.observe(ep, '/3/4')
      .then(function(stream) {
        stream.should.be.an.instanceof(Stream);

        stream.on('data', function(chunk) {
          chunk.should.be.equal('test');
          stream.close();
        });

        stream.on('end', function() {
          done();
        });

        stream.on('error', done);
      })
      .catch(done);
    });
  });

  describe('#cancel()', function() {
    it('should stop receiving data', function(done) {
      client.on('request', function (req, res) {
        req.method.should.equal('GET');
        req.headers['Observe'].should.equal(1);

        res.end();
      });

      server.cancel(ep, '/3/4')
      .then(function() {
        done();
      })
      .catch(done);
    });
  });
});
