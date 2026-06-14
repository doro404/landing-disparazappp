export const AUTH_COOKIE = "admin_auth";
export const AUTH_VALUE  = "authenticated";

export function isAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes(`${AUTH_COOKIE}=${AUTH_VALUE}`);
}

export function setAuth() {
  // 8h session
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${AUTH_COOKIE}=${AUTH_VALUE}; path=/; expires=${expires}; SameSite=Strict`;
}

export function clearAuth() {
  document.cookie = `${AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
