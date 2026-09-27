const configuredApiOrigin = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "");

export const API_ORIGIN = configuredApiOrigin || (import.meta.env.DEV ? "http://localhost:4000" : "");
export const API_BASE_URL = `${API_ORIGIN}/api`;
