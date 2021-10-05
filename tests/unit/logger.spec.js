/* eslint max-classes-per-file: 0 */
const os = require('os');
const chai = require('chai');
chai.use(require('sinon-chai'));
const Logger = require('../../src/logger.js');
const SimulatedLoggerStream = require('../utils/simulated-logger-stream.js');

const { expect } = chai;

const testBasicLogging = (logger, doesprintf, done, op) => {
  const testString1 = 'A simple string';
  const testString2 = 'to output';

  const origLinesOutput = logger.loggerOptions.outputStream.logs.length;

  logger[op](testString1, testString2);

  const linesOutput = logger.loggerOptions.outputStream.logs.length;

  expect(linesOutput).to.equal(origLinesOutput + 1);

  const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[origLinesOutput]);

  expect(itemOutput).to.be.an('object');

  if (doesprintf) {
    expect(itemOutput.message).to.equal(`${testString1}`);
  } else {
    expect(itemOutput.message).to.equal(`${testString1} ${testString2}`);
  }

  expect(itemOutput.level).to.equal(op);
  expect(itemOutput.hostname).to.equal(os.hostname());
  expect(itemOutput.pid).to.be.above(0);
  expect(itemOutput[logger.loggerOptions.timestampKey]).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);

  expect(itemOutput.app.name).to.equal('@dwp/node-logger');
  expect(itemOutput.app.version.length).to.be.above(4);
};

describe('Logger in pino mode', () => {
  if ('JAEGER_AGENT_HOST' in process.env) {
    delete process.env.JAEGER_AGENT_HOST;
  }
  if ('JAEGER_ENDPOINT' in process.env) {
    delete process.env.JAEGER_ENDPOINT;
  }

  it('should output a json when a log is called', (done) => {
    const logger = Logger({
      enableOpenTracing: false,
      logLevel: 'trace',
      outputStream: new SimulatedLoggerStream(),
    });

    ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
      .forEach((op) => testBasicLogging(logger, true, done, op));

    done();
  });

  it('should not output below the specified log level', (done) => {
    const logger = Logger({
      enableOpenTracing: false,
      logLevel: 'error',
      outputStream: new SimulatedLoggerStream(),
    });

    ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
      .forEach((op) => logger[op]('test string'));

    const linesOutput = logger.loggerOptions.outputStream.logs.length;

    expect(linesOutput).to.equal(2);

    done();
  });

  it('should output a additional context objects converted to a string', () => {
    const logger = Logger({
      enableOpenTracing: false,
      outputStream: new SimulatedLoggerStream(),
    });

    logger.info('test string1 %o', { item1: 'additional1', item2: 'additional2' });
    expect(logger.loggerOptions.outputStream.logs.length).to.equal(1);
    const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[0]);
    expect(itemOutput).to.be.an('object');
    expect(itemOutput.level).to.equal('info');
    expect(itemOutput.message).to.equal('test string1 {"item1":"additional1","item2":"additional2"}');
    expect(itemOutput.item1).to.be.undefined; // eslint-disable-line
    expect(itemOutput.item2).to.be.undefined; // eslint-disable-line
  });

  it('should output the object supplied as an object', () => {
    const logger = Logger({
      enableOpenTracing: false,
      outputStream: new SimulatedLoggerStream(),
    });

    logger.info({ item1: 'additional1', item2: 'additional2' });
    expect(logger.loggerOptions.outputStream.logs.length).to.equal(1);
    const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[0]);
    expect(itemOutput).to.be.an('object');
    expect(itemOutput.message).to.be.undefined; // eslint-disable-line
    expect(itemOutput.item1).to.equal('additional1');
    expect(itemOutput.item2).to.equal('additional2');
  });

  it('should output an object followed by a string object with a message', () => {
    const logger = Logger({
      enableOpenTracing: false,
      outputStream: new SimulatedLoggerStream(),
    });

    logger.info({ item1: 'additional1', item2: 'additional2' }, 'the message');
    expect(logger.loggerOptions.outputStream.logs.length).to.equal(1);
    const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[0]);
    expect(itemOutput).to.be.an('object');
    expect(itemOutput.item1).to.equal('additional1');
    expect(itemOutput.item2).to.equal('additional2');
    expect(itemOutput.message).to.equal('the message');
  });
});

