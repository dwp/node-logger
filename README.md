# @dwp/node-logger

## Contents
1. [What is it](#1-what-is-it)
2. [Why another logger library?](#2-why-another-logger-library)
3. [How to implement it in your project](#3-how-to-implement-it-in-your-project)
4. [How to use it](#4-how-to-use-it)
5. [Configuration](#5-configuration)
6. [Configure output](#6-configure-output)
7. [Open Tracing / Jaeger](#7-open-tracing-jaeger)
8. [Simple tracing ](#8-simple-tracing)
9. [Enabling Request chaining/tracing](#9-enabling-request-chainingtracing)
10. [Upgrading from other loggers](#10-upgrading-from-other-loggers)
11. [Application Logging best practice](#11-application-logging-best-practice)
12. [Changes from previous version](#12-changes-from-previous-version)


## 1. What is it

A node logger, to implement the common DWP json log format and [Open Tracing](https://opentracing.io).

### Upgrading from a previous version ?
Check out [Changes from previous version](#12-changes-from-previous-version)



## 2. Why another logger library?

Most node applications use one of the popular logging libraries such as debug, winston or pino. These are all highly configurable and default to plain text and provide different named log levels. For a http service to log access requests additional libraries are required and need to be configured. The same is true for adding request identifiers. The result is a mix of logging styles from different micro-services that are extremely difficult to analyse when all put together.

This logging library implements a standard json log format and provides http access logging and request identifiers with minimal configuration.

The library uses pino and gives complete access to all of its features.

This module also contains support for the [Open Tracing](https://opentracing.io) standard and the [Jaeger](https://www.jaegertracing.io) client implementation. The tracing implementation comes for free and requires no additional 
code and it gives you full access to the open tracing API if you need it.

*n.b. If adding this component to an exsiting project it is important read the  **Upgrading from other loggers** section.*

## 3. How to implement it in your project

Add logging to an express application with just three lines of code:

~~~js
// include the library
const dwpNodeLogger = require('@dwp/node-logger');
~~~

~~~js
// create a logger instance
const logger = dwpNodeLogger('web');
~~~

~~~js
// Add the logger as middleware to the express app.
// n.b. It should be one of the first items of middleware to add.
app.use(logger.httpLogger);
~~~


## 4. How to use it

~~~js
logger.info('This string will be logged');
~~~

Use on of the syslog level names to make a log entry; 'trace', 'debug', 'info', 'warn', 'error', 'fatal'. The functions accept strings and objects. See the pino documentation for exact details.


### Request based logging

A child logger, called 'log' is added to every request. 
This adds the trace context to each log entry made. The trace context contains the unique request id, and  name of the client application.

To call the child logger then just use req.log and the log level method.

~~~js
req.log.warn('A log entry specific to processing a request');
~~~

## 5. Configuration

The logger supports two differents modes, which are specified by passing a string to the creation function.

~~~js
  const logger = dwpNodeLogger('web');
~~~

Use 'web' for a user facing web service. 
This will log request headers, useful for tracking the users' origin and device type.


~~~js
  const logger = dwpNodeLogger('api');
~~~
Use 'api' for internal micro-services.
This does not log headers and turns on the use or request id headers. 

To output log entries using the property names as used by java applications then 
add '-java-style' to the mode name.

This 'java' is the format used by logstash.

~~~js
  const logger = dwpNodeLogger('web-java-style');
~~~
or
~~~js
  const logger = dwpNodeLogger('api-java-style');
~~~


The logger defaults to sensible options, but there are a number of configuration options to 
enable it to replace existing log functionality. 

~~~js
  const logger = dwpNodeLogger('web',{
    excludeRequestPaths: ['^/public/'],
  });
~~~


Pass an object to the logger creation function with only those options you want to change.
It is possible to overide any setting in this way, such as getting an api server to log headers.

| Property | Type |  Default | Description |
|-|-|-|-|
| logLevel | string | 'info'  | Only logs the specified level and above. One of 'fatal', 'error', 'warn', 'info', 'debug', 'trace'. |
| appName | string | null | The application name is added to each log entry. If not supplied the library will obtain it from the applications package.json file.  |
| appVersion | string | null | The application version is added to each log entry. If not supplied the library will obtain it from the applications package.json file.  |
| clientHeaderName | string | 'User-Agent' | The name of the http request header that provides the client name. The client is system specific, it could be the name of the calling application, the host name or something else that is meaningful for the project. |
| requestIdName | string | 'id' | The request id is automatically generated by uuid if it is not supplied by the upstream caller. The id is added to each request object using the supplied name. |
| requestIdHeaderName | string | 'X-Request-Id' | The request id is passed as the specified http header  |
| sessionIdHeaderName | string | 'X-Session-Id' | The session id is passed as the specified http header   |
| enableTracePropogation | boolean | false | If set to true then the logger will check if the caller has passed an request id header as part of their request and if found the logger will use that as the request id. Otherwise, a random id will be generated. There is a security risk in enabling this option, so it should not be used for customer facing web servers. |
| enableOpenTracing | boolean | <process.env> | If set to true then the logger will initialise a Jaeger client object and add span create to each http request handled. The default values is set to true if either of the following environment variables are defined; JAEGER_AGENT_HOST or JAEGER_ENDPOINT. See the [Jaeger client](https://www.npmjs.com/package/jaeger-client) documentation for details. |
| enableDebugLoggingLibrary | boolean | false | Many components use the debug logging library.  Enabling this option redirects the debug output into pino. |
| logRequestHeaders | boolean | false | If set to true then the headers in the http request are included in the log, otherwise they are excluded. It is most useful to enable this for external facing web services.  |
| logResponseHeaders | boolean | false | If set to true then the headers in the http response are included in the log, otherwise they are excluded. It is rare that these need to be logged.  |
| redactionPaths | Array | ['req.headers.cookie', 'req.headers.host'] | To redact sensitive information, supply paths to keys that hold sensitive data using the pino redact option. |
| excludeRequestPaths | Array | [] | List of regular expressions used to filter out matching requests based on the url. This is a useful way of making logs more managable by removing public css, js and image files requests. e.g. *excludeRequestPaths: ['^/public/'],* Filtered out requests are still logged, but their log level is set to trace, thus enabling them to be seen in a debugging environment. |
| pino | Object | undefined | Only some of the pino options are supported by the above options. To configure additional options and/or completely overide the default pino options then the object passed in the pino property will be used in preference to other options. |
| basicLogging | boolean | false | Changes the formatting from native pino to basic format, as discussed in the next section. |

## 6. Configure output

All of the properties of the json object output can be configured to match that of other applications, by specifying
each key property to a new name.

There are two sets of property names, standard (dwp node standard) and java (names used by most java modules.)

| Property key  | Standard output property  |  Java output property | Description |
|-|-|-|-|
| levelKey | level | level | Log level; trace, debug, info, warn, error, fatal  |
| pidKey | pid | pid | The id of the process running the application. This can be useful to match entries in other OS-level system logs |
| hostnameKey | hostname | hostname | Host name, or some other unique identifier to identify the host machine |
| messageKey | message | message | The log message, including stack trace if relevant (newlines escaped). For HTTP requests this is in the NCSA Common log format |
| timestampKey | time | @timestamp | Timestamp in ISO 8601:2004 format, including milliseconds and UTC offset suffix (e.g. `2018-11-12T09:05:29.326Z`). This human-readable format is commonly used in many standard log formats; we're favouring familiarity over performance in this iteration of our own convention |
| loggerNameKey | app.name | logger_name | Name of the application |
| loggerVersionKey | app.version | logger_version | Version of the application |
| httpMethodKey | req.method | method | Request http method |
| httpUriKey | req.url | requested_uri | Request http url |
| nameSpaceKey | nameSpace | ns | The name space: http. Useful to filter just the http access logs |
| httpProtocolKey | req.protocol | protocol | Request protocol |
| httpReqHeadersKey | req.headers | request_headers | Request http headers |
| httpRespHeadersKey | res.headers | response_headers | Response http headers |
| httpStatusCodeKey | res.statusCode | status_code | http response status code |
| httpResponseTimeKey | res.responseTime | elapsed_time | The time take to respond to the request |
| traceRequestIdKey | trace.request_id | request_id |  Request identifier. This will usually be provided as a `X-Request-Id` header to your application by the upstream proxy, but you should build your service in such a way that this can be configured to use whatever header name is appropriate (for example, in AWS this might be `X-Amzn-Trace-Id`, which is provided out of the box) |
| traceClientKey | useragent | client | The name of the client application, default to package name and version. |
| traceSessionIdKey | trace.session_id | session_id |

### Example standard output

~~~js
{
  level: 'info',
  time: '2020-02-03T15:43:26.866Z',
  pid: 19,
  hostname: '7ffbef29bc79',
  app: { name: 'smi-core-ui', version: '6.13.0-SNAPSHOT' },
  trace: { request_id: '61cee78d-1474-46b5-8f52-f1a735471979' },
  useragent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) Chrome/77.0.3865.90 Safari/537.36',
  nameSpace: 'http',
  req: {
    method: 'GET',
    url: '/find',
    protocol: 'http',
    headers: {
      'upgrade-insecure-requests': '1',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-user': '?1',
      'sec-fetch-site': 'same-origin',
      referer: 'http://localhost:9100/find',
    },
  },
  res: { statusCode: 200, responseTime: 205.376 },
  message: 'GET /find http/1.1 200',
  v: 1,
}
~~~

### Example java / logstash output

~~~js
{
  level: 'info',
  '@timestamp': '2020-02-03T15:38:27.122Z',
  pid: 18,
  hostname: 'e1c41751f525',
  logger_name: 'smi-core-ui',
  logger_version: '6.13.0-SNAPSHOT',
  request_id: '5f31ec27-39cb-4c2c-b900-dc29b1c81535',
  client: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) Chrome/77.0.3865.90 Safari/537.36',
  ns: 'http',
  method: 'GET',
  requested_uri: '/find',
  protocol: 'http',
  request_headers: {
    'upgrade-insecure-requests': '1',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-user': '?1',
    'sec-fetch-site': 'same-origin',
    referer: 'http://localhost:9100/find',
  },
  status_code: 200,
  elapsed_time: 170.588,
  message: 'GET /find http/1.1 200',
  v: 1,
}
~~~


## 7. Open Tracing / Jaeger

The module supports two different tracing modes; Open tracing and simple tracing.

[Open Tracing](https://opentracing.io) is a vendor-neutral API and instrumentation for distributed tracing. 
Currently this module only supports the [Jaeger](https://www.jaegertracing.io) implementation, but could be extended in future to include other implementations without changing the client interface. 

This feature is activated if the JAEGER_AGENT_HOST or JAEGER_ENDPOINT environment variables are defined. Activating 
Jaeger disables the simple tracing functionality.

This module automatically creates spans as part of the request logging middleware. 

Apart from enabling request chaining, described below, you do not have to write any additional code for the standard Jaeger functionality to work.

### Additional features

For additional advanced open tracing features you can access the span in your code using the req.span property.

For example add additional logging to a span.

~~~js
  req.span.log({ event: 'additional tracing message' });
~~~

If a page request consists of multiple internal operations then you can create addition child spans the show
how the work of a large request operation is broken down.

This following example shows how a new child span can be inserted into the span hierarchy for a given operation.

The only reason it is needed in this case is that the function makes a number of api calls in parallel. The new
span times them as one operation. If only one API was made then there would be no point in creating a span as the
api will log a span for this call as well.

~~~js
const getWeeklyInterestForLoans = (req, res, next) => {
  let operationSpan; // the span for this operation
  let openTracing; // the headers to pass to the back end api

  // tracing is optional 
  if (req.log.traceLogger) {
    // create a new child span of the parent span 
    operationSpan = req.log.traceLogger.createSpan('getWeeklyInterestForLoans', {
      headers: req.openTracing,
    });
    // get the headers of the new span, so it will be the parent of the
    // spans created by the back end api
    openTracing = req.log.traceLogger.getChildHttpHeaders(operationSpan);
  } else {
    // use the parent requests settings if tracing is disabled
    openTracing = req.openTracing;
  }

  const reqOptions = {
    method: 'GET',
    url: `${config.apiUrl}/loan/${loanId}/weeklyInterest`,
    headers: {
      ...openTracing, // insest the header of our span for the back end api
      tokenpayload: base64EncodedToken,
    },
    json: true,
  };

  // Kick off a number of api requests in parallel
  return Promise.all(res.locals.loans.map((loan) => requestPromise.request(reqOptions)))
    .then((weeklyInterests) => {
      if (req.log.traceLogger) {
        // All the api calls have completed ok, so complete the operation span
        req.log.traceLogger.endSpan(operationSpan);
      }
      // the operation code
      res.locals.weeklyInterests = weeklyInterests.reduce((map, weeklyInterest) => {
        if (weeklyInterest) {
          map[weeklyInterest.loanId] = weeklyInterest;
        }
        return map;
      }, {});
      return next();
    }).catch((err) => {
      if (req.log.traceLogger) {
        // Log the error to the span. This will give us what we need to diagnose the issue.
        operationSpan.log({ event: `Error: ${err}` });
        // complete the span and mark it as error, so it gets a red ! in Jaeger
        req.log.traceLogger.endSpan(operationSpan, { error: true });
      }
      next(err);
    });
};
~~~


## 8. Simple tracing 
Simple tracing is used to give each request a unique id with the ability to propogate that id to other services.
The request ids are only stored in the logs making cross referencing requests a manual process. 

It is worth bearing in mind that it is possible to switch between simple and open tracing just by configuration, with no coding changes nessasary. So you can always implement an open tracing service later on in a project's 
life cycle with minimal effort.

## 9. Enabling Request chaining/tracing

The request trace context provides an opportunity to correlate logs across many different applications in a distributed system. 
In order for this to work, any calls that your applications makes to external services must pass these trace 
identifiers in the request headers to the back end service. 

The implementation is identical for both modes, so it is easy to switch between open tracing and simple tracing.

~~~js
    method: 'POST',
    url: '/create',
    headers: {
      ...req.openTracing,
      tokenpayload: res.locals.authenticatedUserToken,
    },
~~~

To make it easy for you to do log chaining this component adds the openTracing property to the current request object.  

openTracing is an object, simply merge it into your outgoing headers and the trace will be propogated to the client.

In open tracing mode the openTracing will contain the following header:

| Header | Description |
|-|-|
| `uber-trace-id` | Uber are the creators of Jaeger.  |


In simple tracing mode the openTracing contains the following two headers:

| Header | Description |
|-|-|
| `X-Request-Id` | The id of the request. Taken from the clients request if provided, else a new unique id is created. This is provided in the request's 'id' property.   |


## 10. Upgrading from other loggers

This component uses pino to provide json based logging. It is a great library, but it is not fully compatible with other log libraries. This is because pino is designed to handle json objects and output as json.  Certain log statements that work in other libraries will not output as expected in pino. 

For example, this is a common way of logging errors in Winston.

~~~js
.catch((err) => {
  logger.error('Error: ', err);
});
~~~

However in pino it will render as below and lose the error details:


~~~
"Error: {}"
~~~


To make it safe to upgrade from other libraries set the basicLogging to true.

~~~js
  const logger = dwpNodeLogger('web', {
    basicLogging: true,
  });
~~~

This will disable the printf style message formatting pino provides and ensure that all the parameter details are logged.



## 11. Application Logging best practice

The standard implemented by the library:

  * Use JSON for all logging
  * Logs must occupy a single line (max length must coincide with your log transport mechanism - syslog, rsyslog, etc)
  * Pipe logs direct to `stdout` / `stderr` so it can be captured in the host environment's preferred way
  * Use correlation IDs for both user sessions, and individual requests


### Common format and destination

Following the [12-factor app principle on logging](https://12factor.net/logs), logs must be sent to `stdout` 
so that the host OS can consume and forward them as required by the environment. 
This is also an opportunity to use separate processes to reformat/embelish logs before forwarding to the log store, 
thus keeping the application process(es) free and efficient.

Regardless of the application's tech stack, its logs should adhere to a common format 
so that the consuming log stores see logs as a homogenous source of log data, and thus format and query it 
in a consistent manner. 

The JSON string must be captured on a single line, so all newlines escaped with `\n`.

You may add other attributes as necessary for your particular application.

To avoid impacting application performance, try not to format data too heavily whilst generating logs; 
instead rely on separate log formatters (running in a separate process through which log output is piped) to do this formatting.

Bear in mind that the target log store may impose limits on the length of each log. 
For example, the older BSD syslog format ([RFC3164](https://tools.ietf.org/html/rfc3164)) has a line length limit of 1024 bytes.


### Handling sensitive information

Every effort must be made to ensure no sensitive information 
(e.g. [Personal Identifiable Information](https://en.wikipedia.org/wiki/Personal_data#NIST_definition)) makes its way into the application logs.

### NodeJS

The reformatting of log messages into a format suitable for the consuming log store is therefore the responsibility of the hosting environment.

Note that in the case of NodeJS, when writing to stdout (`process.stdout.write()`), 
the calls are synchronous unless the application's process is attached to a `stdout` pipe. 

In order to avoid bottlenecks caused by log writing, all NodeJS applications output must be piped to an appropriate log capturing utility. 
For example:

~~~bash
# This will asynchronously route all output (stdout, stderr) to file.log
node app.js 2>&1 | tee file.log

# This will send everything to a pino transport that converts messages into a
# syslog format (https://github.com/pinojs/pino-syslog)
node app.js 2>&1 | pino-syslog
~~~


### Java

Use [Logstash Logback Encoder](https://github.com/logstash/logstash-logback-encoder) for all java application logging needs.

The component produces output that matches the default Logstash Logback Encoder output as close as possible, 


### Using log levels appropriately

| Log level | Usage | Environments in which this is enabled |
|-----------|-------|---------------------------------------|
| `trace`, `debug` | Information interesting for Developers, when trying to debug a problem | DEV |
| `info` | Information interesting for Support staff trying to figure out the context of a given error | DEV, PROD |
| `warn`, `error`, `fatal` | Problems and Errors depending on level of damage | DEV, PROD |


## 12. Changes from previous version

This version uses has switched from pino v5 to v6, which has the following functionality change.

Since pino v6, we do not automatically concatenate and cast to string
consecutive parameters:

```js
logger.info('hello', 'world')
// {"level":30,"time":1531257618044,"msg":"hello","pid":55956,"hostname":"x"}
// world is missing
```

However, it's possible to inject a hook to modify this behavior:

```js
const pinoOptions = {
  hooks: { logMethod }
}

function logMethod (args, method) {
  if (args.length === 2) {
    args[0] = `${args[0]} %j`
  }
  method.apply(this, args)
}

const logger = pino(pinoOptions)
```

* See [`message` log method parameter](#message)
* See [`logMethod` hook](#logmethod)


