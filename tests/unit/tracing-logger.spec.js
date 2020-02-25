// const os = require('os');
const chai = require('chai');
chai.use(require('sinon-chai'));
const TracingLogger = require('../../src/tracing-logger.js');
const SimulatedLoggerStream = require('../utils/simulated-logger-stream.js');

const { expect } = chai;

describe('Open tracing noop tests', () => {
  it('should create a noop trace logger', (done) => {
    const testLogger = new SimulatedLoggerStream();
    const traceLogger = new TracingLogger(testLogger, {
      testMode: true,
    });

    expect(traceLogger).to.be.an('object');

    done();
  });
});


describe('Open tracing jaeger tests', () => {
  let testLogger; let traceLogger;

  before(() => {
    testLogger = new SimulatedLoggerStream();
    traceLogger = new TracingLogger(testLogger, {
      testMode: false,
      testLogging: true,
      appName: 'testApp',
    });
  });

  after((done) => {
    traceLogger.close(done);
  });

  beforeEach(() => {
    testLogger.clear();
  });

  it('should create and log a basic span', (done) => {
    expect(traceLogger).to.be.an('object');

    const span = traceLogger.createSpan('testBasicOperation', {});
    expect(span).to.be.an('object');
    traceLogger.endSpan(span);
    done();
  }).timeout(1000);


  it('should create and log a parent span with two children', (done) => {
    expect(traceLogger).to.be.an('object');

    const parentSpan = traceLogger.createSpan('testParentOperation');
    expect(parentSpan).to.be.an('object');

    const childSpan1 = traceLogger.createSpan('testChildOperation1', { parentSpan, component: 'customer' });
    expect(childSpan1).to.be.an('object');

    const grandChildSpan1 = traceLogger.createSpan('testGrandChildOperation1', { parentSpan: childSpan1, component: 'customerRecords' });
    expect(childSpan1).to.be.an('object');


    let childSpan2;

    setTimeout(() => {
      traceLogger.endSpan(grandChildSpan1);
      traceLogger.endSpan(childSpan1);
      childSpan2 = traceLogger.createSpan('testChildOperation2', { parentSpan, component: 'payment' });
      expect(childSpan2).to.be.an('object');
    }, 20);

    setTimeout(() => {
      traceLogger.endSpan(childSpan2);
      traceLogger.endSpan(parentSpan);

      expect(testLogger.logs.length).to.equal(4);


      done();
    }, 40);
  }).timeout(1000);

  it('should create and log a http operation', (done) => {
    expect(traceLogger).to.be.an('object');

    const span = traceLogger.createSpan('testHttpOperation', {});
    expect(span).to.be.an('object');

    span.log({ event: 'request_end' });

    setTimeout(() => {
      traceLogger.endSpan(span, {
        statusCode: 200,
      });
      expect(testLogger.logs.length).to.equal(1);
      done();
    }, 20);
  }).timeout(5000);

  it('should create and log a failed http operation', (done) => {
    expect(traceLogger).to.be.an('object');

    const span = traceLogger.createSpan('testFailedHttpOperation', {});
    expect(span).to.be.an('object');

    span.log({ event: 'details of the error' });

    setTimeout(() => {
      traceLogger.endSpan(span, {
        statusCode: 500,
        error: true,
      });
      expect(testLogger.logs.length).to.equal(1);
      done();
    }, 10);
  }).timeout(5000);


  it('should create and log a child http with invalid headers', (done) => {
    const childSpan = traceLogger.createSpan('testHttpHeaderChildOperation', {
      headers: {
        invalid: 'header',
      },
    });
    expect(childSpan).to.be.an('object');

    traceLogger.endSpan(childSpan, {
      statusCode: 200,
    });
    expect(testLogger.logs.length).to.equal(1);
    done();
  }).timeout(5000);


  it('should create and log a child http operation from headers', (done) => {
    expect(traceLogger).to.be.an('object');

    const parentSpan = traceLogger.createSpan('testHttpHeaderParentOperation');
    expect(parentSpan).to.be.an('object');

    const headers = traceLogger.getChildHttpHeaders(parentSpan);
    expect(headers).to.be.an('object');
    expect(headers).to.have.property('uber-trace-id').that.is.a('string');

    const childSpan = traceLogger.createSpan('testHttpHeaderChildOperation', {
      headers,
    });
    expect(childSpan).to.be.an('object');

    setTimeout(() => {
      traceLogger.endSpan(childSpan, {
        statusCode: 200,
      });
      traceLogger.endSpan(parentSpan, {
        statusCode: 200,
      });
      expect(testLogger.logs.length).to.equal(2);
      done();
    }, 10);
  }).timeout(5000);
});
