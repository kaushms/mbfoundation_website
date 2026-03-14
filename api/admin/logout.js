const { clearSessionCookie } = require("../../lib/admin-auth");
const { sendJson } = require("../../lib/http");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  return sendJson(res, 200, { message: "Signed out." }, { "Set-Cookie": clearSessionCookie() });
};
