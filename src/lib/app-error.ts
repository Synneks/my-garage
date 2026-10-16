// Domain errors carry stable codes; only the frontend renders their messages.
export class AppError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "AppError";
  }
}
