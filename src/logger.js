const os = require('os');
const pino = require('pino');
const { v4: uuidv4 } = require('uuid');
const objectPath = require('object-path');
const BasicLogger = require('./basic-logger');
const TracingLogger = require('./tracing-logger.js');

class Logger {
  static defaultOptions(mode) {
    const options = {
      logLevel: 'info',
      appName: null,
      appVersion: null,
      clientHeaderName: 'User-Agent',
      requestIdName: 'id',
      requestIdHeaderName: 'X-Request-Id',
      sessionIdHeaderName: 'X-Session-Id',
      enableTracePropogation: false,
      enableOpenTracing: ('JAEGER_AGENT_HOST' in process.env || 'JAEGER_ENDPOINT' in process.env),
      enableDebugLoggingLibrary: false,
      logRequestHeaders: false,
      logResponseHeaders: false,
      redactionPaths: ['req.headers.cookie', 'req.headers.host'],
      excludeRequestPaths: [],
      basicLogging: false,
      ...Logger.defaultKeyNames(mode),
    };

    if (mode === 'web' || mode === 'web-java-style') {
      // only need client headers on external facing servers
      options.logRequestHeaders = true;

      // only use the request id on internal facing servers
      // so turn it off for external servers
      options.enableTracePropogation = false;
    } else {
      // internal servers should always do this
      options.enableTracePropogation = true;
    }

    return options;
  }

  static defaultKeyNames(mode) {
    if (mode === 'web-java-style' || mode === 'api-java-style') {
      return Logger.javaStyleKeyNames();
    }
    return Logger.standardKeyNames();
  }

  static standardKeyNames() {
    return {
      levelKey: 'level',
      pidKey: 'pid',
      hostnameKey: 'hostname',
      messageKey: 'message',
      timestampKey: 'time',
      loggerNameKey: 'app.name',
      loggerVersionKey: 'app.version',
      httpMethodKey: 'req.method',
      httpUriKey: 'req.url',
      nameSpaceKey: 'nameSpace',
      httpProtocolKey: 'req.protocol',
      httpReqHeadersKey: 'req.headers',
      httpRespHeadersKey: 'res.headers',
      httpStatusCodeKey: 'res.statusCode',
      httpResponseTimeKey: 'res.responseTime',
      traceRequestIdKey: 'trace.request_id',
      traceClientKey: 'useragent',
      traceSessionIdKey: 'trace.session_id',
    };
  }

  static javaStyleKeyNames() {
    return {
      levelKey: 'level',
      pidKey: 'pid',
      hostnameKey: 'hostname',
      messageKey: 'message',
      timestampKey: '@timestamp',
      loggerNameKey: 'logger_name',
      loggerVersionKey: 'logger_version',
      httpMethodKey: 'method',
      httpUriKey: 'requested_uri',
      nameSpaceKey: 'ns',
      httpProtocolKey: 'protocol',
      httpReqHeadersKey: 'request_headers',
      httpRespHeadersKey: 'response_headers',
      httpStatusCodeKey: 'status_code',
      httpResponseTimeKey: 'elapsed_time',
      traceRequestIdKey: 'request_id',
      traceClientKey: 'client',
      traceSessionIdKey: 'session_id',
    };
  }

  static create(mode, options) {
    const loggerOptions = Logger.createAndValidateOptions(mode, options);

    Logger.compileFilters(loggerOptions);

    Logger.obtainAppDetails(loggerOptions);

    const pinoLogger = Logger.createPinoLogger(loggerOptions);

    if (loggerOptions.enableOpenTracing) {
      pinoLogger.traceLogger = new TracingLogger(pinoLogger, {
        appName: loggerOptions.appName,
      });
    }

    pinoLogger.closeLogger = (done) => {
      if (pinoLogger.traceLogger) {
        pinoLogger.traceLogger.close(done);
      } else if (done) {
        done();
      }
    };

    const baseLogger = loggerOptions.basicLogging
      ? new BasicLogger(pinoLogger) : pinoLogger;

    baseLogger.httpLogger = (req, res, next) => {
      Logger.middlewarePrepareRequest(req, res, next, loggerOptions, baseLogger);
    };

    return baseLogger;
  }

