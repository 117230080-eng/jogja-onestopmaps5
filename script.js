const CSV_SOURCE = "data/Data_WebGIS.csv";

const navbar = document.getElementById("navbar");
const navToggle = document.getElementById("navToggle");
const navMenu = document.getElementById("navMenu");
const navLinks = document.querySelectorAll(".nav-link");
const revealElements = [...document.querySelectorAll(".reveal")];
const sections = document.querySelectorAll("main section[id], footer[id]");

const destinationGrid = document.getElementById("destinationGrid");
const destinationEmpty = document.getElementById("destinationEmpty");
const destinationCount = document.getElementById("destinationCount");
const destinationSearch = document.getElementById("destinationSearch");
const categoryFilter = document.getElementById("categoryFilter");
const regionFilter = document.getElementById("regionFilter");
const resetFilter = document.getElementById("resetFilter");
const destinationModal = document.getElementById("destinationModal");
const modalContent = document.getElementById("modalContent");
const modalCard = destinationModal?.querySelector(".destination-modal-card");
const copyToast = document.getElementById("copyToast");

const totalDestinations = document.getElementById("totalDestinations");
const dominantCategory = document.getElementById("dominantCategory");
const topRegion = document.getElementById("topRegion");
const averageRating = document.getElementById("averageRating");

let destinations = [];
let revealObserver = null;
let lastFocusedElement = null;
let copyToastTimeout = null;

const setNavbarState = () => {
  navbar.classList.toggle("scrolled", window.scrollY > 40);
};

const closeMobileMenu = () => {
  navMenu.classList.remove("is-open");
  navToggle.classList.remove("is-open");
  navbar.classList.remove("menu-active");
  document.body.classList.remove("menu-open");
  navToggle.setAttribute("aria-expanded", "false");
};

navToggle.addEventListener("click", () => {
  const isOpen = navMenu.classList.toggle("is-open");

  navToggle.classList.toggle("is-open", isOpen);
  navbar.classList.toggle("menu-active", isOpen);
  document.body.classList.toggle("menu-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");
    const targetElement = document.querySelector(targetId);

    if (!targetElement) {
      return;
    }

    event.preventDefault();
    closeMobileMenu();

    const top = targetElement.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: "smooth" });
  });
});

document.addEventListener("click", (event) => {
  const clickInsideNav = navbar.contains(event.target);

  if (!clickInsideNav && navMenu.classList.contains("is-open")) {
    closeMobileMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && navMenu.classList.contains("is-open")) {
    closeMobileMenu();
  }

  if (event.key === "Escape" && destinationModal && !destinationModal.hidden) {
    closeDestinationModal();
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 980) {
    closeMobileMenu();
  }
});

window.addEventListener("scroll", setNavbarState, { passive: true });
setNavbarState();

const observeReveal = (element, delay = 0) => {
  element.style.transitionDelay = `${delay}ms`;

  if (!revealObserver) {
    element.classList.add("visible");
    return;
  }

  revealObserver.observe(element);
};

if ("IntersectionObserver" in window) {
  revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -70px 0px",
    }
  );

  revealElements.forEach((element, index) => {
    observeReveal(element, Math.min(index % 4, 3) * 45);
  });
} else {
  revealElements.forEach((element) => element.classList.add("visible"));
}

if ("IntersectionObserver" in window) {
  const activeSectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const activeId = entry.target.getAttribute("id");
        const hasMatchingLink = [...navLinks].some((link) => link.getAttribute("href") === `#${activeId}`);

        if (!hasMatchingLink) {
          return;
        }

        navLinks.forEach((link) => {
          const linkTarget = link.getAttribute("href").replace("#", "");
          link.classList.toggle("active", linkTarget === activeId);
        });
      });
    },
    {
      threshold: 0.35,
      rootMargin: "-35% 0px -55% 0px",
    }
  );

  sections.forEach((section) => activeSectionObserver.observe(section));
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const parseRating = (value) => {
  const normalized = String(value ?? "").replace(",", ".").replace(/[^\d.]/g, "");
  const rating = Number.parseFloat(normalized);
  return Number.isFinite(rating) ? rating : 0;
};

