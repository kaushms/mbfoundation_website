const { requireAdmin } = require("../../lib/admin-auth");
const { readJsonBody, sendJson, withStatus } = require("../../lib/http");
const { loadContent, saveContent } = require("../../lib/site-store");

module.exports = async (req, res) => {
  try {
    requireAdmin(req);

    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const date = String(body.date || "").trim();
      const location = String(body.location || "").trim();
      const description = String(body.description || "").trim();

      if (!name || !date || !location || !description) {
        throw withStatus("Name, date, location, and description are required.", 400);
      }

      const event = {
        id: `event-${Math.random().toString(16).slice(2, 14)}`,
        name,
        date,
        location,
        description
      };

      const content = await loadContent();
      content.events.unshift(event);
      await saveContent(content);
      return sendJson(res, 201, { message: "Event published.", event });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || new URL(req.url, "http://localhost").searchParams.get("id");
      if (!id) {
        throw withStatus("Event id is required.", 400);
      }

      const content = await loadContent();
      const exists = content.events.some((entry) => entry.id === id);
      if (!exists) {
        throw withStatus("Event not found.", 404);
      }

      content.events = content.events.filter((entry) => entry.id !== id);
      await saveContent(content);
      return sendJson(res, 200, { message: "Event removed." });
    }

    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
