let adminContentCache = null;

async function main() {
  const page = document.body.dataset.page;
  const content = await loadContent();

  applyContentImages(content.images || {});

  if (page === "home") {
    renderHistory(content.history || []);
    setupCarousels(content.carousel || []);
  }

  if (page === "about") {
    renderAbout(content.about || {});
    setupCarousels(content.carousel || []);
  }

  if (page === "events") {
    renderEvents(content.events || []);
    setupCarousels(content.carousel || []);
  }

  if (page === "admin") {
    await setupAdmin();
  }

  if (page === "admin-login") {
    await setupAdminLogin();
  }
}

async function loadContent() {
  const response = await fetch("/api/content");
  if (!response.ok) {
    throw new Error("Unable to load site content.");
  }

  return response.json();
}

function renderHistory(history) {
  const timeline = document.getElementById("historyTimeline");
  if (!timeline) return;

  timeline.innerHTML = history
    .map(
      (item) => `
        <article class="timeline-card">
          <strong>${escapeHtml(item.year)}</strong>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
        </article>
      `
    )
    .join("");
}

function setupCarousels(items) {
  if (!items.length) return;

  const roots = Array.from(document.querySelectorAll("[data-carousel-root]"));
  roots.forEach((carousel, carouselIndex) => {
    const section = carousel.closest(".gallery-section, .carousel-panel, .content-card, main, section") || document;
    const title = section.querySelector("[data-carousel-title]");
    const caption = section.querySelector("[data-carousel-caption]");
    const dots = section.querySelector("[data-carousel-dots]");
    const prevButton = section.querySelector("[data-carousel-prev]");
    const nextButton = section.querySelector("[data-carousel-next]");
    if (!title || !caption) return;

    let index = carouselIndex % items.length;

    carousel.innerHTML = items
      .map(
        (item, itemIndex) => `
          <article class="carousel-slide ${itemIndex === index ? "active" : ""}">
            <img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.alt || item.title)}" />
          </article>
        `
      )
      .join("");

    if (dots) {
      dots.innerHTML = items
        .map(
          (item, itemIndex) => `
            <button
              class="carousel-dot ${itemIndex === index ? "active" : ""}"
              type="button"
              aria-label="Show ${escapeAttribute(item.title)}"
              data-index="${itemIndex}"
            ></button>
          `
        )
        .join("");
    }

    const slides = Array.from(carousel.querySelectorAll(".carousel-slide"));
    const dotButtons = Array.from(section.querySelectorAll(".carousel-dot"));

    const update = () => {
      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle("active", slideIndex === index);
      });

      dotButtons.forEach((button, buttonIndex) => {
        button.classList.toggle("active", buttonIndex === index);
      });

      title.textContent = items[index].title;
      caption.textContent = items[index].caption;
    };

    const goTo = (nextIndex) => {
      index = (nextIndex + items.length) % items.length;
      update();
    };

    const next = () => goTo(index + 1);
    const prev = () => goTo(index - 1);

    nextButton?.addEventListener("click", next);
    prevButton?.addEventListener("click", prev);

    dotButtons.forEach((button) => {
      button.addEventListener("click", () => goTo(Number(button.dataset.index)));
    });

    let autoAdvance = setInterval(next, 5200);
    carousel.addEventListener("pointerenter", () => clearInterval(autoAdvance));
    carousel.addEventListener("pointerleave", () => {
      autoAdvance = setInterval(next, 5200);
    });

    update();
  });
}

function renderAbout(about) {
  const mission = document.getElementById("missionText");
  const vision = document.getElementById("visionText");
  const valuesGrid = document.getElementById("valuesGrid");
  if (!mission || !vision || !valuesGrid) return;

  mission.textContent = about.mission || "";
  vision.textContent = about.vision || "";
  valuesGrid.innerHTML = (about.values || [])
    .map(
      (value) => `
        <article class="value-card">
          <p>${escapeHtml(value)}</p>
        </article>
      `
    )
    .join("");
}

function renderEvents(events) {
  const grid = document.getElementById("eventsGrid");
  if (!grid) return;

  grid.innerHTML = events
    .map(
      (event) => `
        <article class="event-card">
          <p class="eyebrow">Upcoming</p>
          <h2>${escapeHtml(event.name)}</h2>
          <div class="event-meta">
            <span>${escapeHtml(event.date)}</span>
            <span>${escapeHtml(event.location)}</span>
          </div>
          <p>${escapeHtml(event.description)}</p>
        </article>
      `
    )
    .join("");
}

function applyContentImages(images) {
  document.querySelectorAll("[data-image-slot]").forEach((element) => {
    const slot = element.dataset.imageSlot;
    const image = images[slot];
    if (!image) return;

    if (image.image) {
      element.src = image.image;
    }

    if (image.alt) {
      element.alt = image.alt;
    }
  });
}

async function setupAdminLogin() {
  const session = await fetchJson("/api/admin/session");
  if (session.authenticated) {
    window.location.href = "/admin.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const status = document.getElementById("loginStatus");
  if (!form || !status) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "Signing in...";

    try {
      await fetchJson("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.elements.namedItem("username").value.trim(),
          password: form.elements.namedItem("password").value
        })
      });

      window.location.href = "/admin.html";
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

