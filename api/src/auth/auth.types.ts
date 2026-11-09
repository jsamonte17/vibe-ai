export interface AuthUser {
  id: string;
  empid: string;
  username: string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface AuthPayload {
  accessToken: string;
  user: AuthUser;
}

export interface AuthTokenPayload {
  sub: string;
  username: string;
  empid: string;
  iat: number;
  exp: number;
}
