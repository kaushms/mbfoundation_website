const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONTENT_FILE = path.join(ROOT, "data", "content.json");

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

async function loadContent() {
  return ensureContentShape(loadLocalContent());
}

async function saveContent(content) {
  const normalized = ensureContentShape(content);
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(normalized, null, 2));
  return normalized;
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

function ensureContentShape(content) {
  const normalized = content && typeof content === "object" ? { ...content } : {};
  normalized.history = Array.isArray(normalized.history) ? normalized.history : [];
  normalized.about = normalized.about && typeof normalized.about === "object" ? normalized.about : {};
  normalized.events = Array.isArray(normalized.events) ? normalized.events : [];
  normalized.carousel = Array.isArray(normalized.carousel) ? normalized.carousel : [];
  normalized.images = normalized.images && typeof normalized.images === "object" ? normalized.images : {};

  for (const [slot, image] of Object.entries(DEFAULT_IMAGES)) {
    if (!normalized.images[slot]) {
      normalized.images[slot] = image;
    }
  }

  normalized.events = normalized.events.map((event) => ({
    ...event,
    id: event.id || createId("event")
  }));

  normalized.carousel = normalized.carousel.map((item) => ({
    ...item,
    id: item.id || createId("image")
  }));

  return normalized;
}

function loadLocalContent() {
  if (!fs.existsSync(CONTENT_FILE)) {
    return { history: [], about: {}, events: [], carousel: [], images: { ...DEFAULT_IMAGES } };
  }

  return JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"));
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 14)}`;
}

module.exports = {
  DEFAULT_IMAGES,
  loadContent,
  saveContent,
  sanitizePublicContent
};
