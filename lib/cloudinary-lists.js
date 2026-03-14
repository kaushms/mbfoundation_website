async function loadCloudinaryContent() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    return null;
  }

  const [homeHero, founderPortrait, homeGallery, aboutGallery, eventsGallery] = await Promise.all([
    fetchTagResources(cloudName, "mbf-home-hero"),
    fetchTagResources(cloudName, "mbf-founder-portrait"),
    fetchTagResources(cloudName, "mbf-home-gallery"),
    fetchTagResources(cloudName, "mbf-about-gallery"),
    fetchTagResources(cloudName, "mbf-events-gallery")
  ]);

  return {
    images: {
      homeHero: mapSingle(homeHero, "Home hero image"),
      founderPortrait: mapSingle(founderPortrait, "Founder portrait")
    },
    galleries: {
      home: mapGallery(homeGallery),
      about: mapGallery(aboutGallery),
      events: mapGallery(eventsGallery)
    }
  };
}

async function fetchTagResources(cloudName, tag) {
  const url = `https://res.cloudinary.com/${cloudName}/image/list/${tag}.json`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return Array.isArray(data.resources) ? sortResources(data.resources) : [];
}

function mapSingle(resources, title) {
  const resource = resources[0];
  if (!resource) return null;
  return {
    title,
    image: toDeliveryUrl(resource),
    alt: resource.context?.custom?.alt || title
  };
}

function mapGallery(resources) {
  return resources.map((resource) => ({
    id: resource.asset_id || resource.public_id,
    title: resource.context?.custom?.title || humanizePublicId(resource.public_id),
    caption: resource.context?.custom?.caption || humanizePublicId(resource.public_id),
    image: toDeliveryUrl(resource),
    alt: resource.context?.custom?.alt || humanizePublicId(resource.public_id)
  }));
}

function toDeliveryUrl(resource) {
  if (resource.secure_url) {
    return resource.secure_url;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const version = resource.version ? `v${resource.version}/` : "";
  return `https://res.cloudinary.com/${cloudName}/image/upload/${version}${resource.public_id}.${resource.format}`;
}

function humanizePublicId(publicId) {
  return String(publicId || "")
    .split("/")
    .pop()
    .replace(/[-_]+/g, " ")
    .trim();
}

function sortResources(resources) {
  return [...resources].sort((left, right) => {
    const leftTime = Date.parse(left.created_at || 0) || Number(left.version) || 0;
    const rightTime = Date.parse(right.created_at || 0) || Number(right.version) || 0;
    return rightTime - leftTime;
  });
}

module.exports = {
  loadCloudinaryContent
};
