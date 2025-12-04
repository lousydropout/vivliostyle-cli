export type ErrorType =
  | 'INVALID_INPUT'
  | 'PDF_RENDER_FAILED'
  | 'EPUB_RENDER_FAILED'
  | 'INTERNAL_ERROR';

export interface ApiError {
  error: {
    message: string;
    type: ErrorType;
    details?: Record<string, unknown>;
  };
}

export class RenderError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RenderError';
  }

  toJSON(): ApiError {
    return {
      error: {
        message: this.message,
        type: this.type,
        details: this.details,
      },
    };
  }
}