async function setupAdmin() {
  const sessionInfo = document.getElementById("sessionInfo");
  const logoutButton = document.getElementById("logoutButton");

  const session = await fetchJson("/api/admin/session");
  if (!session.authenticated) {
    window.location.href = "/admin-login.html";
    return;
  }

  if (sessionInfo) {
    sessionInfo.textContent = `Signed in as ${session.username}.`;
  }

  await refreshAdminContent();

  logoutButton?.addEventListener("click", async () => {
    await fetchJson("/api/admin/logout", { method: "POST" });
    adminContentCache = null;
    window.location.href = "/admin-login.html";
  });

  setupAdminImageUpload();
  setupEventForm();
  setupPageImageForms();
}

function setupAdminImageUpload() {
  const form = document.getElementById("uploadForm");
  const status = document.getElementById("uploadStatus");
  if (!form || !status) return;

  const captionInput = form.elements.namedItem("caption");
  const imageInput = form.elements.namedItem("images");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const files = Array.from(imageInput.files || []);
    if (!files.length) {
      status.textContent = "Choose one or more images before uploading.";
      return;
    }

    status.textContent = `Uploading ${files.length} image${files.length === 1 ? "" : "s"}...`;

    try {
      await fetchJson("/api/admin/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: await Promise.all(
            files.map(async (file) => ({
              title: humanizeFilename(file.name),
              caption: captionInput.value.trim() || `${humanizeFilename(file.name)} at Sandeep Special School.`,
              filename: file.name,
              dataUrl: await fileToDataUrl(file)
            }))
          )
        })
      });

      status.textContent = "Images uploaded.";
      form.reset();
      await refreshAdminContent();
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

function setupPageImageForms() {
  document.querySelectorAll(".page-image-form").forEach((form) => {
    const status = form.querySelector("[data-slot-status]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const slot = form.dataset.slot;
      const image = form.elements.namedItem("image").files[0];
      const alt = form.elements.namedItem("alt").value.trim();

      if (!image) {
        if (status) status.textContent = "Choose an image before uploading.";
        return;
      }

      if (status) status.textContent = "Updating image...";

      try {
        await fetchJson("/api/admin/site-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slot,
            filename: image.name,
            alt,
            dataUrl: await fileToDataUrl(image)
          })
        });

        form.reset();
        if (status) status.textContent = "Page image updated.";
        await refreshAdminContent();
      } catch (error) {
        if (status) status.textContent = error.message;
      }
    });
  });
}

function setupEventForm() {
  const form = document.getElementById("eventForm");
  const status = document.getElementById("eventStatus");
  if (!form || !status) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "Publishing event...";

    try {
      await fetchJson("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.elements.namedItem("name").value.trim(),
          date: form.elements.namedItem("date").value.trim(),
          location: form.elements.namedItem("location").value.trim(),
          description: form.elements.namedItem("description").value.trim()
        })
      });

      form.reset();
      status.textContent = "Event published.";
      await refreshAdminContent();
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

async function refreshAdminContent() {
  adminContentCache = await fetchJson("/api/admin/content");
  renderPageImages(adminContentCache.images || {});
  renderAdminCarousel(adminContentCache.carousel || []);
  renderAdminEvents(adminContentCache.events || []);
}

function renderPageImages(images) {
  const container = document.getElementById("pageImagesList");
  if (!container) return;

  const slots = [
    { key: "homeHero", label: "Home hero image" },
    { key: "founderPortrait", label: "Founder portrait" }
  ];

  container.innerHTML = slots
    .map((slot) => {
      const item = images[slot.key];
      if (!item) return "";
      return `
        <article class="admin-item-card">
          <img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.alt || slot.label)}" />
          <div class="admin-item-copy">
            <h3>${escapeHtml(slot.label)}</h3>
            <p>${escapeHtml(item.alt || "")}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAdminCarousel(items) {
  const container = document.getElementById("adminCarouselList");
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `<p class="body-text empty-state">No carousel images uploaded yet.</p>`;
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="admin-item-card">
          <img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.alt || item.title)}" />
          <div class="admin-item-copy">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.caption)}</p>
          </div>
          <button class="button admin-delete-button" type="button" data-delete-image="${escapeAttribute(item.id)}">
            Remove
          </button>
        </article>
      `
    )
    .join("");

  container.querySelectorAll("[data-delete-image]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await fetchJson(`/api/admin/carousel?id=${encodeURIComponent(button.dataset.deleteImage)}`, {
          method: "DELETE"
        });
        await refreshAdminContent();
      } catch (error) {
        button.disabled = false;
        alert(error.message);
      }
    });
  });
}

function renderAdminEvents(items) {
  const container = document.getElementById("adminEventsList");
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `<p class="body-text empty-state">No events published yet.</p>`;
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="admin-item-card admin-item-card-text">
          <div class="admin-item-copy">
            <h3>${escapeHtml(item.name)}</h3>
            <p><strong>${escapeHtml(item.date)}</strong> · ${escapeHtml(item.location)}</p>
            <p>${escapeHtml(item.description)}</p>
          </div>
          <button class="button admin-delete-button" type="button" data-delete-event="${escapeAttribute(item.id)}">
            Remove
          </button>
        </article>
      `
    )
    .join("");

  container.querySelectorAll("[data-delete-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await fetchJson(`/api/admin/events?id=${encodeURIComponent(button.dataset.deleteEvent)}`, {
          method: "DELETE"
        });
        await refreshAdminContent();
      } catch (error) {
        button.disabled = false;
        alert(error.message);
      }
    });
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

function humanizeFilename(filename) {
  return String(filename || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

main().catch((error) => {
  console.error(error);
});
