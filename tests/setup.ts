// Model the browser window while allowing Jest to replace the timers.
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
  },
});