describe('Logger in basic mode', () => {
  it('basic should output a json when a log is called', (done) => {
    const logger = Logger({
      enableOpenTracing: false,
      basicLogging: true,
      logLevel: 'trace',
      outputStream: new SimulatedLoggerStream(),
    });

    ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
      .forEach((op) => testBasicLogging(logger, false, done, op));

    done();
  });

  it('should not output below the specified log level', (done) => {
    const logger = Logger({
      enableOpenTracing: false,
      basicLogging: true,
      logLevel: 'error',
      outputStream: new SimulatedLoggerStream(),
    });

    ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
      .forEach((op) => logger[op]('test string'));

    const linesOutput = logger.loggerOptions.outputStream.logs.length;

    expect(linesOutput).to.equal(2);

    done();
  });

  it('should output a additional context object by merging its properties', () => {
    const logger = Logger({
      enableOpenTracing: false,
      basicLogging: true,
      outputStream: new SimulatedLoggerStream(),
    });

    logger.info('test string1', { item1: 'additional1', item2: 'additional2' });
    expect(logger.loggerOptions.outputStream.logs.length).to.equal(1);
    const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[0]);
    expect(itemOutput).to.be.an('object');
    expect(itemOutput.item1).to.equal('additional1');
    expect(itemOutput.item2).to.equal('additional2');
    expect(itemOutput.message).to.equal('test string1');
  });

  it('should output the object supplied as an object', () => {
    const logger = Logger({
      enableOpenTracing: false,
      outputStream: new SimulatedLoggerStream(),
    });

    logger.info({ item1: 'additional1', item2: 'additional2' });
    expect(logger.loggerOptions.outputStream.logs.length).to.equal(1);
    const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[0]);
    expect(itemOutput).to.be.an('object');
    expect(itemOutput.message).to.be.undefined; // eslint-disable-line
    expect(itemOutput.item1).to.equal('additional1');
    expect(itemOutput.item2).to.equal('additional2');
  });

  it('should output an object followed by a string object with a message', () => {
    const logger = Logger({
      enableOpenTracing: false,
      outputStream: new SimulatedLoggerStream(),
    });

    logger.info({ item1: 'additional1', item2: 'additional2' }, 'the message');
    expect(logger.loggerOptions.outputStream.logs.length).to.equal(1);
    const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[0]);
    expect(itemOutput).to.be.an('object');
    expect(itemOutput.item1).to.equal('additional1');
    expect(itemOutput.item2).to.equal('additional2');
    expect(itemOutput.message).to.equal('the message');
  });

  it('should output a additional context object by merging its properties and its message property', () => {
    const logger = Logger({
      enableOpenTracing: false,
      basicLogging: true,
      outputStream: new SimulatedLoggerStream(),
    });

    logger.info('test string1', { item1: 'additional1', item2: 'additional2', message: "object's message" });
    expect(logger.loggerOptions.outputStream.logs.length).to.equal(1);
    const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[0]);
    expect(itemOutput).to.be.an('object');
    expect(itemOutput.item1).to.equal('additional1');
    expect(itemOutput.item2).to.equal('additional2');
    expect(itemOutput.message).to.equal("test string1: object's message");
  });

  it('should output strings and ignore nulls', () => {
    const logger = Logger({
      enableOpenTracing: false,
      basicLogging: true,
      outputStream: new SimulatedLoggerStream(),
    });

    logger.info('test string', null, '123');
    expect(logger.loggerOptions.outputStream.logs.length).to.equal(1);
    const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[0]);
    expect(itemOutput).to.be.an('object');
    expect(itemOutput.message).to.equal('test string 123');
  });

  it('should output a additional error object', () => {
    const logger = Logger({
      enableOpenTracing: false,
      basicLogging: true,
      outputStream: new SimulatedLoggerStream(),
    });

    logger.info('test string1', new Error('xyz'));
    expect(logger.loggerOptions.outputStream.logs.length).to.equal(1);
    const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[0]);
    expect(itemOutput).to.be.an('object');
    expect(itemOutput.message).to.equal('test string1: xyz');
    expect(itemOutput.stack).to.not.be.undefined; // eslint-disable-line
  });
});

