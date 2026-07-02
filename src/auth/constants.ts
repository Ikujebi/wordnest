// src/auth/constants.ts

export const AUTH_CONSTANTS = {
  JWT_ACCESS_TOKEN: 'access_token',
  JWT_REFRESH_TOKEN: 'refresh_token',

  ACCESS_TOKEN_EXPIRATION: '15m',
  REFRESH_TOKEN_EXPIRATION: '7d',

  BCRYPT_SALT_ROUNDS: 12,

  PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES: 30,

  EMAIL_VERIFICATION_TOKEN_EXPIRATION_HOURS: 24,
} as const;

export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_DISABLED: 'Your account has been disabled.',
  ACCOUNT_NOT_FOUND: 'User account not found.',
  EMAIL_ALREADY_EXISTS: 'A user with this email already exists.',
  LOGIN_SUCCESS: 'Login successful.',
  LOGOUT_SUCCESS: 'Logout successful.',
  REGISTER_SUCCESS: 'Registration successful.',
  PASSWORD_RESET_EMAIL_SENT:
    'If an account exists, a password reset email has been sent.',
  PASSWORD_RESET_SUCCESS: 'Password reset successfully.',
} as const;