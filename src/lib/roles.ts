/**
 * Pure role logic. No server bindings, so it can be used in tests and,
 * if ever needed, to hide controls in the browser — though hiding a control
 * is presentation, never authorisation.
 */
export type AppRole = 'owner' | 'admin' | 'staff' | 'kitchen' | 'courier' | 'viewer';

/** Mirrors app_role_rank() in 0001_core.sql. Keep the two in step. */
export const ROLE_RANK: Record<AppRole, number> = {
  owner: 100,
  admin: 80,
  staff: 60,
  courier: 40,
  kitchen: 40,
  viewer: 20,
};

export function canAct(role: AppRole, min: AppRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
