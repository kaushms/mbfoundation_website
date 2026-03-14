const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");
const SESSION_COOKIE = "mb_admin_session";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me-now";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const sessions = new Map();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

const DEFAULT_IMAGES = {
  homeHero: {
    title: "Sandeep School Hero",
    image: "https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1200&q=80",
    alt: "Children learning together at Sandeep Special School"
  },
  founderPortrait: {
    title: "Sadashiv Family Portrait",
    image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=900&q=80",
    alt: "Portrait representing the Sadashiv family"
  }
};

ensureStructure();
ensureContentShape();

if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  console.warn("Using default admin credentials. Set ADMIN_USERNAME and ADMIN_PASSWORD before hosting.");
}

const server = http.createServer(async (req, res) => {
  try {
    cleanupExpiredSessions();

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/content" && req.method === "GET") {
      return sendJson(res, 200, sanitizePublicContent(readContent()));
    }

    if (url.pathname === "/api/admin/session" && req.method === "GET") {
      const session = getSession(req);
      return sendJson(res, 200, {
        authenticated: Boolean(session),
        username: session ? session.username : null
      });
    }

    if (url.pathname === "/api/admin/login" && req.method === "POST") {
      const body = await readJsonBody(req);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");

      if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return sendJson(res, 401, { error: "Invalid credentials." });
      }

      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = Date.now() + SESSION_TTL_MS;
      sessions.set(token, { username, expiresAt });

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": serializeCookie(SESSION_COOKIE, token, {
          httpOnly: true,
          maxAge: Math.floor(SESSION_TTL_MS / 1000),
          path: "/",
          sameSite: "Lax"
        })
      });
      res.end(JSON.stringify({ message: "Signed in successfully." }));
      return;
    }

    if (url.pathname === "/api/admin/logout" && req.method === "POST") {
      const token = getCookies(req)[SESSION_COOKIE];
      if (token) {
        sessions.delete(token);
      }

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": serializeCookie(SESSION_COOKIE, "", {
          httpOnly: true,
          maxAge: 0,
          path: "/",
          sameSite: "Lax"
        })
      });
      res.end(JSON.stringify({ message: "Signed out." }));
      return;
    }

    if (url.pathname === "/api/admin/content" && req.method === "GET") {
      requireAdmin(req);
      return sendJson(res, 200, readContent());
    }

    if (url.pathname === "/api/admin/cloudinary-config" && req.method === "GET") {
      requireAdmin(req);
      return sendJson(res, 200, {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "",
        folder: process.env.CLOUDINARY_UPLOAD_FOLDER || "mbfoundation",
        dashboardUrl: "https://console.cloudinary.com/console/media_library/home",
        tags: {
          homeHero: "mbf-home-hero",
          founderPortrait: "mbf-founder-portrait",
          homeGallery: "mbf-home-gallery",
          aboutGallery: "mbf-about-gallery",
          eventsGallery: "mbf-events-gallery"
        }
      });
    }

    if (url.pathname === "/api/admin/events" && req.method === "POST") {
      requireAdmin(req);
      const body = await readJsonBody(req);
      const event = normalizeEvent(body);
      const content = readContent();
      content.events.unshift(event);
      writeContent(content);
      return sendJson(res, 201, { message: "Event published.", event });
    }

    if (url.pathname === "/api/admin/events" && req.method === "DELETE") {
      requireAdmin(req);
      const id = url.searchParams.get("id");
      if (!id) {
        throw withStatus("Event id is required.", 400);
      }

      const content = readContent();
      const exists = content.events.some((entry) => entry.id === id);
      if (!exists) {
        throw withStatus("Event not found.", 404);
      }

      content.events = content.events.filter((entry) => entry.id !== id);
      writeContent(content);
      return sendJson(res, 200, { message: "Event removed." });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    return serveStatic(req, res, url.pathname);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.message || "Internal server error."
    });
  }
});

server.listen(PORT, () => {
  console.log(`MB Foundation website running at http://localhost:${PORT}`);
});

function ensureStructure() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function ensureContentShape() {
  const content = readContent();
  let changed = false;

  content.history = Array.isArray(content.history) ? content.history : [];
  content.about = content.about && typeof content.about === "object" ? content.about : {};
  content.events = Array.isArray(content.events) ? content.events : [];
  content.carousel = Array.isArray(content.carousel) ? content.carousel : [];
  content.images = content.images && typeof content.images === "object" ? content.images : {};

  for (const [slot, value] of Object.entries(DEFAULT_IMAGES)) {
    if (!content.images[slot]) {
      changed = true;
      content.images[slot] = value;
    }
  }

  content.events = content.events.map((event) => {
    if (event.id) return event;
    changed = true;
    return { ...event, id: createId("event") };
  });

  content.carousel = content.carousel.map((item) => {
    if (item.id) return item;
    changed = true;
    return { ...item, id: createId("image") };
  });

  if (changed || !fs.existsSync(CONTENT_FILE)) {
    writeContent(content);
  }
}

function readContent() {
  if (!fs.existsSync(CONTENT_FILE)) {
    return {
      history: [],
      about: {},
      events: [],
      carousel: [],
      images: { ...DEFAULT_IMAGES }
    };
  }

  return JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));
}

function writeContent(content) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));
}

function sanitizePublicContent(content) {
  return {
    history: content.history || [],
    about: content.about || {},
    events: (content.events || []).map((event) => ({
      id: event.id,
      name: event.name,
      date: event.date,
      location: event.location,
      description: event.description
    })),
    images: content.images || { ...DEFAULT_IMAGES },
    carousel: (content.carousel || []).map((item) => ({
      id: item.id,
      title: item.title,
      caption: item.caption,
      image: item.image,
      alt: item.alt
    }))
  };
}

function serveStatic(req, res, pathname) {
  let safePath = pathname === "/" ? "/index.html" : pathname;
  safePath = safePath.endsWith("/") ? `${safePath}index.html` : safePath;

  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden." });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendJson(res, 404, { error: "Not found." });
  }

  const extension = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream" });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(filePath).pipe(res);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 12 * 1024 * 1024) {
        reject(withStatus("Request body too large.", 413));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(withStatus("Invalid JSON body.", 400));
      }
    });

    req.on("error", () => reject(withStatus("Unable to read request.", 400)));
  });
}

function normalizeEvent(body) {
  const name = String(body.name || "").trim();
  const date = String(body.date || "").trim();
  const location = String(body.location || "").trim();
  const description = String(body.description || "").trim();

  if (!name || !date || !location || !description) {
    throw withStatus("Name, date, location, and description are required.", 400);
  }

  return {
    id: createId("event"),
    name,
    date,
    location,
    description
  };
}

function requireAdmin(req) {
  const session = getSession(req);
  if (!session) {
    throw withStatus("Authentication required.", 401);
  }

  return session;
}

function getSession(req) {
  const token = getCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  }
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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function withStatus(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createId(prefix) {
  return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
}
