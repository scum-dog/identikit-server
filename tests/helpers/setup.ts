process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";

jest.setTimeout(10 * 1000);

const originalConsoleLog = console.log;
console.log = jest.fn();

afterAll(async () => {
  console.log = originalConsoleLog;

  try {
    const { cleanup: oauthCleanup } = await import(
      "../../src/utils/oauthPolling"
    );
    oauthCleanup();
  } catch (error) {}

  jest.clearAllTimers();
  jest.useRealTimers();

  if (global.gc) {
    global.gc();
  }

  await new Promise((resolve) => setImmediate(resolve));
});
