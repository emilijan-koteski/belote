// API response types — keep in sync with server models

export interface ApiResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface User {
  id: number;
  username: string;
  email: string;
  languagePreference: string;
  createdAt: string;
}