  static createAndValidateOptions(mode = 'web', options = {}) {
    let specifiedOptions = options;
    let specifiedMode = 'api';

    switch (typeof mode) {
      case 'object':
        specifiedOptions = mode;
        break;
      case 'string':
        specifiedMode = mode;
        break;
      default:
        specifiedMode = 'invalid value';
        break;
    }

    Logger.validateOptions(specifiedMode, specifiedOptions);

    const finalOptions = { ...Logger.defaultOptions(specifiedMode), ...specifiedOptions };

    if (finalOptions.enableOpenTracing) {
      // open tracing over-rides use of our home grown tracing
      finalOptions.enableTracePropogation = false;
      finalOptions.requestIdHeaderName = 'uber-trace-id';
    }

    return finalOptions;
  }

  static obtainAppPackage(path) {
    let packageInfo = null;

    try {
      packageInfo = require(path); // eslint-disable-line
    } catch (ex) {
      packageInfo = null;
    }

    return packageInfo;
  }

  static obtainAppDetails(options) {
    const loggerOptions = options;

    if ('JAEGER_SERVICE_NAME' in process.env) {
      loggerOptions.appName = process.env.JAEGER_SERVICE_NAME;
    }

    if ((loggerOptions.appName === null) || (loggerOptions.appVersion === null)) {
      // Get the application and version from the package. This saves the caller having
      // to supply their app name.
      let packageInfo = Logger.obtainAppPackage('../../../../package.json');
      if (packageInfo === null) {
        packageInfo = Logger.obtainAppPackage('../package.json');
      }

      if (loggerOptions.appName === null) {
        loggerOptions.appName = packageInfo && packageInfo.name ? packageInfo.name : 'app-name-not-specified';
      }

      if (loggerOptions.appVersion === null) {
        loggerOptions.appVersion = packageInfo && packageInfo.version ? packageInfo.version : '1.0.0';
      }
    }

    if ('logRequestHeaders' in loggerOptions && 'redactionPaths' in loggerOptions && !loggerOptions.logRequestHeaders) {
      loggerOptions.redactionPaths.unshift('req.headers');
    }

    if ('logResponseHeaders' in loggerOptions && 'redactionPaths' in loggerOptions && !loggerOptions.logResponseHeaders) {
      loggerOptions.redactionPaths.unshift('res.headers');
    }
  }

  static createPinoBase(loggerOptions) {
    const baseConfig = {};

    objectPath.set(baseConfig, loggerOptions.pidKey, process.pid);
    objectPath.set(baseConfig, loggerOptions.hostnameKey, os.hostname());
    objectPath.set(baseConfig, loggerOptions.loggerNameKey, loggerOptions.appName);
    objectPath.set(baseConfig, loggerOptions.loggerVersionKey, loggerOptions.appVersion);

    return baseConfig;
  }

  static createPinoConfig(loggerOptions) {
    const config = {
      base: Logger.createPinoBase(loggerOptions),
      formatters: {
        ...loggerOptions.levelKey && {
          level: (label) => ({ [loggerOptions.levelKey]: label }),
        },
      },
      level: loggerOptions.logLevel,
      messageKey: loggerOptions.messageKey,
      redact: {
        paths: loggerOptions.redactionPaths,
        remove: true,
      },
      timestamp: () => `,"${loggerOptions.timestampKey}":"${(new Date()).toISOString()}"`,
      serializers: {},
      ...loggerOptions.pino,
    };

    return config;
  }

  static createPinoLogger(loggerOptions) {
    const baseLogger = pino(Logger.createPinoConfig(loggerOptions), loggerOptions.outputStream);

    baseLogger.loggerOptions = loggerOptions;
    baseLogger.loggerClass = Logger;

    if (loggerOptions.enableDebugLoggingLibrary) {
      // eslint-disable-next-line global-require
      const pinoDebug = require('pino-debug');
      pinoDebug(baseLogger, {
        auto: true,
        map: {
          '*fatal': 'fatal',
          '*error': 'error',
          '*warn': 'warn',
          '*info': 'info',
          '*debug': 'debug',
          '*trace': 'trace',
        },
      });
    }

    return baseLogger;
  }

  static compileFilters(options) {
    const ammendedOptions = options;
    ammendedOptions.excludeRequestPathsRegExs = options.excludeRequestPaths
      .map((f) => new RegExp(f, 'i'));
  }

  static validStringOption(option, options, possibleValues) {
    if (option in options) {
      if (((typeof options[option] !== 'string') || (options[option].length === 0))) {
        throw new TypeError(`Expected parameter option '${option}' to be a non-empty string`);
      }

      if (possibleValues && !possibleValues.includes(options[option])) {
        throw new TypeError(`Expected parameter option '${option}' to be one of these values: [ ${possibleValues.join(', ')} ]`);
      }
    }
  }

