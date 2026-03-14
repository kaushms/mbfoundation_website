const { authenticateCredentials, createSessionCookie } = require("../../lib/admin-auth");
const { readJsonBody, sendJson } = require("../../lib/http");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!authenticateCredentials(username, password)) {
      return sendJson(res, 401, { error: "Invalid credentials." });
    }

    return sendJson(
      res,
      200,
      { message: "Signed in successfully." },
      { "Set-Cookie": createSessionCookie(username) }
    );
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
