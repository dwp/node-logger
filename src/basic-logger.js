
class BasicLogger {
  constructor(pinoLogger) {
    this.pinoLogger = pinoLogger;
    this.format = this.formatBasic.bind(this);
    BasicLogger.copyProps(this, pinoLogger);
  }

  child(arg) {
    const childPino = this.pinoLogger.child(arg);
    BasicLogger.copyProps(childPino, this.pinoLogger);
    return new BasicLogger(childPino);
  }

  static copyProps(lhs, rhs) {
    const src = lhs;
    src.loggerOptions = rhs.loggerOptions;
    src.loggerClass = rhs.loggerClass;
    src.httpLogger = rhs.httpLogger;

    src.closeLogger = rhs.closeLogger;
    if (rhs.traceLogger) {
      src.traceLogger = rhs.traceLogger;
    }
  }

  trace(...args) {
    return this.pinoLogger.trace(this.format(args));
  }

  debug(...args) {
    return this.pinoLogger.debug(this.format(args));
  }

  info(...args) {
    return this.pinoLogger.info(this.format(args));
  }

  warn(...args) {
    return this.pinoLogger.warn(this.format(args));
  }

  error(...args) {
    return this.pinoLogger.error(this.format(args));
  }

  fatal(...args) {
    return this.pinoLogger.fatal(this.format(args));
  }

  formatBasic(args) {
    return args.reduce((message, arg) => {
      const revisedMessage = message;
      if ((arg !== null) && (typeof arg === 'object')) {
        const origMessage = revisedMessage[this.loggerOptions.messageKey];

        const propertyNames = Object.getOwnPropertyNames(arg);
        propertyNames.forEach((p) => {
          revisedMessage[p] = arg[p];
        });

        if (typeof origMessage !== 'undefined' && origMessage !== revisedMessage[this.loggerOptions.messageKey]) {
          revisedMessage[this.loggerOptions.messageKey] = `${origMessage}: ${message[this.loggerOptions.messageKey]}`;
        }
      } else if (arg !== null) {
        if (this.loggerOptions.messageKey in message) {
          revisedMessage[this.loggerOptions.messageKey] = `${message[this.loggerOptions.messageKey]} ${arg}`;
        } else {
          revisedMessage[this.loggerOptions.messageKey] = `${arg}`;
        }
      }
      return revisedMessage;
    }, {});
  }
}

module.exports = BasicLogger;
