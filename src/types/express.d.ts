export interface AuthUser {
  userId: string;
  email?: string;
  sessionToken?: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
