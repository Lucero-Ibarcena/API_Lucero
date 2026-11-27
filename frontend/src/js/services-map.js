import { icon } from "./icons.js";

// Mapa interactivo del directorio y selector de ubicación de servicios.
const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const tileAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
const defaultCenter = [-34.6037, -58.3816];
const mapRecords = new Map();
const geocodeCache = new Map();
const pendingGeocodes = new Map();
let geocodeQueue = Promise.resolve();
let lastGeocodeAt = 0;

const categories = {
  veterinaria: { label: "Veterinaria", icon: "medical" },
  guardia: { label: "Guardia", icon: "medical" },
  tienda: { label: "Tienda / pet shop", icon: "shop" },
  peluqueria: { label: "Peluquería", icon: "scissors" },
  refugio: { label: "Refugio", icon: "house" },
  guarderia: { label: "Guardería", icon: "house" },
  escuela: { label: "Escuela / adiestramiento", icon: "school" },
  perrera: { label: "Perrera", icon: "house" },
  parque: { label: "Parque / plaza", icon: "location" },
  pet_friendly: { label: "Lugar pet friendly", icon: "heart" },
  otro: { label: "Otro", icon: "mapPin" },
};

const iconByCategory = {
  veterinaria: "veterinaria",
  guardia: "guardia",
  tienda: "tienda",
  peluqueria: "peluqueria",
  refugio: "refugio",
  guarderia: "guarderia",
  escuela: "escuela",
  perrera: "perrera",
  parque: "parque",
  pet_friendly: "pet-friendly",
  otro: "otro",
};

function leaflet() {
  return window.L || null;
}

function locationOf(place) {
  const rawLatitude = place?.ubicacion?.latitud;
  const rawLongitude = place?.ubicacion?.longitud;
  if (
    rawLatitude === undefined ||
    rawLatitude === null ||
    rawLatitude === "" ||
    rawLongitude === undefined ||
    rawLongitude === null ||
    rawLongitude === ""
  ) {
    return null;
  }

  const lat = Number(rawLatitude);
  const lng = Number(rawLongitude);
  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return [lat, lng];
}

function createMap(container) {
  const L = leaflet();
  if (!L || !container) return null;

  const map = L.map(container, {
    zoomControl: false,
    scrollWheelZoom: false,
    maxZoom: 19,
  }).setView(defaultCenter, 12);

  L.tileLayer(tileUrl, {
    attribution: tileAttribution,
    maxZoom: 19,
  }).addTo(map);

  L.control
    .zoom({
      position: "bottomright",
      zoomInText: "+",
      zoomInTitle: "Acercar mapa",
      zoomOutText: "−",
      zoomOutTitle: "Alejar mapa",
    })
    .addTo(map);
  return map;
}

function saveMapRecord(container, record) {
  record.active = true;
  mapRecords.set(container, record);
  requestAnimationFrame(() => {
    if (record.active && container.isConnected) record.map.invalidateSize();
  });
}

function removeMap(container, record) {
  record.active = false;
  record.map.remove();
  mapRecords.delete(container);
}

export function disposeServiceMaps(root) {
  if (!root) return;

  for (const [container, record] of mapRecords) {
    if (root === container || root.contains(container))
      removeMap(container, record);
  }
}

function markerIcon(category, temporary = false) {
  const L = leaflet();
  const categoryKey = categories[category] ? category : "otro";
  const meta = categories[categoryKey];
  const html = temporary
    ? '<span class="service-map-pin service-map-pin--search"><span class="service-map-pin-icon">⌖</span></span>'
    : `<span class="service-map-pin service-map-pin--${iconByCategory[categoryKey]}"><span class="service-map-pin-icon">${icon(meta.icon)}</span></span>`;

  return L.divIcon({
    className: "service-map-marker",
    html,
    iconSize: temporary ? [42, 48] : [42, 50],
    iconAnchor: temporary ? [21, 44] : [21, 46],
    popupAnchor: [0, -42],
  });
}

function placeAddress(place) {
  return [place.direccion, place.localidad, place.provincia, place.pais]
    .filter(Boolean)
    .join(", ");
}

