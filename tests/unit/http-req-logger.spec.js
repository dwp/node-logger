/* eslint max-classes-per-file: 0 */
const chai = require('chai');
const sinon = require('sinon');
chai.use(require('sinon-chai'));
const EventEmitter = require('events');
const Logger = require('../../src/logger.js');
const SimulatedLoggerStream = require('../utils/simulated-logger-stream.js');

const { expect } = chai;

class SimulatedResponse extends EventEmitter {}

describe('Logger http request logging', () => {
  if ('JAEGER_AGENT_HOST' in process.env) {
    delete process.env.JAEGER_AGENT_HOST;
  }
  if ('JAEGER_ENDPOINT' in process.env) {
    delete process.env.JAEGER_ENDPOINT;
  }

  const testHTTPReq = (logger, done, expectedLogLevel = 'info', extraheaders, shouldAbandon = false) => {
    const next = sinon.stub();

    const req = {
      cookies: {
        cookie: 'cookie-value',
      },
      method: 'POST',
      protocol: 'HTTP',
      httpVersion: '1.1',
      url: '/static/js/test.js',
      originalUrl: '/static/js/test.js',
      headers: {
        test: 'headerValue',
        cookie: 'cookie-value',
        'x-b3-traceid': 'propogate-3',
        'x-b3-spanId': 'propogate-4',
        'x-b3-parentspanid': 'propogate-5',
        'X-B3-Sampled': 'propogate-6',
        'x-b3-flags': 'propogate-7',
        b3: 'propogate-8',
        ...extraheaders,
      },
      header(v) {
        return v ? this.headers[v.toLowerCase()] : null;
      },
      get(v) {
        return v ? this.headers[v.toLowerCase()] : null;
      },
      getHeaders() {
        return this.headers;
      },
    };

    logger.loggerOptions.outputStream.clear();

    sinon.spy(req, 'header');

    const res = new SimulatedResponse();
    res.setHeader = sinon.stub();

    res.statusCode = 200;
    res._headers = { // eslint-disable-line
      'x-dns-prefetch-control': 'off',
      'x-frame-options': 'SAMEORIGIN',
      'strict-transport-security': 'max-age=15552000; includeSubDomains',
      'x-content-type-options': 'nosniff',
      'x-xss-protection': '1; mode=block',
      'surrogate-control': 'no-store',
      'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      pragma: 'no-cache',
      expires: '0',
      'x-request-id': 'e1850613-0627-426b-test-a1c3682c7085',
      'accept-ranges': 'bytes',
      'last-modified': 'Mon, 09 Sep 2019 10:10:05 GMT',
      etag: 'W/"6b-16d15807c48"',
      'content-type': 'image/x-icon',
      'content-length': 107,
    };
    res.getHeaders = function localGetHeaders() {
      return this._headers; // eslint-disable-line
    };

    const pinoLogger = logger.pinoLogger || logger;

    sinon.spy(pinoLogger, 'child');

    logger.httpLogger(req, res, next);

    expect(next).to.have.been.calledOnce; // eslint-disable-line

    expect(pinoLogger.child).to.have.been.calledOnce; // eslint-disable-line

    if (logger.loggerOptions.enableTracePropogation) {
      if (req.headers['x-request-id']) {
        expect(req.id).to.equal(req.headers['x-request-id']);
      }
    } else {
      expect(req.header).to.not.have.been.calledOnce; // eslint-disable-line
      expect(req.id).not.to.equal(req.headers['x-request-id']);
    }

    expect(pinoLogger.child).to.have.been.calledOnce; // eslint-disable-line

    const { trace } = pinoLogger.child.getCall(0).args[0];
    const { useragent } = pinoLogger.child.getCall(0).args[0];

    expect(trace.request_id).to.equal(req.id);
    expect(trace.request_id.length).to.be.above(30);

    if (!logger.loggerOptions.enableOpenTracing) {
      if (logger.loggerOptions.sessionIdHeaderName === 'X-Session-Id') {
        expect(trace.session_id).to.equal(req.headers['x-session-id']);
      }
    }

    if (logger.loggerOptions.enableTracePropogation) {
      expect(req.openTracing['x-b3-spanId']).to.equal('propogate-4');
    } else {
      expect(req.openTracing['x-b3-spanId']).to.be.undefined; // eslint-disable-line
    }

    if (logger.loggerOptions.clientHeaderName === 'X-not-there') {
      expect(useragent).to.be.undefined; // eslint-disable-line
    } else if (req.headers['x-client']) {
      expect(useragent).to.equal(req.headers['x-client']);
    } else if (req.headers['user-agent']) {
      expect(useragent).to.equal(req.headers['user-agent']);
    }

    const origLog = req.log[expectedLogLevel].bind(req.log);

    sinon.stub(req.log, expectedLogLevel).callsFake((value, message) => {
      expect(value.nameSpace).to.equal(shouldAbandon ? 'abandoned' : 'http');
      expect(value.req.method).to.equal('POST');
      expect(value.req.url).to.equal('/static/js/test.js');
      // must have taken over 19 ticks because we are waiting for 20 ticks
      expect(value.res.responseTime).to.be.above(19);

      origLog(value, message);

      expect(logger.loggerOptions.outputStream.logs.length).to.equal(1);
      const resLog = JSON.parse(logger.loggerOptions.outputStream.logs[0]);

      if (logger.loggerOptions.logRequestHeaders) {
        expect(resLog.req.headers.test).to.equal('headerValue');
          expect(resLog.req.headers['cookie-value']).to.be.undefined; // eslint-disable-line
      }

      expect(resLog.level).to.equal(expectedLogLevel);
      expect(resLog.nameSpace).to.equal(shouldAbandon ? 'abandoned' : 'http');
      expect(resLog.message).to.equal('POST /static/js/test.js HTTP/1.1 200');
      expect(resLog.pid).to.be.above(0);

      if (logger.loggerOptions.logRequestHeaders) {
        expect(resLog.req.headers.test).to.equal('headerValue');
        expect(resLog.req.headers['cookie-value']).to.be.undefined; // eslint-disable-line
      } else {
        expect(resLog.req.headers).to.be.undefined; // eslint-disable-line
      }

      if (logger.loggerOptions.logResponseHeaders) {
        expect(resLog.res.headers['accept-ranges']).to.equal('bytes');
      } else {
        expect(resLog.res.headers).to.be.undefined; // eslint-disable-line
      }

      setTimeout(() => {
        done();
      }, 90);
    });

    setTimeout(() => {
      res.emit(shouldAbandon ? 'close' : 'finish');
    }, 20);

    if (!shouldAbandon) {
      setTimeout(() => {
        res.emit('close');
      }, 30);
    }
  };

  it('should log a http request with no cookies', (done) => {
    const logger = Logger({
      enableOpenTracing: false,
      outputStream: new SimulatedLoggerStream(),
      clientHeaderName: 'X-not-there',
    });
    testHTTPReq(logger, done, 'info', { 'x-request-id': 'e1850613-0627-426b-test-a1c3682c7085', 'user-agent': 'client-app' });
  });

  it('should log a http request with cookies and all headers', (done) => {
    const logger = Logger({
      enableOpenTracing: false,
      enableDebugLoggingLibrary: true,
      logRequestHeaders: true,
      logResponseHeaders: true,
      outputStream: new SimulatedLoggerStream(),
    });
    testHTTPReq(logger, done, 'info', { 'x-request-id': 'e1850613-0627-426b-test-a1c3682c7085', 'x-session-id': '111111-222222', 'user-agent': 'client-app' });
  });

  it('should log a http request in a web server with request headers, but no id header in response', (done) => {
    const logger = Logger('web', {
      clientHeaderName: 'X-Client',
      outputStream: new SimulatedLoggerStream(),
    });
    testHTTPReq(logger, done, 'info', { 'x-request-id': 'e1850613-0627-426b-test-a1c3682c7085', 'x-client': 'client-app' });
  });

  it('should log a http request with cookies and only request headers', (done) => {
    const logger = Logger({
      enableOpenTracing: false,
      excludeRequestPaths: ['^/dont-match-this/'],
      logRequestHeaders: true,
      outputStream: new SimulatedLoggerStream(),
    });
    testHTTPReq(logger, done, 'info', { 'x-request-id': 'e1850613-0627-426b-test-a1c3682c7085', 'user-agent': 'client-app' });
  });

  it('should not log a http request that matches the excludeRequestPaths', (done) => {
    const logger = Logger('api', {
      logLevel: 'trace',
      excludeRequestPaths: ['^/static/'],
      outputStream: new SimulatedLoggerStream(),
    });

    expect(logger.loggerClass.filterOutRequest({ url: '/dontmatch' }, logger.loggerOptions)).to.equal(false);
    expect(logger.loggerClass.filterOutRequest({ url: '/static/sdfsdf' }, logger.loggerOptions)).to.equal(true);

    testHTTPReq(logger, () => {
      logger.closeLogger(done);
    }, 'trace');
  });

  it('should log a http request with basic logging', (done) => {
    const logger = Logger({
      enableOpenTracing: true,
      basicLogging: true,
      outputStream: new SimulatedLoggerStream(),
    });
    testHTTPReq(logger, () => {
      logger.closeLogger(done);
    }, 'info', { 'x-request-id': 'e1850613-0627-426b-test-a1c3682c7085' });
  });

  it('should log a http request with open tracing', (done) => {
    const logger = Logger({
      enableOpenTracing: true,
      outputStream: new SimulatedLoggerStream(),
    });
    testHTTPReq(logger, () => {
      logger.closeLogger(done);
    }, 'info');
  });

  it('should not open trace a http request that matches the excludeRequestPaths', (done) => {
    const logger = Logger({
      enableOpenTracing: true,
      logLevel: 'trace',
      excludeRequestPaths: ['^/static/'],
      outputStream: new SimulatedLoggerStream(),
    });

    expect(logger.loggerClass.filterOutRequest({ url: '/dontmatch' }, logger.loggerOptions)).to.equal(false);
    expect(logger.loggerClass.filterOutRequest({ url: '/static/sdfsdf' }, logger.loggerOptions)).to.equal(true);

    testHTTPReq(logger, () => {
      logger.closeLogger(done);
    }, 'trace');
  });

  it('should log an abandon when a request is terminated by the client early', (done) => {
    const logger = Logger({
      enableOpenTracing: false,
      outputStream: new SimulatedLoggerStream(),
      clientHeaderName: 'X-not-there',
    });
    testHTTPReq(logger, done, 'info', { 'x-request-id': 'e1850613-0627-426b-test-a1c3682c7085', 'user-agent': 'client-app' }, true);
  });
});
