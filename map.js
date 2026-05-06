const CSV_SOURCE = "data/Data_WebGIS.csv";
const DEFAULT_CENTER = [-7.98, 110.61];
const DEFAULT_ZOOM = 10;

const mapSearch = document.getElementById("mapSearch");
const mapSearchMobile = document.getElementById("mapSearchMobile");
const mapRegionFilter = document.getElementById("mapRegionFilter");
const mapSortFilter = document.getElementById("mapSortFilter");
const mapCategoryOptions = document.getElementById("mapCategoryOptions");
const mapRatingFilter = document.getElementById("mapRatingFilter");
const mapRatingValue = document.getElementById("mapRatingValue");
const mapApplyButton = document.getElementById("mapApplyButton");
const mapResetButton = document.getElementById("mapResetButton");
const mapClearButton = document.getElementById("mapClearButton");
const mapResetViewButton = document.getElementById("mapResetViewButton");
const mapMarkerCount = document.getElementById("mapMarkerCount");
const mapDestinationList = document.getElementById("mapDestinationList");
const mapEmptyState = document.getElementById("mapEmptyState");
const mapLegendItems = [...document.querySelectorAll(".map-legend-item")];
const mapSidebarLeft = document.querySelector(".map-sidebar-left");
const mapDataTableBody = document.getElementById("mapDataTableBody");
const mapTableEmpty = document.getElementById("mapTableEmpty");
const mapSelectedCard = document.getElementById("mapSelectedCard");
const mapMobileCategoryChips = document.getElementById("mapMobileCategoryChips");
const mapMobileFilterToggle = document.getElementById("mapMobileFilterToggle");
const mapMobileResetButton = document.getElementById("mapMobileResetButton");
const mapMobileSheetClose = document.getElementById("mapMobileSheetClose");
const mapFilterBackdrop = document.getElementById("mapFilterBackdrop");
const mapDrawerToggle = document.getElementById("mapDrawerToggle");
const mapDrawerClose = document.getElementById("mapDrawerClose");
const mapDestinationDrawer = document.getElementById("mapDestinationDrawer");
const mapDrawerBackdrop = document.getElementById("mapDrawerBackdrop");
const mapCopyToast = document.getElementById("mapCopyToast");
const mobileCollapsiblePanels = [...document.querySelectorAll("[data-mobile-collapse]")];

const mapTotalDestinations = document.getElementById("mapTotalDestinations");
const mapAverageRating = document.getElementById("mapAverageRating");
const mapDominantCategory = document.getElementById("mapDominantCategory");
const mapDominantRegion = document.getElementById("mapDominantRegion");
const mapHighestRating = document.getElementById("mapHighestRating");
const mapTopRatedName = document.getElementById("mapTopRatedName");
const mapValidMarkers = document.getElementById("mapValidMarkers");
const mapCentroid = document.getElementById("mapCentroid");
const mapNearestToCenter = document.getElementById("mapNearestToCenter");
const mapAverageDistance = document.getElementById("mapAverageDistance");

let map = null;
let baseBounds = null;
let destinations = [];
let validDestinations = [];
let filteredDestinations = [];
let markersLayer = null;
let markerLookup = new Map();
let baseLayers = {};
let selectedDestinationId = null;
let toastTimer = null;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const CATEGORY_MARKER_STYLES = {
  pantai: { markerClass: "category-beach", iconClass: "fa-umbrella-beach" },
  gunung: { markerClass: "category-mountain", iconClass: "fa-mountain" },
  hutan: { markerClass: "category-forest", iconClass: "fa-tree" },
  "air terjun": { markerClass: "category-waterfall", iconClass: "fa-droplet" },
  goa: { markerClass: "category-cave", iconClass: "fa-archway" },
  bukit: { markerClass: "category-hill", iconClass: "fa-mountain-sun" },
  sungai: { markerClass: "category-water", iconClass: "fa-water" },
  waduk: { markerClass: "category-water", iconClass: "fa-water" },
  air: { markerClass: "category-water", iconClass: "fa-water" },
  perkebunan: { markerClass: "category-plantation", iconClass: "fa-seedling" },
  geologi: { markerClass: "category-geology", iconClass: "fa-mountain" },
  lainnya: { markerClass: "category-default", iconClass: "fa-location-dot" },
  default: { markerClass: "category-default", iconClass: "fa-location-dot" },
};

