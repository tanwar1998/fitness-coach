import { randomUUID } from "node:crypto";

const COOKIE_NAME = "fc_device_id";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 730; // 2 years
const VALUE_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export interface DeviceIdentity {
  deviceId: string;
  setCookie?: string;
}

function readCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name === COOKIE_NAME && VALUE_PATTERN.test(value)) {
      return value;
    }
  }
  return null;
}

export function resolveDeviceId(request: Request): DeviceIdentity {
  const existing = readCookie(request);
  if (existing) {
    return { deviceId: existing };
  }
  const deviceId = randomUUID();
  return {
    deviceId,
    setCookie: `${COOKIE_NAME}=${deviceId}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax`,
  };
}

export function deviceCookieHeaders(identity: DeviceIdentity): Record<string, string> {
  return identity.setCookie ? { "Set-Cookie": identity.setCookie } : {};
}
