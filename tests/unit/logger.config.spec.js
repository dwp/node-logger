/* eslint max-classes-per-file: 0 */
const sinon = require('sinon');
const chai = require('chai');
chai.use(require('sinon-chai'));
const objectPath = require('object-path');
const packageInfo = require('../../package.json');
const Logger = require('../../src/logger.js');
const SimulatedLoggerStream = require('../utils/simulated-logger-stream.js');

const { expect } = chai;

function removeJaegerEnvVar() {
  if ('JAEGER_AGENT_HOST' in process.env) {
    delete process.env.JAEGER_AGENT_HOST;
  }
  if ('JAEGER_ENDPOINT' in process.env) {
    delete process.env.JAEGER_ENDPOINT;
  }
  if ('JAEGER_SERVICE_NAME' in process.env) {
    delete process.env.JAEGER_SERVICE_NAME;
  }
}

describe('Logger config', () => {
  before(() => {
    removeJaegerEnvVar();
  });


  it('should export a function', () => {
    expect(Logger).to.be.a('function');
  });

  const checkForLoggerByMode = (logger, mode) => {
    expect(logger).to.be.an('object');
    expect(logger).to.have.property('trace').that.is.a('function');
    expect(logger).to.have.property('debug').that.is.a('function');
    expect(logger).to.have.property('info').that.is.a('function');
    expect(logger).to.have.property('warn').that.is.a('function');
    expect(logger).to.have.property('error').that.is.a('function');
    expect(logger).to.have.property('fatal').that.is.a('function');

    expect(logger.loggerClass).to.be.an('function');
    expect(logger.loggerOptions.logLevel).to.equal('info');
    expect(logger.loggerOptions.appName).to.equal(packageInfo.name);
    expect(logger.loggerOptions.appVersion).to.equal(packageInfo.version);
    expect(logger.loggerOptions.requestIdName).to.equal('id');

    expect(logger.loggerOptions.requestIdHeaderName).to.equal(logger.loggerOptions.enableOpenTracing ? 'uber-trace-id' : 'X-Request-Id');

    expect(logger.loggerOptions.enableTracePropogation).to.equal(mode !== 'web' && !logger.loggerOptions.enableOpenTracing);

    expect(logger.loggerOptions.messageKey).to.equal('message');
    expect(logger.loggerOptions.timestampKey).to.equal('time');


    expect(logger.loggerOptions.enableDebugLoggingLibrary).to.equal(false);

    expect(logger.loggerOptions.logRequestHeaders).to.equal(mode === 'web');

    expect(logger.loggerOptions.logResponseHeaders).to.equal(false);
    expect(logger.loggerOptions.excludeRequestPaths.length).to.equal(0);
    expect(logger.httpLogger).to.be.an('function');
  };


  it('Logger function should create a default logger', () => {
    const logger = Logger();
    checkForLoggerByMode(logger, 'web');
  });

  it('Logger function should create a default web logger', () => {
    const logger = Logger('web');
    checkForLoggerByMode(logger, 'web');
  });

  it('Logger function should create a default api logger', () => {
    const logger = Logger('api');
    checkForLoggerByMode(logger, 'api');
  });

  it('Logger function should create a logger with specified options', () => {
    const logger = Logger({
      enableOpenTracing: false,
      logLevel: 'error',
      appName: 'testapp',
      appVersion: '4.5.6',
      requestIdName: 'reqid',
      requestIdHeaderName: 'X-Request-Id2',
      messageKey: 'themessage',
      timestampKey: 'thetimestamp',
      enableDebugLoggingLibrary: false,
      logRequestHeaders: true,
      logResponseHeaders: true,
      excludeRequestPaths: ['^/static/'],
    });
    expect(logger.loggerClass).to.be.an('function');
    expect(logger.loggerOptions.logLevel).to.equal('error');
    expect(logger.loggerOptions.appName).to.equal('testapp');
    expect(logger.loggerOptions.appVersion).to.equal('4.5.6');
    expect(logger.loggerOptions.requestIdName).to.equal('reqid');
    expect(logger.loggerOptions.requestIdHeaderName).to.equal('X-Request-Id2');
    expect(logger.loggerOptions.messageKey).to.equal('themessage');
    expect(logger.loggerOptions.timestampKey).to.equal('thetimestamp');
    expect(logger.loggerOptions.enableDebugLoggingLibrary).to.equal(false);
    expect(logger.loggerOptions.logRequestHeaders).to.equal(true);
    expect(logger.loggerOptions.logResponseHeaders).to.equal(true);
    expect(logger.loggerOptions.excludeRequestPaths.length).to.equal(1);
    expect(logger.httpLogger).to.be.an('function');
  });

  it('Logger function should throw when given an invalid mode', () => {
    expect(() => Logger('invalid')).to.throw(TypeError, "Expected parameter option 'mode' to be one of these values: [ web, api, web-java-style, api-java-style ]");
  });

  it('Logger function should throw when given something other than an object or valid string', () => {
    expect(() => Logger(123)).to.throw(TypeError, "Expected parameter option 'mode' to be one of these values: [ web, api, web-java-style, api-java-style ]");
  });

  it('Logger function should throw when given something other than an object for an option', () => {
    expect(() => Logger('web', 123)).to.throw(TypeError, 'Expected parameter options to be an object');
  });


  it('Logger function should throw when given an invalid string params', () => {
    expect(() => Logger({
      appName: 123,
    })).to.throw(TypeError, "Expected parameter option 'appName' to be a non-empty string");
    expect(() => Logger({
      appName: '',
    })).to.throw(TypeError, "Expected parameter option 'appName' to be a non-empty string");
    expect(() => Logger({
      appName: null,
    })).to.throw(TypeError, "Expected parameter option 'appName' to be a non-empty string");

    expect(() => Logger({
      appName: 123,
    })).to.throw(TypeError, "Expected parameter option 'appName' to be a non-empty string");
    expect(() => Logger({
      appVersion: 123,
    })).to.throw(TypeError, "Expected parameter option 'appVersion' to be a non-empty string");
    expect(() => Logger({
      requestIdName: 123,
    })).to.throw(TypeError, "Expected parameter option 'requestIdName' to be a non-empty string");
    expect(() => Logger({
      requestIdHeaderName: 123,
    })).to.throw(TypeError, "Expected parameter option 'requestIdHeaderName' to be a non-empty string");
    expect(() => Logger({
      messageKey: 123,
    })).to.throw(TypeError, "Expected parameter option 'messageKey' to be a non-empty string");
    expect(() => Logger({
      timestampKey: 123,
    })).to.throw(TypeError, "Expected parameter option 'timestampKey' to be a non-empty string");
  });


  it('Logger function should throw when given an invalid logLevel param', () => {
    expect(() => Logger({
      logLevel: 'invalidLevel',
    })).to.throw(TypeError, "Expected parameter option 'logLevel' to be one of these values: [ trace, debug, info, warn, error, fatal ]");
  });

  it('Logger function should throw when given an invalid redactionPaths param', () => {
    expect(() => Logger({
      redactionPaths: 'invalidRedactions',
    })).to.throw(TypeError, "Expected parameter option 'redactionPaths' to be an array");

    expect(() => Logger({
      redactionPaths: ['aaa', 123, false],
    })).to.throw(TypeError, "Expected parameter option 'redactionPaths' to only contain strings");
  });

  it('Logger function should throw when given an invalid excludeRequestPaths param', () => {
    expect(() => Logger({
      excludeRequestPaths: 'invalid',
    })).to.throw(TypeError, "Expected parameter option 'excludeRequestPaths' to be an array");

    expect(() => Logger({
      excludeRequestPaths: ['aaa', 123, false],
    })).to.throw(TypeError, "Expected parameter option 'excludeRequestPaths' to only contain strings");

    expect(() => Logger({
      excludeRequestPaths: ['/static/'],
    })).not.to.throw(TypeError);

    expect(() => Logger({
      excludeRequestPaths: ['[[['],
    })).to.throw(SyntaxError, 'Invalid regular expression: /[[[/: Unterminated character class');
  });

  it('Logger function should throw when given an invalid booleans', () => {
    expect(() => Logger({
      enableDebugLoggingLibrary: 123,
    })).to.throw(TypeError, "Expected parameter option 'enableDebugLoggingLibrary' to be a boolean");
    expect(() => Logger({
      logRequestHeaders: 123,
    })).to.throw(TypeError, "Expected parameter option 'logRequestHeaders' to be a boolean");
    expect(() => Logger({
      logResponseHeaders: 123,
    })).to.throw(TypeError, "Expected parameter option 'logResponseHeaders' to be a boolean");


    expect(() => Logger({
      pino: 123,
    })).to.throw(TypeError, "Expected parameter option 'pino' to be an object");
  });


  it('Logger should create a valid pino configuration', () => {
    const logger = Logger('web', { enableOpenTracing: false });

    const options = logger.loggerClass.createAndValidateOptions('web');
    const config = logger.loggerClass.createPinoConfig(options);

    expect(config.base.pid).to.equal(process.pid);
    expect(config.messageKey).to.equal('message');
    expect(config.level).to.equal('info');
    expect(config.useLevelLabels).to.equal(true);
    expect(config.redact.remove).to.equal(true);
    expect(config.redact.paths.length).to.equal(2);
  });


  it('Logger should create a valid pino configuration given a custom config', () => {
    const logger = Logger('web', { enableOpenTracing: false });

    const customOptions = {
      pino: {
        customPinoOption: 'test',
        level: 'error',
        redact: {
          paths: ['test'],
          remove: false,
        },
      },
    };

    const options = logger.loggerClass.createAndValidateOptions('web', customOptions);
    const config = logger.loggerClass.createPinoConfig(options);

    expect(config.messageKey).to.equal('message');
    expect(config.level).to.equal('error');
    expect(config.customPinoOption).to.equal('test');
    expect(config.redact.remove).to.equal(false);
    expect(config.redact.paths.length).to.equal(1);
  });
});

