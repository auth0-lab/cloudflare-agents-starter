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

  chain(bottleneck) {
    return this;
  }

  on(event, handler) {
    return this;
  }

  once(event, handler) {
    return this;
  }

  removeAllListeners(event) {
    return this;
  }
}

Bottleneck.prototype.Group = class Group {
  constructor(options) {
    this.options = options || {};
  }

  key(str) {
    return new Bottleneck(this.options);
  }

  deleteKey(str) {
    return Promise.resolve();
  }

  updateSettings(options) {
    Object.assign(this.options, options);
  }
};

export default Bottleneck;
