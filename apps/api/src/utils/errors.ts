import type { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: T, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorMiddleware(
  error: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const status = error.status ?? 500;
  res.status(status).json({
    error: {
      message: status >= 500 ? "Internal server error" : error.message,
      detail: status >= 500 ? undefined : error.message
    }
  });
}