describe('Logger configure property keys', () => {
  before(() => {
    removeJaegerEnvVar();
  });

  const checkForKeyPropertiesNames = (config) => {
    const logger = Logger({
      appName: 'test-name',
      appVersion: '99.9.9',
      ...config,
      outputStream: new SimulatedLoggerStream(),
    });
    expect(logger.loggerOptions.messageKey).to.equal(config.messageKey);
    expect(logger.loggerOptions.timestampKey).to.equal(config.timestampKey);

    logger.warn('test message');
    const itemOutput = JSON.parse(logger.loggerOptions.outputStream.logs[0]);
    expect(itemOutput[config.messageKey]).to.match(/test message/);
    expect(itemOutput[config.timestampKey]).to.match(/Z$/);

    expect(objectPath.get(itemOutput, config.loggerNameKey)).to.equal('test-name');
    expect(objectPath.get(itemOutput, config.loggerVersionKey)).to.equal('99.9.9');

    return itemOutput;
  };


  it('Keys for a custom style logger', () => {
    checkForKeyPropertiesNames({
      messageKey: 'my_message',
      timestampKey: 'my_time',
      loggerNameKey: 'my_logger_name',
      loggerVersionKey: 'my_logger_version',
    });
  });

  it('Keys for a custom style logger with embedded logger name', () => {
    checkForKeyPropertiesNames({
      messageKey: 'my_message',
      timestampKey: 'my_time',
      loggerNameKey: 'my.logger.name',
      loggerVersionKey: 'my.logger.version',
    });
  });

  it('Keys for the java style logger', () => {
    const logger = Logger();
    const config = logger.loggerClass.javaStyleKeyNames();
    const itemOutput = checkForKeyPropertiesNames(config);
    expect(itemOutput).to.have.property('message');
    expect(itemOutput).to.have.property('@timestamp');
    expect(itemOutput).to.have.property('logger_name');
    expect(itemOutput).to.have.property('logger_version');
  });

  it('Keys for the standard style logger', () => {
    const logger = Logger();
    const config = logger.loggerClass.standardKeyNames();
    const itemOutput = checkForKeyPropertiesNames(config);
    expect(itemOutput).to.have.property('message');
    expect(itemOutput).to.have.property('time');
    expect(itemOutput).to.have.property('app');
    expect(itemOutput.app).to.have.property('name');
    expect(itemOutput.app).to.have.property('version');
  });

  it('java-style enables java style logging', () => {
    const logger = Logger('web-java-style');
    //    const logger = Logger("java-style");
    expect(logger.loggerOptions.messageKey).to.equal('message');
    expect(logger.loggerOptions.timestampKey).to.equal('@timestamp');
    expect(logger.loggerOptions.loggerNameKey).to.equal('logger_name');
    expect(logger.loggerOptions.loggerVersionKey).to.equal('logger_version');
  });
});

