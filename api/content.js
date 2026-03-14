const { loadContent, sanitizePublicContent } = require("../lib/site-store");
const { loadCloudinaryContent } = require("../lib/cloudinary-lists");
const { sendJson } = require("../lib/http");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const content = await loadContent();
    const publicContent = sanitizePublicContent(content);
    const cloudinaryContent = await loadCloudinaryContent();

    if (cloudinaryContent) {
      if (cloudinaryContent.images.homeHero) {
        publicContent.images.homeHero = cloudinaryContent.images.homeHero;
      }
      if (cloudinaryContent.images.founderPortrait) {
        publicContent.images.founderPortrait = cloudinaryContent.images.founderPortrait;
      }

      publicContent.galleries = {
        home: cloudinaryContent.galleries.home?.length ? cloudinaryContent.galleries.home : publicContent.carousel,
        about: cloudinaryContent.galleries.about?.length ? cloudinaryContent.galleries.about : publicContent.carousel,
        events: cloudinaryContent.galleries.events?.length ? cloudinaryContent.galleries.events : publicContent.carousel
      };
    } else {
      publicContent.galleries = {
        home: publicContent.carousel,
        about: publicContent.carousel,
        events: publicContent.carousel
      };
    }

    return sendJson(res, 200, publicContent);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message });
  }
};
