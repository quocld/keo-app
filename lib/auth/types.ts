export type AppRole = 'admin' | 'owner' | 'driver';

export type AuthUser = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: AppRole;
};

export type LoginResponse = {
  token: string;
  refreshToken: string;
  tokenExpires: number;
  user: MeResponse;
};

export type RefreshResponse = {
  token: string;
  refreshToken: string;
  tokenExpires: number;
};

/** Raw API user shape from GET /auth/me or login */
export type MeResponse = {
  id: number;
  email: string;
  provider?: string;
  socialId?: string | null;
  firstName: string | null;
  lastName: string | null;
  role: { id: number; name: string };
  status?: { id: number; name: string };
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export function mapApiRoleToAppRole(name: string): AppRole {
  const n = name.toLowerCase();
  if (n === 'admin') return 'admin';
  if (n === 'owner') return 'owner';
  if (n === 'driver' || n === 'user') return 'driver';
  return 'driver';
}

export function meToAuthUser(me: MeResponse): AuthUser {
  return {
    id: me.id,
    email: me.email,
    firstName: me.firstName,
    lastName: me.lastName,
    role: mapApiRoleToAppRole(me.role?.name ?? 'driver'),
  };
}
