export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'unauthorized', message);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, 'forbidden', message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, 'not_found', message);
  }

  static badRequest(message = 'Invalid request') {
    return new ApiError(400, 'bad_request', message);
  }
}
