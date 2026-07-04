/**
 * User Module Configuration Limits
 */
export const USER_LIMITS = {
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 100, // Safe upper limit for bcrypt/argon2 hashing performance
  },
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
  },
  PHONE: {
    MIN_LENGTH: 7,
    MAX_LENGTH: 20,
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
  },
} as const; // 'as const' ensures deep immutability and precise literal types

/**
 * System-wide User Event Names (for EventEmitter2 or Microservices)
 */
export const USER_EVENTS = {
  CREATED: 'user.created',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
  PASSWORD_CHANGED: 'user.password.changed',
  EMAIL_VERIFIED: 'user.email.verified',
  LOCKED: 'user.account.locked',
} as const;

/**
 * Standardized API Exception & Validation Error Messages
 */
export const USER_ERROR_MESSAGES = {
  NOT_FOUND: 'User account could not be found.',
  EMAIL_ALREADY_EXISTS: 'A user account with this email address already exists.',
  PHONE_ALREADY_EXISTS: 'This phone number is already linked to an account.',
  INVALID_CREDENTIALS: 'The email address or password provided is incorrect.',
  ACCOUNT_LOCKED: 'This account has been temporarily locked due to too many failed login attempts.',
  ACCOUNT_INACTIVE: 'Your account has been deactivated. Please contact support.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in.',
  INVALID_TOKEN: 'The provided verification or reset token is invalid or has expired.',
  UNAUTHORIZED_ROLE: 'You do not have the required permissions to perform this action.',
} as const;

/**
 * Security and Auth Window Thresholds (in milliseconds or numbers)
 */
export const USER_SECURITY_CONFIG = {
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  EMAIL_TOKEN_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_TOKEN_EXPIRY_MS: 1 * 60 * 60 * 1000, // 1 hour
} as const;