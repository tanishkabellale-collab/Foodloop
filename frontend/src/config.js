/**
 * Centralized frontend runtime configuration.
 * Reads VITE_API_URL from environment with safe local dev fallback.
 */
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export const API_URL = rawApiUrl.replace(/\/+$/, '');
export const BACKEND_BASE_URL = API_URL.replace(/\/api$/, '');

export function resolveAssetUrl(assetPath) {
  if (!assetPath) return null;
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath;
  }
  const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `${BACKEND_BASE_URL}${normalized}`;
}