const FILTER_CATEGORIES = ["Pantai", "Gunung", "Hutan", "Goa", "Air Terjun", "Bukit", "Lainnya"];
const PRIMARY_FILTER_CATEGORY_MAP = {
  pantai: "Pantai",
  gunung: "Gunung",
  hutan: "Hutan",
  goa: "Goa",
  "air terjun": "Air Terjun",
  bukit: "Bukit",
};

const parseRating = (value) => {
  const normalized = String(value ?? "").replace(",", ".").replace(/[^\d.]/g, "");
  const rating = Number.parseFloat(normalized);
  return Number.isFinite(rating) ? rating : 0;
};

const parsePriceValue = (value) => {
  const raw = normalizeText(value);

  if (!raw || raw.includes("tidak tersedia")) {
    return null;
  }

  if (raw.includes("gratis") || raw.includes("free")) {
    return 0;
  }

  const digits = raw.replace(/[^\d]/g, "");
  const price = Number.parseInt(digits, 10);
  return Number.isFinite(price) ? price : null;
};

const formatRating = (value) =>
  Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

const formatCoordinate = (value) =>
  Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

const formatDistance = (value) =>
  `${Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`;

const parseCoordinate = (value) => {
  const coordinate = Number.parseFloat(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(coordinate) ? coordinate : null;
};

const getCategoryStyle = (category) => CATEGORY_MARKER_STYLES[normalizeText(category)] ?? CATEGORY_MARKER_STYLES.default;
const getPrimaryFilterCategory = (category) => PRIMARY_FILTER_CATEGORY_MAP[normalizeText(category)] ?? "Lainnya";
const getNormalizedPrimaryFilterCategory = (category) => normalizeText(getPrimaryFilterCategory(category));

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

const getCentroid = (items) => {
  if (!items.length) {
    return null;
  }

  const totals = items.reduce(
    (center, item) => ({
      latitude: center.latitude + item.latitude,
      longitude: center.longitude + item.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: totals.latitude / items.length,
    longitude: totals.longitude / items.length,
  };
};

const getDistanceKilometers = (origin, destination) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6371;
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const startLatitude = toRadians(origin.latitude);
  const endLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(haversine));
};

const isMobileMapViewport = () => window.matchMedia("(max-width: 768px)").matches;
let isMobileViewportMode = isMobileMapViewport();

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
  const latitude = parseCoordinate(row.Lat);
  const longitude = parseCoordinate(row.Long);
  const name = String(row["Nama Wisata"] ?? "").trim();
  const district = String(row.Kabupaten ?? "").trim();
  const category = String(row.Kategori ?? "").trim();
  const price = String(row.HTM ?? "").trim();
  const ratingLabel = String(row["Rating Gmaps"] ?? "").trim();
  const description = String(row["Deskripsi Singkat"] ?? "").trim();
  const image = String(row.Gambar ?? "").trim();
  const hasValidCoordinates =
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

  return {
    id: String(index),
    name: name || "Destinasi Tanpa Nama",
    district: district || "-",
    category: category || "Lainnya",
    price: price || "Tidak tersedia",
    priceValue: parsePriceValue(price),
    rating: parseRating(ratingLabel),
    ratingLabel: ratingLabel || "0",
    description: description || "Deskripsi destinasi belum tersedia.",
    image,
    latitude,
    longitude,
    hasValidCoordinates,
  };
};

