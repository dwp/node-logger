class SimulatedLoggerStream {
  constructor() {
    this.logs = [];
  }

  clear() {
    this.logs = [];
  }

  write(value) {
    this.logs.push(value);
    // console.log(value); // eslint-disable-line
  }

  info(msg) {
    this.write(`INFO: ${msg}`);
  }

  error(msg) {
    this.write(`ERROR: ${msg}`);
  }
}

module.exports = SimulatedLoggerStream;