describe('Open tracing propogation', () => {
  const req = {
    headers: {
      test: 'propogate-1',
      'x-request-id': 'propogate-2',
      'x-b3-traceid': 'propogate-3',
      'x-b3-spanId': 'propogate-4',
      'x-b3-parentspanid': 'propogate-5',
      'X-B3-Sampled': 'propogate-6',
      'x-b3-flags': 'propogate-7',
      b3: 'propogate-8',
    },
  };

  it('should not propogate b3 headers by default', () => {
    const logger = Logger('web', { enableOpenTracing: false });
    const openTracing = logger.loggerClass.propogateTracing(req, logger.loggerOptions);

    logger.closeLogger();

    expect(openTracing.test).to.be.undefined; // eslint-disable-line

    expect(openTracing['X-Request-Id']).to.not.be.undefined; // eslint-disable-line
    expect(openTracing['x-b3-traceid']).to.be.undefined; // eslint-disable-line
  });

  it('should propogate b3 headers', () => {
    const logger = Logger({
      enableOpenTracing: false,
      enableTracePropogation: true,
    });
    const openTracing = logger.loggerClass.propogateTracing(req, logger.loggerOptions);

    expect(openTracing.test).to.be.undefined; // eslint-disable-line

    expect(openTracing['X-Request-Id']).to.not.be.undefined; // eslint-disable-line
    expect(openTracing['x-b3-traceid']).to.equal('propogate-3');
    expect(openTracing['x-b3-spanId']).to.equal('propogate-4');
    expect(openTracing['x-b3-parentspanid']).to.equal('propogate-5');
    expect(openTracing['X-B3-Sampled']).to.equal('propogate-6');
    expect(openTracing['x-b3-flags']).to.equal('propogate-7');
    expect(openTracing.b3).to.equal('propogate-8');
  });
});

describe('Check isStatusAnError definitions', () => {
  it('should not be a status error', () => {
    const logger = Logger('web', { enableOpenTracing: false });
    expect(logger.loggerClass.isStatusAnError({ statusCode: '200' })).to.equal(false);
    expect(logger.loggerClass.isStatusAnError({ statusCode: 201 })).to.equal(false);
    expect(logger.loggerClass.isStatusAnError({ statusCode: 301 })).to.equal(false);
    expect(logger.loggerClass.isStatusAnError(
      { statusCode: 100, spanError: false },
    )).to.equal(false);
    expect(logger.loggerClass.isStatusAnError({ statusCode: '404' })).to.equal(false);
  });

  it('should be a status error', () => {
    const logger = Logger('web', { enableOpenTracing: false });
    expect(logger.loggerClass.isStatusAnError({ statusCode: '400' })).to.equal(true);
    expect(logger.loggerClass.isStatusAnError({ statusCode: 403 })).to.equal(true);
    expect(logger.loggerClass.isStatusAnError({ statusCode: 500 })).to.equal(true);
    expect(logger.loggerClass.isStatusAnError(
      { statusCode: 201, spanError: true },
    )).to.equal(true);
  });
});

describe('Calc response times', () => {
  it('should calc the time in milli-seconds', (done) => {
    const logger = Logger('web', {
      enableOpenTracing: false,

      redactionPaths: ['req.headers.cookie', 'req.headers.host', 'req.headers.authorization', 'req.headers.accept',
        'req.headers.connection',
        'req.headers["accept-encoding"]', 'req.headers["accept-language"]'],

    });

    const startTime = process.hrtime.bigint();

    setTimeout(() => {
      const duration = logger.loggerClass.calcResponseTime(startTime);
      expect(duration).to.be.at.least(20);
      expect(duration).to.be.at.most(40);
      done();
    }, 21);
  });
});
