const opentracing = require('opentracing');
const jaegerClient = require('jaeger-client');

class TracingLogger {
  constructor(logger, specifiedOptions) {
    this.options = {
      testMode: false,
      testLogging: false,
      ...specifiedOptions,
    };
    this.logger = logger;

    if (this.options.testMode) {
      this.tracer = new opentracing.Tracer();
    } else {
      const jaegerConfig = {
        serviceName: this.options.appName,

        sampler: {
          type: 'const',
          param: 1,
        },
        reporter: {
          logSpans: this.options.testLogging, // this logs whenever we send a span
        },
      };

      const jaegerOptions = {
        logger,
      };

      this.tracer = jaegerClient.initTracerFromEnv(jaegerConfig, jaegerOptions);
    }
  }

  close(done) {
    this.tracer.close(done);
  }

  createSpan(operation, options = {}) {
    const spanOptions = {
      tags: {},
    };

    if ('parentSpan' in options) {
      spanOptions.childOf = options.parentSpan.context();
    } else
    if ('headers' in options) {
      const parentSpanContext = this.tracer.extract(opentracing.FORMAT_HTTP_HEADERS,
        options.headers);
      if (parentSpanContext && parentSpanContext.isValid) {
        spanOptions.childOf = parentSpanContext;
      }
    }

    if ('component' in options) {
      spanOptions.tags[opentracing.Tags.COMPONENT] = options.component;
    }

    const span = this.tracer.startSpan(operation, spanOptions);

    return span;
  }

  endSpan(span, options = { error: false }) { // eslint-disable-line
    if (span) {
      if ('statusCode' in options) {
        span.setTag(opentracing.Tags.HTTP_STATUS_CODE, options.statusCode);
      }
      if ('error' in options && options.error) {
        span.setTag(opentracing.Tags.ERROR, true);
      }

      span.finish();
    }
  }

  getChildHttpHeaders(span) {
    const headersCarrier = {};
    this.tracer.inject(span.context(), opentracing.FORMAT_HTTP_HEADERS, headersCarrier);
    return headersCarrier;
  }
}

module.exports = TracingLogger;
