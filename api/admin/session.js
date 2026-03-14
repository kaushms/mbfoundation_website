const { getSession } = require("../../lib/admin-auth");
const { sendJson } = require("../../lib/http");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const session = getSession(req);
  return sendJson(res, 200, {
    authenticated: Boolean(session),
    username: session ? session.username : null
  });
};
