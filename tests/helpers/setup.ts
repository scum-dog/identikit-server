process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";

jest.setTimeout(10 * 1000);

const originalConsoleLog = console.log;
console.log = jest.fn();

afterAll(() => {
  console.log = originalConsoleLog;
});