describe('Logger config application details', () => {
  let options;

  before(() => {
    removeJaegerEnvVar();
  });

  beforeEach(() => {
    options = {
      appName: null,
      appVersion: null,
      logRequestHeaders: false,
      logResponseHeaders: false,
    };
  });


  afterEach(() => {
    if ('JAEGER_SERVICE_NAME' in process.env) {
      delete process.env.JAEGER_SERVICE_NAME;
    }
  });

  it('should take use JAEGER_SERVICE_NAME if available', () => {
    const logger = Logger();
    process.env.JAEGER_SERVICE_NAME = 'testName';
    logger.loggerClass.obtainAppDetails(options);
    expect(options.appName).to.equal('testName');
  });

  it('should take always use JAEGER_SERVICE_NAME if available', () => {
    const logger = Logger();
    options.appName = 'xxxx';
    process.env.JAEGER_SERVICE_NAME = 'testName';
    logger.loggerClass.obtainAppDetails(options);
    expect(options.appName).to.equal('testName');
  });

  it('should use specified values for app and version', () => {
    const logger = Logger();
    options.appName = 'xxxx';
    options.appVersion = '2.2.2';
    logger.loggerClass.obtainAppDetails(options);
    expect(options.appName).to.equal('xxxx');
    expect(options.appVersion).to.equal('2.2.2');
  });

  it('should use default values for app and version if package cannot be loaded', () => {
    const logger = Logger();
    sinon.stub(logger.loggerClass, 'obtainAppPackage').callsFake(() => null);
    logger.loggerClass.obtainAppDetails(options);
    logger.loggerClass.obtainAppPackage.restore();
    expect(options.appName).to.equal('app-name-not-specified');
    expect(options.appVersion).to.equal('1.0.0');
  });

  it('should use default values for app if package cannot be loaded', () => {
    const logger = Logger();
    options.appVersion = '2.2.2';
    sinon.stub(logger.loggerClass, 'obtainAppPackage').callsFake(() => ({
      name: 'zzzz',
      version: '5.5.5',
    }));
    logger.loggerClass.obtainAppDetails(options);
    logger.loggerClass.obtainAppPackage.restore();
    expect(options.appName).to.equal('zzzz');
    expect(options.appVersion).to.equal('2.2.2');
  });
});