const buildGoogleMapsUrl = (destination) => {
  const name = String(destination.name ?? "").trim();
  const district = String(destination.district ?? "").trim();
  const hasCoordinates =
    destination.latitude !== null &&
    destination.longitude !== null;

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

const syncCategoryOptionState = () => {
  if (!mapCategoryOptions) {
    return;
  }

  mapCategoryOptions.querySelectorAll(".map-category-option").forEach((option) => {
    const checkbox = option.querySelector("input[type='checkbox']");
      option.classList.toggle("is-checked", Boolean(checkbox?.checked));
    });
};

const getCategoryCheckboxes = () =>
  mapCategoryOptions
    ? [...mapCategoryOptions.querySelectorAll("input[type='checkbox']")]
    : [];

const syncMobileSearchValue = () => {
  if (!mapSearchMobile || !mapSearch) {
    return;
  }

  if (mapSearchMobile.value !== mapSearch.value) {
    mapSearchMobile.value = mapSearch.value;
  }
};

const renderMobileCategoryChips = () => {
  if (!mapMobileCategoryChips) {
    return;
  }

  const checkboxes = getCategoryCheckboxes();
  mapMobileCategoryChips.hidden = checkboxes.length === 0;
  mapMobileCategoryChips.innerHTML = checkboxes
    .map((checkbox) => {
      const label = checkbox.closest(".map-category-option")?.querySelector("span:last-child")?.textContent?.trim() ?? checkbox.value;

      return `
        <button
          class="map-mobile-chip${checkbox.checked ? " is-active" : ""}"
          type="button"
          data-category="${escapeHtml(checkbox.value)}"
          aria-pressed="${checkbox.checked ? "true" : "false"}"
        >
          ${escapeHtml(label)}
        </button>
      `;
    })
    .join("");
};

const ensureCategorySelection = () => {
  if (getCategoryCheckboxes().some((checkbox) => checkbox.checked)) {
    return;
  }

  setDefaultCategoryChecks();
};

const openMobileFilterSheet = () => {
  if (!isMobileMapViewport() || !mapSidebarLeft) {
    return;
  }

  closeDestinationDrawer();
  mapSidebarLeft.classList.add("is-open");
  document.body.classList.add("map-mobile-sheet-open");

  if (mapFilterBackdrop) {
    mapFilterBackdrop.hidden = false;
    requestAnimationFrame(() => mapFilterBackdrop.classList.add("is-visible"));
  }
};

const closeMobileFilterSheet = () => {
  if (!mapSidebarLeft) {
    return;
  }

  mapSidebarLeft.classList.remove("is-open");
  document.body.classList.remove("map-mobile-sheet-open");

  if (mapFilterBackdrop) {
    mapFilterBackdrop.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!mapSidebarLeft.classList.contains("is-open")) {
        mapFilterBackdrop.hidden = true;
      }
    }, 180);
  }
};

const toggleMobileFilterSheet = () => {
  if (!isMobileMapViewport()) {
    return;
  }

  if (mapSidebarLeft?.classList.contains("is-open")) {
    closeMobileFilterSheet();
    return;
  }

  openMobileFilterSheet();
};

const renderCategoryOptions = (availableCategories) => {
  if (!mapCategoryOptions) {
    return;
  }

  const categoryOptions = FILTER_CATEGORIES;

  mapCategoryOptions.innerHTML = categoryOptions.map((category) => {
    const isDefaultActive = FILTER_CATEGORIES.includes(category);

    return `
      <label class="map-category-option${isDefaultActive ? " is-checked" : ""}">
        <input type="checkbox" value="${escapeHtml(category)}"${isDefaultActive ? " checked" : ""}>
        <span class="map-category-check" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
        <span>${escapeHtml(category)}</span>
        </label>
      `;
    }).join("");

  renderMobileCategoryChips();
};

const getSelectedCategories = () =>
  mapCategoryOptions
    ? [...mapCategoryOptions.querySelectorAll("input[type='checkbox']:checked")].map((item) => normalizeText(item.value))
    : [];

const setDefaultCategoryChecks = () => {
  if (!mapCategoryOptions) {
    return;
  }

  mapCategoryOptions.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    checkbox.checked = true;
  });

  syncCategoryOptionState();
  renderMobileCategoryChips();
};

const updateRatingLabel = () => {
  if (!mapRatingValue || !mapRatingFilter) {
    return;
  }

  mapRatingValue.textContent = Number(mapRatingFilter.value || 0).toFixed(1);
};

const resetFilterControls = () => {
  if (mapSearch) {
    mapSearch.value = "";
  }

  if (mapRegionFilter) {
    mapRegionFilter.value = "all";
  }

  if (mapSortFilter) {
    mapSortFilter.value = "rating-desc";
  }

  if (mapRatingFilter) {
    mapRatingFilter.value = "0";
  }

  updateRatingLabel();
  setDefaultCategoryChecks();
  syncMobileSearchValue();
};

const sortDestinations = (items) => {
  const sortMode = mapSortFilter?.value ?? "rating-desc";
  const sortedItems = [...items];
  const compareName = (a, b) => a.name.localeCompare(b.name, "id-ID");
  const comparePrice = (a, b, direction) => {
    const hasPriceA = Number.isFinite(a.priceValue);
    const hasPriceB = Number.isFinite(b.priceValue);

    if (!hasPriceA && !hasPriceB) {
      return compareName(a, b);
    }

    if (!hasPriceA) {
      return 1;
    }

    if (!hasPriceB) {
      return -1;
    }

    return direction === "asc" ? a.priceValue - b.priceValue : b.priceValue - a.priceValue;
  };

  sortedItems.sort((a, b) => {
    switch (sortMode) {
      case "rating-asc":
        return a.rating - b.rating || compareName(a, b);
      case "name-asc":
        return compareName(a, b);
      case "name-desc":
        return compareName(b, a);
      case "price-asc":
        return comparePrice(a, b, "asc") || compareName(a, b);
      case "price-desc":
        return comparePrice(a, b, "desc") || compareName(a, b);
      case "rating-desc":
      default:
        return b.rating - a.rating || compareName(a, b);
    }
  });

  return sortedItems;
};

