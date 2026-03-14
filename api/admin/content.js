const { requireAdmin } = require("../../lib/admin-auth");
const { sendJson } = require("../../lib/http");
const { loadContent } = require("../../lib/site-store");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    requireAdmin(req);
    const content = await loadContent();
    return sendJson(res, 200, content);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