  static validStringArrayOption(option, options) {
    if (option in options) {
      if (!Array.isArray(options[option])) {
        throw new TypeError(`Expected parameter option '${option}' to be an array`);
      }

      options[option].forEach((opt) => {
        if (((typeof opt !== 'string') || (opt.length === 0))) {
          throw new TypeError(`Expected parameter option '${option}' to only contain strings`);
        }
      });
    }
  }

  static validBooleanOption(option, options) {
    if ((option in options) && (typeof options[option] !== 'boolean')) {
      throw new TypeError(`Expected parameter option '${option}' to be a boolean`);
    }
  }

  static validObjectOption(option, options) {
    if ((option in options) && (typeof options[option] !== 'object')) {
      throw new TypeError(`Expected parameter option '${option}' to be an object`);
    }
  }

  static validateOptions(mode, options) {
    const modeOption = { mode };
    Logger.validStringOption('mode', modeOption, ['web', 'api', 'web-java-style', 'api-java-style']);

    if (typeof options !== 'object') {
      throw new TypeError('Expected parameter options to be an object');
    }

    Logger.validStringOption('logLevel', options, ['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
    Logger.validStringOption('appName', options);
    Logger.validStringOption('appVersion', options);
    Logger.validStringOption('clientHeaderName', options);
    Logger.validStringOption('requestIdName', options);
    Logger.validStringOption('requestIdHeaderName', options);
    Logger.validStringOption('sessionIdHeaderName', options);

    Logger.validStringOption('levelKey', options);
    Logger.validStringOption('pidKey', options);
    Logger.validStringOption('hostnameKey', options);
    Logger.validStringOption('messageKey', options);
    Logger.validStringOption('timestampKey', options);
    Logger.validStringOption('loggerNameKey', options);
    Logger.validStringOption('loggerVersionKey', options);
    Logger.validStringOption('httpMethodKey', options);
    Logger.validStringOption('httpUriKey', options);
    Logger.validStringOption('nameSpaceKey', options);
    Logger.validStringOption('httpProtocolKey', options);
    Logger.validStringOption('httpReqHeadersKey', options);
    Logger.validStringOption('httpRespHeadersKey', options);
    Logger.validStringOption('httpStatusCodeKey', options);
    Logger.validStringOption('httpResponseTimeKey', options);
    Logger.validStringOption('traceRequestIdKey', options);
    Logger.validStringOption('traceClientKey', options);
    Logger.validStringOption('traceSessionIdKey', options);

    Logger.validBooleanOption('enableTracePropogation', options);

    Logger.validBooleanOption('enableDebugLoggingLibrary', options);
    Logger.validBooleanOption('logRequestHeaders', options);
    Logger.validBooleanOption('logResponseHeaders', options);

    Logger.validStringArrayOption('redactionPaths', options);
    Logger.validStringArrayOption('excludeRequestPaths', options);

    Logger.validObjectOption('pino', options);
  }

  static filterOutRequest(req, options) {
    return typeof options.excludeRequestPathsRegExs
      .find((f) => f.test(req.url)) !== 'undefined';
  }

  static isStatusAnError(res) {
    if ('spanError' in res && res.spanError) {
      return true;
    }
    const parsedStatus = Number.parseInt(res.statusCode, 10);
    return Number.isNaN(parsedStatus) || (parsedStatus >= 400 && parsedStatus !== 404);
  }

  static calcResponseTime(startTime) {
    return Math.round(parseInt(`${process.hrtime.bigint() - startTime}`, 10) * 0.001) * 0.001;
  }

  static logNameSpace(responseSent) {
    return responseSent ? 'http' : 'abandoned';
  }

  static logResponse(params, traceLogger) {
    const commonHTTPResponseLog = `${params.commonHTTPLog} ${params.res.statusCode}`;

    const logDetails = {};

    objectPath.set(logDetails, params.options.nameSpaceKey,
      Logger.logNameSpace(params.responseSent));
    objectPath.set(logDetails, params.options.httpMethodKey, params.reqToLog.method);
    objectPath.set(logDetails, params.options.httpUriKey, params.reqToLog.url);
    objectPath.set(logDetails, params.options.httpProtocolKey, params.reqToLog.protocol);

    if ('headers' in params.reqToLog) {
      objectPath.set(logDetails, params.options.httpReqHeadersKey, params.reqToLog.headers);
    }

    objectPath.set(logDetails, params.options.httpStatusCodeKey, params.res.statusCode);
    objectPath.set(logDetails, params.options.httpResponseTimeKey,
      Logger.calcResponseTime(params.startTime));

    if (params.options.logResponseHeaders) {
      objectPath.set(logDetails, params.options.httpRespHeadersKey, params.res.getHeaders());
    }

    params.req.log[params.httpLogLevel](logDetails, commonHTTPResponseLog);

    if (traceLogger) {
      traceLogger.endSpan(params.req.span, {
        statusCode: params.res.statusCode,
        error: Logger.isStatusAnError(params.res),
      });
    }
  }

  static createOpenTracingSpan(req, options, traceLogger) {
    const opName = `${req.method}:${req.originalUrl}`;

    req.span = traceLogger.createSpan(opName, {
      headers: req.headers,
    });

    const openTracing = traceLogger.getChildHttpHeaders(req.span);

    return openTracing;
  }

  static propogateTracing(req, options) {
    let id = null;
    const openTracing = {};

    const reqIdName = options.requestIdHeaderName.toLowerCase();

    const sessionIdRegEx = new RegExp(options.sessionIdHeaderName, 'i');

    if (options.enableTracePropogation) {
      const headers = Object.getOwnPropertyNames(req.headers);

      headers.forEach((h) => {
        const lch = h.toLowerCase();
        if (reqIdName === lch) {
          // propogate the id
          id = req.headers[h];
        }

        if (lch === 'b3' || lch.match(/^x-b3-.+/) !== null || sessionIdRegEx.test(lch)) {
          // propogate the b3, openzipkin headers
          openTracing[h] = req.headers[h];
        }
      });
    }

    if (id == null || id === '') {
      id = uuidv4();
    }

    openTracing[options.requestIdHeaderName] = id;

    return openTracing;
  }

  // Prepare a logger for all requests. This will make available a `req.log.*()`
  // series of log functions (info, warn, etc).
  static middlewarePrepareRequest(req, res, next, options, logger) {
    // Set up the request object with the logger, id,
    // start time and a function to log the completion
    const startTime = process.hrtime.bigint();
    let responseSent = false;

    let httpLogLevel = 'info';
    if (Logger.filterOutRequest(req, options)) {
      // reduce the log to trace level, in effect filtering it out.
      httpLogLevel = 'trace';
    }

    if (options.enableOpenTracing) {
      if (httpLogLevel === 'trace') {
        // we dont want to create a span if we are ignoring this request
        req.openTracing = {};
        req.openTracing[options.requestIdHeaderName] = uuidv4();
      } else {
        req.openTracing = Logger.createOpenTracingSpan(req, options, logger.traceLogger);
      }
    } else {
      req.openTracing = Logger.propogateTracing(req, options);
    }

    req[options.requestIdName] = req.openTracing[options.requestIdHeaderName];

    const traceObj = {};

    objectPath.set(traceObj, options.traceRequestIdKey, req[options.requestIdName]);

    if (!options.enableOpenTracing) {
      const value = req.get(options.clientHeaderName);
      if (value) {
        objectPath.set(traceObj, options.traceClientKey, value);
      }

      const sessionValue = req.get(options.sessionIdHeaderName);
      if (sessionValue) {
        objectPath.set(traceObj, options.traceSessionIdKey, sessionValue);
      }
    }

    req.log = logger.child(traceObj);

    const reqToLog = {
      method: req.method,
      url: req.originalUrl,
      protocol: req.protocol,
    };
    if (options.logRequestHeaders && req.headers) {
      reqToLog.headers = req.headers;
    }

    const commonHTTPLog = `${req.method} ${req.originalUrl} ${req.protocol}/${req.httpVersion}`;

    res.on('finish', () => {
      responseSent = true;
      const resParams = {
        startTime, httpLogLevel, reqToLog, commonHTTPLog, req, res, options, responseSent,
      };
      Logger.logResponse(resParams, logger.traceLogger);
    });

    res.on('close', () => {
      if (!responseSent) {
        const resParams = {
          startTime, httpLogLevel, reqToLog, commonHTTPLog, req, res, options, responseSent,
        };
        Logger.logResponse(resParams, logger.traceLogger);
      }
    });

    next();
  }
}

module.exports = Logger.create;
