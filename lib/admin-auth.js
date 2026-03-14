const crypto = require("crypto");

const SESSION_COOKIE = "mb_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-now";
const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || `${ADMIN_USERNAME}:${ADMIN_PASSWORD}:mbfoundation`;

function authenticateCredentials(username, password) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

function createSessionCookie(username) {
  const payload = {
    username,
    exp: Date.now() + SESSION_TTL_MS
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return serializeCookie(SESSION_COOKIE, `${encodedPayload}.${signature}`, {
    httpOnly: true,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: "/",
    sameSite: "Lax",
    secure: true
  });
}

function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
    secure: true
  });
}

function getSession(req) {
  const token = getCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (sign(encodedPayload) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return { username: payload.username };
  } catch {
    return null;
  }
}

function requireAdmin(req) {
  const session = getSession(req);
  if (!session) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }

  return session;
}

function getCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((cookies, pair) => {
    const [rawName, ...rawValue] = pair.trim().split("=");
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function sign(value) {
  return crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(value).digest("base64url");
}

function base64url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

module.exports = {
  authenticateCredentials,
  clearSessionCookie,
  createSessionCookie,
  getSession,
  requireAdmin
};
