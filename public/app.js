let adminContentCache = null;

async function main() {
  const page = document.body.dataset.page;
  const content = await loadContent();

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

async function setupAdmin() {
  const authPanel = document.getElementById("authPanel");
  const dashboardPanel = document.getElementById("dashboardPanel");
  const loginForm = document.getElementById("loginForm");
  const loginStatus = document.getElementById("loginStatus");
  const sessionInfo = document.getElementById("sessionInfo");
  const logoutButton = document.getElementById("logoutButton");

  const session = await fetchJson("/api/admin/session");
  setAdminVisibility(Boolean(session.authenticated));

  if (session.authenticated && sessionInfo) {
    sessionInfo.textContent = `Signed in as ${session.username}.`;
    await refreshAdminContent();
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginStatus.textContent = "Signing in...";

    const username = loginForm.elements.namedItem("username").value.trim();
    const password = loginForm.elements.namedItem("password").value;

    try {
      await fetchJson("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      loginForm.reset();
      loginStatus.textContent = "";
      if (sessionInfo) sessionInfo.textContent = `Signed in as ${username}.`;
      setAdminVisibility(true);
      await refreshAdminContent();
    } catch (error) {
      loginStatus.textContent = error.message;
    }
  });

  logoutButton?.addEventListener("click", async () => {
    await fetchJson("/api/admin/logout", { method: "POST" });
    adminContentCache = null;
    setAdminVisibility(false);
    if (loginStatus) {
      loginStatus.textContent = "Signed out.";
    }
  });

  setupAdminImageUpload();
  setupEventForm();

  function setAdminVisibility(isVisible) {
    authPanel?.classList.toggle("hidden", isVisible);
    dashboardPanel?.classList.toggle("hidden", !isVisible);
  }
}

function setupAdminImageUpload() {
  const form = document.getElementById("uploadForm");
  const status = document.getElementById("uploadStatus");
  const previewImage = document.getElementById("previewImage");
  const previewTitle = document.getElementById("previewTitle");
  const previewCaption = document.getElementById("previewCaption");
  if (!form || !status || !previewImage || !previewTitle || !previewCaption) return;

  const titleInput = form.elements.namedItem("title");
  const captionInput = form.elements.namedItem("caption");
  const imageInput = form.elements.namedItem("image");

  const syncPreviewText = () => {
    previewTitle.textContent = titleInput.value || "Your image preview will appear here.";
    previewCaption.textContent =
      captionInput.value || "Add a title, caption, and image to prepare the upload.";
  };

  titleInput.addEventListener("input", syncPreviewText);
  captionInput.addEventListener("input", syncPreviewText);
  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;
    previewImage.src = await fileToDataUrl(file);
    syncPreviewText();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = imageInput.files[0];
    if (!file) {
      status.textContent = "Choose an image before uploading.";
      return;
    }

    status.textContent = "Uploading image...";

    try {
      await fetchJson("/api/admin/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleInput.value.trim(),
          caption: captionInput.value.trim(),
          filename: file.name,
          dataUrl: await fileToDataUrl(file)
        })
      });

      status.textContent = "Image uploaded.";
      form.reset();
      previewImage.removeAttribute("src");
      syncPreviewText();
      await refreshAdminContent();
    } catch (error) {
      status.textContent = error.message;
    }
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
  renderAdminCarousel(adminContentCache.carousel || []);
  renderAdminEvents(adminContentCache.events || []);
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