const formatRating = (value) =>
  Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

const parseDelimitedCSV = (text, delimiter = ";") => {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" && !insideQuotes) {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  const cleanRows = rows.filter((item) => item.some((cellValue) => cellValue !== ""));
  const headers = cleanRows.shift() ?? [];

  return cleanRows.map((item) =>
    headers.reduce((data, header, index) => {
      data[header] = item[index] ?? "";
      return data;
    }, {})
  );
};

const normalizeDestination = (row, index) => {
  const name = String(row["Nama Wisata"] ?? "").trim();
  const district = String(row.Kabupaten ?? "").trim();
  const category = String(row.Kategori ?? "").trim();
  const price = String(row.HTM ?? "").trim();
  const ratingLabel = String(row["Rating Gmaps"] ?? "").trim();
  const description = String(row["Deskripsi Singkat"] ?? "").trim();
  const image = String(row.Gambar ?? "").trim();
  const latitude = String(row.Lat ?? "").trim();
  const longitude = String(row.Long ?? "").trim();

  return {
    id: String(index),
    name: name || "Destinasi Tanpa Nama",
    district: district || "-",
    category: category || "Lainnya",
    price: price || "Tidak tersedia",
    longitude,
    latitude,
    rating: parseRating(ratingLabel),
    ratingLabel: ratingLabel || "0",
    description: description || "Deskripsi destinasi belum tersedia.",
    image,
  };
};

const countBy = (items, key) =>
  items.reduce((counts, item) => {
    const value = item[key] || "-";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});

const getDominantValue = (items, key) => {
  const counts = countBy(items, key);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted[0]?.[0] ?? "-";
};

const getCategoryVisual = (category) => {
  const normalized = normalizeText(category);
  const visuals = {
    pantai: { icon: "fa-umbrella-beach", className: "category-beach" },
    beach: { icon: "fa-umbrella-beach", className: "category-beach" },
    gunung: { icon: "fa-mountain", className: "category-mountain" },
    mountain: { icon: "fa-mountain", className: "category-mountain" },
    hutan: { icon: "fa-tree", className: "category-forest" },
    forest: { icon: "fa-tree", className: "category-forest" },
    goa: { icon: "fa-archway", className: "category-cave" },
    cave: { icon: "fa-archway", className: "category-cave" },
    "air terjun": { icon: "fa-droplet", className: "category-waterfall" },
    waterfall: { icon: "fa-droplet", className: "category-waterfall" },
    bukit: { icon: "fa-mountain-sun", className: "category-hill" },
    hill: { icon: "fa-mountain-sun", className: "category-hill" },
    sungai: { icon: "fa-water", className: "category-water" },
    waduk: { icon: "fa-water", className: "category-water" },
    air: { icon: "fa-water", className: "category-water" },
    perkebunan: { icon: "fa-seedling", className: "category-plantation" },
    geologi: { icon: "fa-mountain", className: "category-geology" },
    lainnya: { icon: "fa-location-dot", className: "category-default" },
  };

  return visuals[normalized] ?? { icon: "fa-location-dot", className: "category-default" };
};

