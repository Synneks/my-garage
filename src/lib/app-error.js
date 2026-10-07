// Domain errors carry stable codes; only the frontend renders their messages.
export class AppError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "AppError";
  }
}
