import { Request, Response } from "express";

export const createMockRequest = (
  overrides: Partial<Request> = {},
): Partial<Request> => {
  return {
    headers: {},
    body: {},
    query: {},
    params: {},
    user: undefined,
    ...overrides,
  };
};

export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    headersSent: false,
  };
  return res;
};

export const waitForAsync = (ms = 10): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const mockNext = jest.fn();

export const resetMocks = (): void => {
  jest.clearAllMocks();
  mockNext.mockClear();
};
