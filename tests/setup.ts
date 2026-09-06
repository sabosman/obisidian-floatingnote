// Model Obsidian's active window while allowing Jest to replace the timers.
Object.defineProperty(globalThis, "activeWindow", {
  configurable: true,
  value: {
    setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
  },
});