const createPopupContent = (destination) => {
  const googleMapsAction = isMobileMapViewport()
    ? ""
    : `
      <a class="map-popup-link" href="${escapeHtml(buildGoogleMapsUrl(destination))}" target="_blank" rel="noopener noreferrer" aria-label="Buka Google Maps untuk ${escapeHtml(destination.name)}">
        Buka Google Maps
      </a>
    `;

  return `
    <article class="map-popup">
      <h3>${escapeHtml(destination.name)}</h3>
      <div class="map-popup-meta">
        <span>${escapeHtml(destination.category)}</span>
        <span>${escapeHtml(destination.district)}</span>
      </div>
      <div class="map-popup-details">
        <span><i class="fa-solid fa-ticket" aria-hidden="true"></i> ${escapeHtml(destination.price)}</span>
        <span><i class="fa-solid fa-star" aria-hidden="true"></i> ${escapeHtml(destination.ratingLabel)}</span>
      </div>
      <p class="map-popup-description">${escapeHtml(destination.description)}</p>
      ${googleMapsAction}
    </article>
  `;
};

const createMarkerIcon = (destination, isActive = false) => {
  const categoryStyle = getCategoryStyle(destination.category);

  return L.divIcon({
    className: "tourism-category-marker-wrapper",
    html: `<span class="tourism-category-marker ${categoryStyle.markerClass}${isActive ? " is-active" : ""}"><i class="fa-solid ${categoryStyle.iconClass}" aria-hidden="true"></i></span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

const createBaseLayer = (url, options = {}) => {
  const layer = L.tileLayer(url, options);
  layer.on("tileerror", () => {
    console.warn(`Basemap tile failed to load: ${options.name ?? "Unknown layer"}`);
  });
  return layer;
};

const syncLegendState = () => {
  if (mapLegendItems.length === 0) {
    return;
  }

  const activeCategories = new Set(filteredDestinations.map((destination) => normalizeText(destination.category)));

  mapLegendItems.forEach((item) => {
    const category = normalizeText(item.dataset.category);
    const isActive = activeCategories.has(category);
    const status = item.querySelector("small");

    item.classList.toggle("is-active", isActive);
    item.classList.toggle("is-future", !isActive);

    if (status) {
      status.textContent = isActive ? "Aktif" : "Tersedia";
    }
  });
};

const buildSidebarItem = (destination) => `
  <button class="map-list-item${selectedDestinationId === destination.id ? " is-active" : ""}" type="button" data-destination-id="${escapeHtml(destination.id)}">
    <span class="map-list-category">${escapeHtml(destination.category)}</span>
    <strong>${escapeHtml(destination.name)}</strong>
    <span class="map-list-meta">
      <i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${escapeHtml(destination.district)}
      <span aria-hidden="true">•</span>
      <i class="fa-solid fa-star" aria-hidden="true"></i> ${escapeHtml(destination.ratingLabel)}
      <span aria-hidden="true">•</span>
      <i class="fa-solid fa-ticket" aria-hidden="true"></i> ${escapeHtml(destination.price)}
    </span>
  </button>
`;

const buildTableRow = (destination) => `
  <tr class="map-data-row${selectedDestinationId === destination.id ? " is-active" : ""}" data-destination-id="${escapeHtml(destination.id)}" tabindex="0">
    <td>${escapeHtml(destination.name)}</td>
    <td>${escapeHtml(destination.category)}</td>
    <td>${escapeHtml(destination.district)}</td>
    <td>${escapeHtml(destination.ratingLabel)}</td>
    <td>${escapeHtml(destination.price)}</td>
  </tr>
`;

const buildSelectedCardContent = (destination) => {
  return `
    <article class="map-selected-content">
      <div class="map-selected-head">
        <div class="map-selected-copy">
          <div class="map-detail-topline">
            <span class="map-list-category">${escapeHtml(destination.category)}</span>
            <span class="map-list-pill"><i class="fa-solid fa-star" aria-hidden="true"></i> ${escapeHtml(destination.ratingLabel)}</span>
          </div>
          <h3>${escapeHtml(destination.name)}</h3>
          <div class="map-detail-meta">
            <span class="map-detail-meta-item"><strong>Kabupaten</strong><em>${escapeHtml(destination.district)}</em></span>
            <span class="map-detail-meta-item"><strong>HTM</strong><em>${escapeHtml(destination.price)}</em></span>
          </div>
        </div>
        <button class="map-selected-dismiss" type="button" aria-label="Tutup detail destinasi" data-dismiss-selected>
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <div class="map-selected-actions">
        <a class="map-selected-link" href="${escapeHtml(buildGoogleMapsUrl(destination))}" target="_blank" rel="noopener noreferrer" aria-label="Buka Google Maps untuk ${escapeHtml(destination.name)}">
          <i class="fa-solid fa-route" aria-hidden="true"></i>
          Buka Google Maps
        </a>
      </div>
    </article>
  `;
};

const clearSelectedDestination = ({ closePopup = true } = {}) => {
  if (closePopup && selectedDestinationId) {
    markerLookup.get(selectedDestinationId)?.closePopup();
  }

  selectedDestinationId = null;
  refreshSelectionState();
};

const openDestinationDrawer = () => {
  if (!mapDestinationDrawer) {
    return;
  }

  closeMobileFilterSheet();
  mapDestinationDrawer.classList.add("is-open");
  mapDestinationDrawer.setAttribute("aria-hidden", "false");

  if (mapDrawerToggle) {
    mapDrawerToggle.setAttribute("aria-expanded", "true");
  }

  if (mapDrawerBackdrop) {
    mapDrawerBackdrop.hidden = false;
    requestAnimationFrame(() => mapDrawerBackdrop.classList.add("is-visible"));
  }
};

const closeDestinationDrawer = () => {
  if (!mapDestinationDrawer) {
    return;
  }

  mapDestinationDrawer.classList.remove("is-open");
  mapDestinationDrawer.setAttribute("aria-hidden", "true");

  if (mapDrawerToggle) {
    mapDrawerToggle.setAttribute("aria-expanded", "false");
  }

  if (mapDrawerBackdrop) {
    mapDrawerBackdrop.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!mapDestinationDrawer.classList.contains("is-open")) {
        mapDrawerBackdrop.hidden = true;
      }
    }, 180);
  }
};

const toggleDestinationDrawer = () => {
  if (mapDestinationDrawer?.classList.contains("is-open")) {
    closeDestinationDrawer();
    return;
  }

  openDestinationDrawer();
};

const initMap = () => {
  map = L.map("tourismMap", {
    zoomControl: true,
    scrollWheelZoom: true,
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  const openStreetMap = createBaseLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    name: "OpenStreetMap",
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });

  const esriWorldImagery = createBaseLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      name: "Esri World Imagery",
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    }
  );

  const openTopoMap = createBaseLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    name: "OpenTopoMap",
    maxZoom: 17,
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
      '<a href="https://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  });

  baseLayers = {
    OpenStreetMap: openStreetMap,
    Satellite: esriWorldImagery,
    Topographic: openTopoMap,
  };

  openStreetMap.addTo(map);
  L.control.layers(baseLayers, null, {
    position: "topright",
    collapsed: true,
  }).addTo(map);
  L.control.scale({
    position: "bottomleft",
    metric: true,
    imperial: false,
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
  map.on("click", () => {
    if (isMobileMapViewport() && selectedDestinationId) {
      clearSelectedDestination();
    }
  });
};

const focusDestination = (destinationId, openPopup = true) => {
  const marker = markerLookup.get(destinationId);
  const destination = validDestinations.find((item) => item.id === destinationId);

  if (!marker || !destination || !map) {
    return;
  }

  selectedDestinationId = destinationId;
  refreshSelectionState();

  map.flyTo([destination.latitude, destination.longitude], 14, {
    duration: 0.9,
  });

  if (openPopup && !isMobileMapViewport()) {
    marker.openPopup();
    return;
  }

  marker.closePopup();
};

const updateSummary = (items = validDestinations) => {
  const summaryItems = items.length ? items : [];
  const ratingValues = summaryItems.map((item) => item.rating).filter((value) => value > 0);
  const average = ratingValues.length
    ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
    : 0;
  const highestRatedDestination = [...summaryItems]
    .filter((item) => item.rating > 0)
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))[0];
  const centroid = getCentroid(summaryItems);
  const distancesFromCenter = centroid
    ? summaryItems.map((item) => ({
        destination: item,
        distance: getDistanceKilometers(centroid, item),
      }))
    : [];
  const averageDistance = distancesFromCenter.length
    ? distancesFromCenter.reduce((sum, item) => sum + item.distance, 0) / distancesFromCenter.length
    : 0;
  const nearestToCenter = distancesFromCenter
    .sort((a, b) => a.distance - b.distance || a.destination.name.localeCompare(b.destination.name))[0];

  mapTotalDestinations.textContent = summaryItems.length;
  mapAverageRating.textContent = ratingValues.length ? formatRating(average) : "-";
  mapDominantCategory.textContent = summaryItems.length
    ? new Set(summaryItems.map((item) => normalizeText(item.category)).filter(Boolean)).size
    : 0;
  mapDominantRegion.textContent = summaryItems.length
    ? new Set(summaryItems.map((item) => normalizeText(item.district)).filter(Boolean)).size
    : 0;

  if (mapHighestRating) {
    mapHighestRating.textContent = highestRatedDestination ? formatRating(highestRatedDestination.rating) : "-";
  }

  if (mapTopRatedName) {
    mapTopRatedName.textContent = highestRatedDestination?.name ?? "-";
  }

  mapValidMarkers.textContent = summaryItems.length;
  mapCentroid.textContent = centroid ? `${formatCoordinate(centroid.latitude)}, ${formatCoordinate(centroid.longitude)}` : "-";
  mapNearestToCenter.textContent = nearestToCenter?.destination.name ?? "-";
  mapAverageDistance.textContent = distancesFromCenter.length ? formatDistance(averageDistance) : "-";
};

const updateSelectedCard = () => {
  const destination = validDestinations.find((item) => item.id === selectedDestinationId) ?? null;

  if (!mapSelectedCard) {
    return;
  }

  if (!destination) {
    mapSelectedCard.hidden = true;
    mapSelectedCard.innerHTML = "";
    return;
  }

  mapSelectedCard.innerHTML = buildSelectedCardContent(destination);
  mapSelectedCard.hidden = false;
};

const readInitialFocusId = () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  return id ? String(id) : null;
};

const getFilteredDestinations = () => {
  const searchTerm = normalizeText(mapSearch?.value);
  const selectedRegion = mapRegionFilter?.value ?? "all";
  const selectedCategories = getSelectedCategories();
  const selectedCategorySet = new Set(selectedCategories);
  const hasCategoryFilter = selectedCategorySet.size > 0;
  const minimumRating = Number.parseFloat(mapRatingFilter?.value ?? "0") || 0;

  const filteredItems = validDestinations.filter((destination) => {
    const searchableText = [
      destination.name,
      destination.district,
      destination.category,
      destination.description,
    ].map(normalizeText).join(" ");
    const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
    const matchesCategory = !hasCategoryFilter || selectedCategorySet.has(getNormalizedPrimaryFilterCategory(destination.category));
    const matchesRegion = selectedRegion === "all" || destination.district === selectedRegion;
    const matchesRating = destination.rating >= minimumRating;

    return matchesSearch && matchesCategory && matchesRegion && matchesRating;
  });

  return sortDestinations(filteredItems);
};

const updateSidebar = () => {
  mapDestinationList.innerHTML = filteredDestinations.map(buildSidebarItem).join("");
  mapEmptyState.hidden = filteredDestinations.length > 0;
  mapEmptyState.textContent = "Tidak ada destinasi yang sesuai. Coba ubah kata kunci atau filter.";
};

const updateTable = () => {
  mapDataTableBody.innerHTML = filteredDestinations.map(buildTableRow).join("");
  mapTableEmpty.hidden = filteredDestinations.length > 0;
  mapTableEmpty.textContent = "Tidak ada destinasi yang sesuai. Coba ubah kata kunci atau filter.";
};

const refreshSelectionState = () => {
  document.querySelectorAll(".map-list-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.destinationId === selectedDestinationId);
  });

  document.querySelectorAll(".map-data-row").forEach((row) => {
    row.classList.toggle("is-active", row.dataset.destinationId === selectedDestinationId);
  });

  markerLookup.forEach((marker, destinationId) => {
    const destination = filteredDestinations.find((item) => item.id === destinationId);

    if (destination) {
      marker.setIcon(createMarkerIcon(destination, destinationId === selectedDestinationId));
    }
  });

  updateSelectedCard();
};

const updateMarkers = () => {
  if (!markersLayer) {
    return;
  }

  markersLayer.clearLayers();
  markerLookup = new Map();
  const shouldBindPopup = !isMobileMapViewport();

  filteredDestinations.forEach((destination) => {
    const marker = L.marker([destination.latitude, destination.longitude], {
      icon: createMarkerIcon(destination, destination.id === selectedDestinationId),
      title: destination.name,
    });

    if (shouldBindPopup) {
      marker.bindPopup(createPopupContent(destination), {
        maxWidth: 288,
        className: "tourism-popup",
      });
    }

    marker.on("click", () => {
      selectedDestinationId = destination.id;
      refreshSelectionState();

      if (isMobileMapViewport()) {
        closeDestinationDrawer();
      }
    });

    marker.addTo(markersLayer);
    markerLookup.set(destination.id, marker);
  });
};

const fitToFilteredMarkers = () => {
  if (!map) {
    return;
  }

  if (filteredDestinations.length === 0) {
    if (baseBounds) {
      map.fitBounds(baseBounds, { padding: [32, 32] });
    } else {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }

    return;
  }

  const bounds = L.latLngBounds(filteredDestinations.map((destination) => [destination.latitude, destination.longitude]));
  map.fitBounds(bounds, { padding: [32, 32] });
};

const applyFilters = (options = {}) => {
  filteredDestinations = getFilteredDestinations();
  mapMarkerCount.textContent = `${filteredDestinations.length} marker tampil`;
  syncLegendState();

  if (selectedDestinationId && !filteredDestinations.some((item) => item.id === selectedDestinationId)) {
    selectedDestinationId = null;
  }

  updateMarkers();
  updateSidebar();
  updateTable();
  updateSummary(filteredDestinations);
  refreshSelectionState();

  if (options.focusId) {
    const targetDestination = filteredDestinations.find((item) => item.id === options.focusId);

    if (targetDestination) {
      focusDestination(targetDestination.id, true);
      return;
    }
  }

  if (!options.skipFit) {
    fitToFilteredMarkers();
  }
};

const resetFilters = () => {
  selectedDestinationId = null;
  resetFilterControls();
  applyFilters();
};

const clearFilters = () => {
  selectedDestinationId = null;
  resetFilterControls();
  applyFilters();
};

const showCopyToast = (message = "Koordinat berhasil disalin.") => {
  if (!mapCopyToast) {
    return;
  }

  mapCopyToast.textContent = message;
  mapCopyToast.hidden = false;
  mapCopyToast.classList.add("is-visible");

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    mapCopyToast.classList.remove("is-visible");
    mapCopyToast.hidden = true;
  }, 1800);
};

const copyText = async (value) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
};

const applyMobilePanelDefaults = () => {
  if (!isMobileMapViewport()) {
    return;
  }

  mobileCollapsiblePanels.forEach((panel) => {
    panel.open = panel.classList.contains("map-filter-panel");
  });
};

const loadMapData = async () => {
  try {
    mapMarkerCount.textContent = "Memuat destinasi...";
    mapDestinationList.innerHTML = "";
    mapDataTableBody.innerHTML = "";
    mapEmptyState.hidden = false;
    mapEmptyState.textContent = "Memuat destinasi...";
    mapTableEmpty.hidden = false;
    mapTableEmpty.textContent = "Memuat destinasi...";
    if (mapSelectedCard) {
      mapSelectedCard.hidden = true;
      mapSelectedCard.innerHTML = "";
    }

    const response = await fetch(CSV_SOURCE);

    if (!response.ok) {
      throw new Error(`CSV request failed with status ${response.status}`);
    }

    const csvText = await response.text();
    destinations = parseDelimitedCSV(csvText, ";").map(normalizeDestination);
    validDestinations = destinations.filter((destination) => destination.hasValidCoordinates);

    const categories = [...new Set(validDestinations.map((destination) => destination.category))].sort();
    const regions = [...new Set(validDestinations.map((destination) => destination.district))].sort();

    renderCategoryOptions(categories);
    fillSelectOptions(mapRegionFilter, regions, "Semua Wilayah");
    resetFilterControls();

    if (validDestinations.length > 0) {
      baseBounds = L.latLngBounds(validDestinations.map((destination) => [destination.latitude, destination.longitude]));
    }

    syncLegendState();
    updateSummary();
    applyFilters({ focusId: readInitialFocusId() });
  } catch (error) {
    console.error(error);
    mapMarkerCount.textContent = "Data destinasi belum dapat dimuat.";
    mapEmptyState.hidden = false;
    mapTableEmpty.hidden = false;
    mapEmptyState.textContent = "Data destinasi belum dapat dimuat. Coba buka melalui Live Server atau GitHub Pages.";
    mapTableEmpty.textContent = "Data destinasi belum dapat dimuat. Coba buka melalui Live Server atau GitHub Pages.";
    if (mapSelectedCard) {
      mapSelectedCard.hidden = true;
      mapSelectedCard.innerHTML = "";
    }
  }
};

[mapSearch, mapRegionFilter, mapSortFilter, mapRatingFilter].forEach((control) => {
  control?.addEventListener("input", () => applyFilters());
  control?.addEventListener("change", () => applyFilters());
});

mapSearch?.addEventListener("input", syncMobileSearchValue);
mapSearch?.addEventListener("change", syncMobileSearchValue);
mapSearchMobile?.addEventListener("input", () => {
  if (!mapSearch) {
    return;
  }

  mapSearch.value = mapSearchMobile.value;
  mapSearch.dispatchEvent(new Event("input", { bubbles: true }));
});

mapRatingFilter?.addEventListener("input", updateRatingLabel);
mapCategoryOptions?.addEventListener("change", (event) => {
  if (!event.target.matches("input[type='checkbox']")) {
    return;
  }

  ensureCategorySelection();
  syncCategoryOptionState();
  renderMobileCategoryChips();
  applyFilters();
});
mapMobileCategoryChips?.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-category]");

  if (!chip || !mapCategoryOptions) {
    return;
  }

  const targetValue = normalizeText(chip.dataset.category);
  const checkbox = getCategoryCheckboxes().find((item) => normalizeText(item.value) === targetValue);

  if (!checkbox) {
    return;
  }

  checkbox.checked = !checkbox.checked;
  ensureCategorySelection();
  syncCategoryOptionState();
  renderMobileCategoryChips();
  applyFilters();
});

mapApplyButton?.addEventListener("click", () => {
  applyFilters();

  if (isMobileMapViewport()) {
    closeMobileFilterSheet();
  }
});
mapResetButton?.addEventListener("click", resetFilters);
mapClearButton?.addEventListener("click", clearFilters);
mapResetViewButton?.addEventListener("click", resetFilters);
mapMobileResetButton?.addEventListener("click", resetFilters);
mapMobileFilterToggle?.addEventListener("click", toggleMobileFilterSheet);
mapMobileSheetClose?.addEventListener("click", closeMobileFilterSheet);
mapFilterBackdrop?.addEventListener("click", closeMobileFilterSheet);
mapDrawerToggle?.addEventListener("click", toggleDestinationDrawer);
mapDrawerClose?.addEventListener("click", closeDestinationDrawer);
mapDrawerBackdrop?.addEventListener("click", closeDestinationDrawer);

mapDestinationList?.addEventListener("click", (event) => {
  const item = event.target.closest(".map-list-item");

  if (!item) {
    return;
  }

  focusDestination(item.dataset.destinationId, true);

  if (isMobileMapViewport()) {
    closeDestinationDrawer();
  }
});

mapDataTableBody?.addEventListener("click", (event) => {
  const row = event.target.closest(".map-data-row");

  if (!row) {
    return;
  }

  focusDestination(row.dataset.destinationId, true);

  if (isMobileMapViewport()) {
    closeDestinationDrawer();
  }
});

mapDataTableBody?.addEventListener("keydown", (event) => {
  const row = event.target.closest(".map-data-row");

  if (!row || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }

  event.preventDefault();
  focusDestination(row.dataset.destinationId, true);

  if (isMobileMapViewport()) {
    closeDestinationDrawer();
  }
});

mapSelectedCard?.addEventListener("click", (event) => {
  const dismissButton = event.target.closest("[data-dismiss-selected]");

  if (dismissButton) {
    clearSelectedDestination();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDestinationDrawer();
    closeMobileFilterSheet();
  }
});

window.addEventListener("resize", () => {
  const nextMobileViewportMode = isMobileMapViewport();

  if (!nextMobileViewportMode) {
    closeMobileFilterSheet();
    closeDestinationDrawer();
  }

  if (nextMobileViewportMode !== isMobileViewportMode) {
    isMobileViewportMode = nextMobileViewportMode;
    applyMobilePanelDefaults();

    if (destinations.length > 0) {
      applyFilters({ skipFit: true });
    }
  }
});

initMap();
applyMobilePanelDefaults();
loadMapData();