function createPlacePopup(place, coordinates) {
  const popup = document.createElement("div");
  popup.className = "service-map-popup";

  const title = document.createElement("strong");
  title.textContent = place.nombre || "Lugar registrado";
  popup.append(title);

  const type = document.createElement("span");
  type.className = "service-map-popup-type";
  type.textContent = categories[place.categoria]?.label || categories.otro.label;
  popup.append(type);

  const address = placeAddress(place);
  if (address) {
    const details = document.createElement("p");
    details.textContent = address;
    popup.append(details);
  }

  if (place.descripcion) {
    const description = document.createElement("p");
    description.textContent = place.descripcion;
    popup.append(description);
  }

  const verification = document.createElement("span");
  verification.className = `service-map-popup-status${place.verificado ? " is-verified" : ""}`;
  verification.textContent = place.verificado ? "Verificado" : "Sin verificar por Huellas";
  popup.append(verification);

  const phone = typeof place.telefono === "string" ? place.telefono : "";
  const phoneHref = phone.replace(/[^\d+]/g, "");
  if (phoneHref) {
    const call = document.createElement("a");
    call.href = `tel:${phoneHref}`;
    call.className = "service-map-popup-contact";
    call.textContent = `Llamar ${phone}`;
    popup.append(call);
  }

  const email = typeof place.email === "string" ? place.email.trim() : "";
  if (email) {
    const contact = document.createElement("a");
    contact.href = `mailto:${encodeURIComponent(email)}`;
    contact.className = "service-map-popup-contact";
    contact.textContent = "Enviar email";
    popup.append(contact);
  }

  const route = document.createElement("a");
  route.href = place.comoLlegarUrl || `https://www.google.com/maps/dir/?api=1&destination=${coordinates[0]},${coordinates[1]}&travelmode=walking&dir_action=navigate`;
  route.target = "_blank";
  route.rel = "noopener noreferrer";
  route.className = "service-map-popup-route";
  route.textContent = "Iniciar ruta a pie";
  popup.append(route);

  const reviews = document.createElement("button");
  reviews.type = "button";
  reviews.className = "service-map-popup-reviews";
  reviews.dataset.action = "open-service-reviews";
  reviews.dataset.id = String(place.id);
  reviews.textContent = place.resenas?.cantidad
    ? `★ ${place.resenas.promedio} · ${place.resenas.cantidad} reseñas`
    : "Ver reseñas y opinar";
  popup.append(reviews);

  return popup;
}

function normalizedQuery(query) {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-AR");
}

// Busca solo al enviar el formulario; guarda resultados y limita consultas sucesivas.
async function geocodeAddress(query) {
  const cleanedQuery = query.trim().replace(/\s+/g, " ");
  const cacheKey = normalizedQuery(cleanedQuery);
  if (!cacheKey) return null;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);
  if (pendingGeocodes.has(cacheKey)) return pendingGeocodes.get(cacheKey);

  const request = geocodeQueue.then(async () => {
    const waitMs = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
    if (waitMs) await new Promise((resolve) => window.setTimeout(resolve, waitMs));
    lastGeocodeAt = Date.now();

    const params = new URLSearchParams({
      format: "jsonv2",
      q: cleanedQuery,
      limit: "1",
      addressdetails: "1",
      "accept-language": "es",
    });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        { headers: { Accept: "application/json" }, signal: controller.signal },
      );
      if (!response.ok) throw new Error("No se pudo buscar esa dirección.");
      const results = await response.json();
      const result = results[0];
      if (!result) return null;

      const lat = Number(result.lat);
      const lng = Number(result.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng, label: result.display_name || cleanedQuery };
    } finally {
      window.clearTimeout(timeout);
    }
  });

  geocodeQueue = request.catch(() => null);
  pendingGeocodes.set(cacheKey, request);
  try {
    const result = await request;
    geocodeCache.set(cacheKey, result);
    return result;
  } finally {
    pendingGeocodes.delete(cacheKey);
  }
}

function setMapFeedback(root, message, error = false) {
  const feedback = root.querySelector("[data-service-map-feedback]");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle("is-error", error);
}