const fillSelectOptions = (selectElement, values, defaultLabel) => {
  if (!selectElement) {
    return;
  }

  selectElement.innerHTML = `<option value="all">${defaultLabel}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
};

const updateFilters = () => {
  const categories = [...new Set(destinations.map((item) => item.category))].sort();
  const regions = [...new Set(destinations.map((item) => item.district))].sort();

  fillSelectOptions(categoryFilter, categories, "Semua kategori");
  fillSelectOptions(regionFilter, regions, "Semua wilayah");
};

const updateInsights = () => {
  const total = destinations.length;
  const ratingValues = destinations.map((item) => item.rating).filter((value) => value > 0);
  const average = ratingValues.length
    ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
    : 0;

  totalDestinations.textContent = total;
  dominantCategory.textContent = getDominantValue(destinations, "category");
  topRegion.textContent = getDominantValue(destinations, "district");
  averageRating.textContent = ratingValues.length ? formatRating(average) : "-";
};

const getFilteredDestinations = () => {
  const searchTerm = normalizeText(destinationSearch?.value);
  const selectedCategory = categoryFilter?.value ?? "all";
  const selectedRegion = regionFilter?.value ?? "all";

  return destinations.filter((item) => {
    const matchesSearch = normalizeText(item.name).includes(searchTerm);
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesRegion = selectedRegion === "all" || item.district === selectedRegion;

    return matchesSearch && matchesCategory && matchesRegion;
  });
};

const renderDestinationCard = (destination) => {
  const hasImage = Boolean(destination.image);
  const categoryVisual = getCategoryVisual(destination.category);
  const imageClass = hasImage ? `card-media ${categoryVisual.className}` : `card-media image-missing ${categoryVisual.className}`;
  const imageMarkup = hasImage
    ? `<img src="${escapeHtml(destination.image)}" alt="${escapeHtml(destination.name)}" loading="lazy" decoding="async">`
    : "";

  return `
    <article class="destination-card reveal">
      <div class="${imageClass}">
        <div class="image-placeholder">
          <i class="fa-solid ${categoryVisual.icon}" aria-hidden="true"></i>
          <span>${escapeHtml(destination.name)}</span>
          <small>Gambar belum tersedia</small>
        </div>
        ${imageMarkup}
      </div>
      <div class="card-body">
        <div class="card-topline">
          <span class="category-chip">${escapeHtml(destination.category)}</span>
          <span class="rating"><i class="fa-solid fa-star" aria-hidden="true"></i> ${escapeHtml(destination.ratingLabel)}</span>
        </div>
        <h3>${escapeHtml(destination.name)}</h3>
        <p class="card-meta"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(destination.district)}</p>
        <div class="card-detail-row">
          <span class="detail-pill"><i class="fa-solid fa-ticket" aria-hidden="true"></i> ${escapeHtml(destination.price)}</span>
        </div>
        <p class="card-description">${escapeHtml(destination.description)}</p>
        <div class="card-actions">
          <button class="card-action" type="button" data-destination-id="${escapeHtml(destination.id)}" aria-label="Lihat detail ${escapeHtml(destination.name)}">
            Lihat Detail
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
          <a class="card-action card-action-secondary" href="map.html?id=${encodeURIComponent(destination.id)}" aria-label="Tampilkan ${escapeHtml(destination.name)} di peta">
            Lihat di Peta
            <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </article>
  `;
};

const bindImageFallback = (scope = document) => {
  scope.querySelectorAll(".card-media img, .modal-media img, .intro-visual img").forEach((image) => {
    image.addEventListener("load", () => {
      const wrapper = image.closest(".card-media, .modal-media");

      if (wrapper) {
        wrapper.classList.add("image-loaded");
      }
    });

    image.addEventListener("error", () => {
      const wrapper = image.closest(".card-media, .modal-media, .intro-visual");

      if (!wrapper) {
        return;
      }

      if (wrapper.classList.contains("card-media")) {
        wrapper.classList.add("image-missing");
      } else if (wrapper.classList.contains("modal-media")) {
        wrapper.classList.add("modal-image-missing");
      } else {
        wrapper.classList.add("image-fallback");
      }
    });

    if (image.complete && image.naturalWidth === 0) {
      const wrapper = image.closest(".card-media, .modal-media, .intro-visual");

      if (wrapper) {
        if (wrapper.classList.contains("card-media")) {
          wrapper.classList.add("image-missing");
        } else if (wrapper.classList.contains("modal-media")) {
          wrapper.classList.add("modal-image-missing");
        } else {
          wrapper.classList.add("image-fallback");
        }
      }
    } else if (image.complete && image.naturalWidth > 0) {
      const wrapper = image.closest(".card-media, .modal-media");

      if (wrapper) {
        wrapper.classList.add("image-loaded");
      }
    }
  });
};

const buildGoogleMapsUrl = (destination) => {
  const name = String(destination.name ?? "").trim();
  const district = String(destination.district ?? "").trim();
  const hasCoordinates = Boolean(destination.latitude && destination.longitude);

  if (name) {
    const queryParts = [name];

    if (district) {
      queryParts.push(district);
    }

    queryParts.push("Daerah Istimewa Yogyakarta");

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryParts.join(", "))}`;
  }

  if (hasCoordinates) {
    return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}`;
  }

  return "#";
};

const renderModalDetail = (destination) => {
  const hasImage = Boolean(destination.image);
  const categoryVisual = getCategoryVisual(destination.category);
  const mediaClass = hasImage ? `modal-media ${categoryVisual.className}` : `modal-media modal-image-missing ${categoryVisual.className}`;
  const imageMarkup = hasImage
    ? `<img src="${escapeHtml(destination.image)}" alt="${escapeHtml(destination.name)}" loading="lazy" decoding="async">`
    : "";
  const hasCoordinates = Boolean(destination.latitude && destination.longitude);
  const coordinates = `${destination.latitude || "-"}, ${destination.longitude || "-"}`;
  const googleMapsUrl = buildGoogleMapsUrl(destination);
  const mapsButton = googleMapsUrl !== "#"
    ? `<a class="modal-action open-maps" href="${escapeHtml(googleMapsUrl)}" target="_blank" rel="noopener noreferrer">
        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
        Buka Google Maps
      </a>`
    : `<button class="modal-action open-maps is-disabled" type="button" disabled>
        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
        Buka Google Maps
      </button>`;

  return `
    <div class="${mediaClass}">
        <div class="image-placeholder">
          <i class="fa-solid ${categoryVisual.icon}" aria-hidden="true"></i>
          <span>${escapeHtml(destination.name)}</span>
          <small>Gambar belum tersedia</small>
        </div>
      ${imageMarkup}
    </div>
    <div class="modal-body">
      <div class="modal-title-block">
        <p class="modal-eyebrow">${escapeHtml(destination.category)} / ${escapeHtml(destination.district)}</p>
        <h2 id="modalTitle">${escapeHtml(destination.name)}</h2>
      </div>

      <div class="modal-chip-grid">
        <div class="modal-chip">
          <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
          <div>
            <span>Kabupaten</span>
            <strong>${escapeHtml(destination.district)}</strong>
          </div>
        </div>
        <div class="modal-chip">
          <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
          <div>
            <span>Kategori</span>
            <strong>${escapeHtml(destination.category)}</strong>
          </div>
        </div>
        <div class="modal-chip">
          <i class="fa-solid fa-ticket" aria-hidden="true"></i>
          <div>
            <span>HTM</span>
            <strong>${escapeHtml(destination.price)}</strong>
          </div>
        </div>
        <div class="modal-chip">
          <i class="fa-solid fa-star" aria-hidden="true"></i>
          <div>
            <span>Rating Gmaps</span>
            <strong>${escapeHtml(destination.ratingLabel)}</strong>
          </div>
        </div>
      </div>

      <div class="modal-section">
        <h3>Deskripsi Singkat</h3>
        <p class="modal-description">${escapeHtml(destination.description)}</p>
      </div>

      <div class="modal-section">
        <h3>Koordinat Lokasi</h3>
        <div class="coordinate-grid">
          <div class="coordinate-card">
            <span>Latitude</span>
            <strong>${escapeHtml(destination.latitude || "-")}</strong>
          </div>
          <div class="coordinate-card">
            <span>Longitude</span>
            <strong>${escapeHtml(destination.longitude || "-")}</strong>
          </div>
        </div>
        <div class="coordinate-inline">
          <span>Format salin</span>
          <strong>${escapeHtml(coordinates)}</strong>
        </div>
      </div>

      <div class="modal-actions">
        <button class="modal-action copy-coordinates" type="button" data-lat="${escapeHtml(destination.latitude)}" data-long="${escapeHtml(destination.longitude)}">
          <i class="fa-solid fa-copy" aria-hidden="true"></i>
          Salin Koordinat
        </button>
        ${mapsButton}
      </div>
    </div>
  `;
};

const openDestinationModal = (destinationId) => {
  const destination = destinations.find((item) => item.id === destinationId);

  if (!destination || !destinationModal || !modalContent || !modalCard) {
    return;
  }

  lastFocusedElement = document.activeElement;
  modalContent.innerHTML = renderModalDetail(destination);
  destinationModal.hidden = false;
  document.body.classList.add("modal-open");
  bindImageFallback(modalContent);
  modalCard.focus();
};

const closeDestinationModal = () => {
  if (!destinationModal) {
    return;
  }

  destinationModal.hidden = true;
  document.body.classList.remove("modal-open");
  modalContent.innerHTML = "";

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
};

const showCopyToast = (message = "Koordinat berhasil disalin") => {
  if (!copyToast) {
    return;
  }

  copyToast.textContent = message;
  copyToast.classList.add("show");
  window.clearTimeout(copyToastTimeout);
  copyToastTimeout = window.setTimeout(() => {
    copyToast.classList.remove("show");
  }, 1800);
};

const fallbackCopyText = (text) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

const copyCoordinates = async (latitude, longitude) => {
  const coordinates = `${latitude || "-"}, ${longitude || "-"}`;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(coordinates);
    } else {
      fallbackCopyText(coordinates);
    }

    showCopyToast("Koordinat berhasil disalin");
  } catch (error) {
    console.error(error);
    showCopyToast("Koordinat gagal disalin");
  }
};

const renderDestinations = () => {
  if (!destinationGrid) {
    return;
  }

  const filteredDestinations = getFilteredDestinations();
  destinationGrid.classList.add("is-updating");
  destinationGrid.innerHTML = filteredDestinations.map(renderDestinationCard).join("");

  destinationCount.textContent = `${filteredDestinations.length} dari ${destinations.length} destinasi tampil`;
  destinationEmpty.textContent = "Tidak ada destinasi yang sesuai. Coba ubah kata kunci atau filter.";
  destinationEmpty.hidden = filteredDestinations.length > 0;

  bindImageFallback(destinationGrid);

  destinationGrid.querySelectorAll(".destination-card").forEach((card, index) => {
    observeReveal(card, Math.min(index % 3, 2) * 50);
  });

  window.requestAnimationFrame(() => {
    destinationGrid.classList.remove("is-updating");
  });
};

const showDestinationError = () => {
  destinationGrid.innerHTML = "";
  destinationCount.textContent = "Data destinasi belum dapat dimuat.";
  destinationEmpty.hidden = false;
  destinationEmpty.textContent = "Data destinasi belum dapat dimuat. Coba buka melalui Live Server atau GitHub Pages.";
};

const loadDestinationsFromCSV = async () => {
  try {
    const response = await fetch(CSV_SOURCE);

    if (!response.ok) {
      throw new Error(`CSV request failed with status ${response.status}`);
    }

    const csvText = await response.text();
    destinations = parseDelimitedCSV(csvText, ";").map(normalizeDestination);

    updateFilters();
    updateInsights();
    renderDestinations();
  } catch (error) {
    console.error(error);
    showDestinationError();
  }
};

[destinationSearch, categoryFilter, regionFilter].forEach((control) => {
  control?.addEventListener("input", renderDestinations);
  control?.addEventListener("change", renderDestinations);
});

resetFilter?.addEventListener("click", () => {
  if (destinationSearch) {
    destinationSearch.value = "";
  }

  if (categoryFilter) {
    categoryFilter.value = "all";
  }

  if (regionFilter) {
    regionFilter.value = "all";
  }

  renderDestinations();
});

destinationGrid?.addEventListener("click", (event) => {
  const detailButton = event.target.closest(".card-action");

  if (!detailButton) {
    return;
  }

  openDestinationModal(detailButton.dataset.destinationId);
});

destinationModal?.addEventListener("click", (event) => {
  if (event.target.closest("[data-modal-close]")) {
    closeDestinationModal();
  }
});

modalContent?.addEventListener("click", (event) => {
  const copyButton = event.target.closest(".copy-coordinates");

  if (!copyButton) {
    return;
  }

  copyCoordinates(copyButton.dataset.lat, copyButton.dataset.long);
});

bindImageFallback();
loadDestinationsFromCSV();
