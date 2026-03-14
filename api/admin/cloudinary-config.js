const { requireAdmin } = require("../../lib/admin-auth");
const { sendJson } = require("../../lib/http");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
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
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