function fitServiceMarkers(map, markers) {
  const L = leaflet();
  const locations = [...markers.values()].map((marker) => marker.getLatLng());
  if (!locations.length) {
    map.setView(defaultCenter, 12);
    return;
  }
  if (locations.length === 1) {
    map.setView(locations[0], 14);
    return;
  }
  map.fitBounds(L.latLngBounds(locations), { padding: [32, 32], maxZoom: 14 });
}

export function mountServicesDirectoryMap(root, places) {
  const L = leaflet();
  const container = root?.querySelector("#services-directory-map");
  if (!container) return;

  const previous = mapRecords.get(container);
  if (previous) removeMap(container, previous);
  const map = createMap(container);
  if (!map) {
    setMapFeedback(root, "No se pudo cargar el mapa. Revisa tu conexión e inténtalo de nuevo.", true);
    return;
  }

  const markers = new Map();
  for (const place of places) {
    const coordinates = locationOf(place);
    if (!coordinates) continue;

    const marker = L.marker(coordinates, {
      icon: markerIcon(place.categoria),
      title: place.nombre || "Lugar registrado",
      alt: place.nombre || "Lugar de servicio",
    }).addTo(map);
    marker.bindPopup(createPlacePopup(place, coordinates), { maxWidth: 280 });
    markers.set(String(place.id), marker);
  }
  fitServiceMarkers(map, markers);

  const record = {
    map,
    markers,
    active: true,
    searchMarker: null,
    userMarker: null,
  };
  saveMapRecord(container, record);
  setMapFeedback(
    root,
    markers.size
      ? `${markers.size} ${markers.size === 1 ? "lugar visible" : "lugares visibles"} en el mapa.`
      : "No hay lugares con ubicación para mostrar en esta búsqueda.",
  );

  const searchForm = root.querySelector("[data-service-map-search]");
  searchForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = searchForm.querySelector("input[name='ubicacion']");
    const button = searchForm.querySelector("button[type='submit']");
    const query = input?.value.trim() || "";
    if (!query) {
      setMapFeedback(root, "Escribe una dirección, barrio o ciudad para buscar.", true);
      input?.focus();
      return;
    }

    if (button) button.disabled = true;
    setMapFeedback(root, "Buscando esa zona…");
    try {
      const result = await geocodeAddress(query);
      if (!record.active) return;
      if (!result) {
        setMapFeedback(root, "No encontré esa zona. Prueba con una dirección o ciudad más precisa.", true);
        return;
      }
      record.searchMarker?.remove();
      record.searchMarker = L.marker([result.lat, result.lng], {
        icon: markerIcon("otro", true),
        title: "Zona buscada",
      }).addTo(map);
      const popup = document.createElement("div");
      popup.className = "service-map-popup";
      const label = document.createElement("strong");
      label.textContent = "Zona buscada";
      const details = document.createElement("p");
      details.textContent = result.label;
      popup.append(label, details);
      record.searchMarker.bindPopup(popup).openPopup();
      map.setView([result.lat, result.lng], 15);
      setMapFeedback(root, `Mapa centrado en ${result.label}.`);
    } catch {
      if (record.active)
        setMapFeedback(root, "No se pudo buscar la dirección. Inténtalo de nuevo.", true);
    } finally {
      if (record.active && button) button.disabled = false;
    }
  });

  root.querySelector("[data-services-map-location]")?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setMapFeedback(root, "Este navegador no ofrece ubicación actual.", true);
      return;
    }
    setMapFeedback(root, "Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!record.active) return;
        const location = [coords.latitude, coords.longitude];
        record.userMarker?.remove();
        record.userMarker = L.circleMarker(location, {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: "#3678c8",
          fillOpacity: 1,
        }).addTo(map);
        record.userMarker.bindPopup("Tu ubicación");
        map.setView(location, 15);
        setMapFeedback(root, "Mapa centrado en tu ubicación.");
      },
      () => {
        if (record.active)
          setMapFeedback(root, "No se pudo obtener tu ubicación. Puedes buscar una zona arriba.", true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });

  root.querySelector("[data-services-map-fit]")?.addEventListener("click", () => {
    if (!record.active) return;
    record.searchMarker?.remove();
    record.searchMarker = null;
    fitServiceMarkers(map, markers);
    setMapFeedback(
      root,
      markers.size
        ? `${markers.size} ${markers.size === 1 ? "lugar visible" : "lugares visibles"} en el mapa.`
        : "No hay lugares con ubicación para mostrar en esta búsqueda.",
    );
  });

  root.addEventListener("click", (event) => {
    const focusButton = event.target.closest("[data-map-place-id]");
    if (!focusButton || !record.active) return;
    const marker = markers.get(focusButton.dataset.mapPlaceId);
    if (!marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.45 });
    marker.openPopup();
  });
}

