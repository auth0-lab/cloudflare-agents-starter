// Stub for bottleneck/light.js in Cloudflare Workers test environment

export class Bottleneck {
  constructor(options) {
    this.options = options || {};
  }

  schedule(fn, ...args) {
    // Just execute immediately without throttling in tests
    return Promise.resolve(fn(...args));
  }

  wrap(fn) {
    // Return a wrapped function that just calls the original
    return (...args) => this.schedule(fn, ...args);
  }

  stop() {
    return Promise.resolve();
  }

  chain(_bottleneck) {
    return this;
  }

  on(_event, _handler) {
    return this;
  }

  once(_event, _handler) {
    return this;
  }

  removeAllListeners(_event) {
    return this;
  }
}

Bottleneck.prototype.Group = class Group {
  constructor(options) {
    this.options = options || {};
  }

  key(_str) {
    return new Bottleneck(this.options);
  }

  deleteKey(_str) {
    return Promise.resolve();
  }

  updateSettings(options) {
    Object.assign(this.options, options);
  }
};

export default Bottleneck;