export function mountServiceLocationPicker(root) {
  const L = leaflet();
  const container = root?.querySelector("#place-location-map");
  const form = container?.closest("form");
  if (!container || !form) return;

  const previous = mapRecords.get(container);
  if (previous) removeMap(container, previous);
  const map = createMap(container);
  if (!map) {
    setMapFeedback(root, "No se pudo cargar el mapa. Revisa tu conexión e inténtalo de nuevo.", true);
    return;
  }

  const latitudeInput = form.elements.latitud;
  const longitudeInput = form.elements.longitud;
  const categoryInput = form.elements.categoria;
  const lat = Number(latitudeInput.value);
  const lng = Number(longitudeInput.value);
  const hasInitialLocation =
    latitudeInput.value !== "" &&
    longitudeInput.value !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  map.setView(hasInitialLocation ? [lat, lng] : defaultCenter, hasInitialLocation ? 16 : 12);

  const record = { map, marker: null, active: true };
  saveMapRecord(container, record);

  const setLocation = (latitude, longitude, message = "Punto elegido en el mapa.") => {
    latitudeInput.value = Number(latitude).toFixed(7);
    longitudeInput.value = Number(longitude).toFixed(7);
    const coordinates = [Number(latitude), Number(longitude)];
    if (!record.marker) {
      record.marker = L.marker(coordinates, {
        icon: markerIcon(categoryInput.value),
        title: "Ubicación del servicio",
        draggable: true,
      }).addTo(map);
      record.marker.on("dragend", () => {
        const position = record.marker.getLatLng();
        latitudeInput.value = position.lat.toFixed(7);
        longitudeInput.value = position.lng.toFixed(7);
        setMapFeedback(root, "Ubicación ajustada.");
      });
    } else {
      record.marker.setLatLng(coordinates);
      record.marker.setIcon(markerIcon(categoryInput.value));
    }
    setMapFeedback(root, message);
  };

  if (hasInitialLocation) {
    setLocation(lat, lng, "Ubicación guardada. Toca o arrastra el pin para ajustarla.");
  } else {
    setMapFeedback(root, "Busca la dirección o toca el mapa para elegir el punto exacto.");
  }

  map.on("click", (event) => {
    setLocation(event.latlng.lat, event.latlng.lng);
  });

  categoryInput.addEventListener("change", () => {
    if (record.marker) record.marker.setIcon(markerIcon(categoryInput.value));
  });

  root.querySelector("[data-place-locate]")?.addEventListener("click", async () => {
    const address = form.elements.direccion.value.trim();
    const name = form.elements.nombre.value.trim();
    const locality = form.elements.localidad.value.trim();
    const province = form.elements.provincia.value.trim();
    const country = form.elements.pais.value.trim();
    const searchBase = address || name;
    const query = [searchBase, locality, province, country].filter(Boolean).join(", ");
    const button = root.querySelector("[data-place-locate]");
    if (!searchBase || !locality || !country) {
      setMapFeedback(root, "Completa el nombre o dirección, la localidad y el país antes de buscar.", true);
      return;
    }

    button.disabled = true;
    setMapFeedback(root, "Buscando la dirección…");
    try {
      const result = await geocodeAddress(query);
      if (!record.active) return;
      if (!result) {
        setMapFeedback(root, "No encontré esa dirección. Prueba con otra o marca el punto en el mapa.", true);
        return;
      }
      map.setView([result.lat, result.lng], 17);
      setLocation(result.lat, result.lng, "Punto aproximado ubicado. Arrastra o toca el mapa para ajustarlo.");
    } catch {
      if (record.active)
        setMapFeedback(root, "No se pudo buscar la dirección. Puedes elegir el punto directamente en el mapa.", true);
    } finally {
      if (record.active) button.disabled = false;
    }
  });
}
