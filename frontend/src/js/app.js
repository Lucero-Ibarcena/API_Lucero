import {
  api,
  apiBlob,
  clearSession,
  getCachedUser,
  hasToken,
  saveSession,
} from "./api.js";
import {
  emptyState,
  esc,
  petCard,
  photoUrl,
  sectionHeader,
  statusLabel,
} from "./ui.js";
import { icon } from "./icons.js";
import { disposeControls, enhanceControls } from "./controls.js";
import {
  disposeServiceMaps,
  mountServiceLocationPicker,
  mountServicesDirectoryMap,
} from "./services-map.js";

// Estado compartido de navegación, sesión y datos de las pantallas.
const content = document.querySelector("#content");
const modal = document.querySelector("#modal");
const modalContent = document.querySelector("#modal-content");
const notice = document.querySelector("#notice");
const FAVORITES_KEY = "huellas.favoritos";

// Favoritos: se mantienen en el navegador, sin enviarlos al backend.
function readFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return new Set(
      Array.isArray(value) ? value.filter((id) => typeof id === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  } catch {
    showNotice("No se pudieron guardar los favoritos en este navegador.", true);
  }
}

// Datos temporales compartidos entre las vistas de la aplicación.
const state = {
  view: "inicio",
  user: getCachedUser(),
  pets: [],
  lost: [],
  adoptions: [],
  places: [],
  ownPets: [],
  requests: [],
  invitations: [],
  searchResults: null,
  searchFilters: {},
  serviceFilters: {},
  favorites: readFavorites(),
  selectedPetId: null,
  petTab: "informacion",
  previousView: "inicio",
  publishType: "perdida",
  publishDraft: {},
  pendingAction: "",
  routePet: null,
  publishPhotoFiles: [],
  publishPhotosUploaded: [],
};

// Quita acciones de gestión de servicios cuando la sesión deja de ser válida.
function limpiarPropiedadServicios() {
  state.places = state.places.map((place) => ({ ...place, propio: false }));
  state.allPlaces = state.places;
}

// Mapa de rutas visibles y filtros admitidos en la URL.
const routeByView = {
  inicio: "/app/inicio",
  buscar: "/app/buscar",
  guardados: "/app/guardados",
  perdidas: "/app/avisos",
  adopcion: "/app/adopcion",
  servicios: "/app/servicios",
  publicar: "/app/publicar",
  sobre: "/app/sobre",
  ficha: "/app/mascotas",
  mias: "/app/mascotas",
  cuenta: "/app/cuenta",
};
const searchFields = [
  "q",
  "nombre",
  "especie",
  "raza",
  "color",
  "tamano",
  "sexo",
  "edad",
  "vacunado",
  "responsable",
  "estado",
  "localidad",
  "pais",
];

// Navegación: convierte el estado actual en URL y restaura vistas desde ella.
function routePathForState() {
  if (state.view === "inicio" && location.pathname === "/") return "/";
  let path = routeByView[state.view] || routeByView.inicio;
  if (state.view === "ficha" && state.selectedPetId)
    path += `/${encodeURIComponent(state.selectedPetId)}`;
  const params = new URLSearchParams();
  if (["buscar", "perdidas", "adopcion"].includes(state.view)) {
    const kind = state.view === "buscar" ? "buscar" : state.view;
    for (const field of searchFields) {
      const value = state.searchFilters[kind]?.[field];
      if (value !== undefined && String(value).trim())
        params.set(field, String(value).trim());
    }
  }
  if (state.view === "servicios") {
    for (const field of ["categoria", "localidad", "pais"]) {
      const value = state.serviceFilters[field];
      if (value !== undefined && String(value).trim())
        params.set(field, String(value).trim());
    }
  }
  if (state.view === "publicar") params.set("tipo", state.publishType);
  if (state.view === "ficha" && state.petTab !== "informacion")
    params.set("tab", state.petTab);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function syncLocation(mode = "auto") {
  const next = routePathForState();
  const current = `${location.pathname}${location.search}${location.hash}`;
  if (next === current) return;
  const method = mode === "auto" ? "pushState" : "replaceState";
  history[method]({}, "", next);
}

function readRoute() {
  const parts = location.pathname.split("/").filter(Boolean);
  const appParts = parts[0] === "app" ? parts.slice(1) : [];
  let view = "inicio";
  if (appParts[0] === "buscar") view = "buscar";
  else if (["avisos", "perdidas"].includes(appParts[0])) view = "perdidas";
  else if (appParts[0] === "adopcion") view = "adopcion";
  else if (appParts[0] === "servicios") view = "servicios";
  else if (appParts[0] === "sobre") view = "sobre";
  else if (appParts[0] === "guardados") view = "guardados";
  else if (appParts[0] === "cuenta" || appParts[0] === "comunidad")
    view = "cuenta";
  else if (appParts[0] === "publicar") view = "publicar";
  else if (appParts[0] === "mascotas" && appParts[1]) view = "ficha";
  else if (appParts[0] === "mascotas") view = "mias";

  const priorView = state.view;
  state.view = view;
  if (view === "ficha") {
    try {
      state.selectedPetId = decodeURIComponent(appParts[1]);
    } catch {
      state.selectedPetId = appParts[1];
    }
    state.previousView = priorView === "ficha" ? "buscar" : priorView;
    state.petTab = ["informacion", "salud", "contacto"].includes(
      new URLSearchParams(location.search).get("tab"),
    )
      ? new URLSearchParams(location.search).get("tab")
      : "informacion";
  }
  if (view === "publicar") {
    const type = new URLSearchParams(location.search).get("tipo");
    state.publishType = ["perdida", "encontrada", "en_adopcion"].includes(type)
      ? type
      : "perdida";
    state.previousView = priorView === "publicar" ? "inicio" : priorView;
  }
  if (["buscar", "perdidas", "adopcion"].includes(view)) {
    const params = new URLSearchParams(location.search);
    const filters = {};
    for (const field of searchFields)
      if (params.has(field)) filters[field] = params.get(field);
    state.searchFilters[view === "buscar" ? "buscar" : view] = filters;
  }
  if (view === "servicios") {
    const params = new URLSearchParams(location.search);
    state.serviceFilters = Object.fromEntries(
      ["categoria", "localidad", "pais"]
        .filter((field) => params.has(field))
        .map((field) => [field, params.get(field)]),
    );
  }
}

// Carga los datos que necesita la pantalla indicada por la ruta.
async function loadRouteData() {
  if (["buscar", "perdidas", "adopcion"].includes(state.view)) {
    const kind = state.view === "buscar" ? "buscar" : state.view;
    const params = new URLSearchParams();
    if (kind === "perdidas") params.set("estado", "perdida");
    if (kind === "adopcion") params.set("estado", "en_adopcion");
    for (const field of searchFields) {
      const value = state.searchFilters[kind]?.[field];
      if (value !== undefined && String(value).trim())
        params.set(field, String(value).trim());
    }
    const pets = await api(`/mascotas${params.size ? `?${params}` : ""}`);
    if (kind === "buscar") state.searchResults = pets;
    else if (kind === "perdidas") state.lost = pets;
    else state.adoptions = pets;
  } else if (state.view === "servicios") {
    const params = new URLSearchParams();
    for (const field of ["categoria", "localidad", "pais"]) {
      const value = state.serviceFilters[field];
      if (value) params.set(field, value);
    }
    state.places = await api(`/lugares${params.size ? `?${params}` : ""}`);
  } else if (state.view === "ficha" && state.selectedPetId) {
    const cached = [
      ...state.ownPets,
      ...state.pets,
      ...state.lost,
      ...state.adoptions,
      ...(state.searchResults || []),
    ].find((pet) => pet.id === state.selectedPetId);
    state.routePet =
      cached ||
      (await api(`/mascotas/${encodeURIComponent(state.selectedPetId)}`));
  }
}
// Ejemplos públicos para mostrar la portada antes de iniciar sesión.
const previewPets = [
  {
    id: "demo-luna",
    nombre: "Luna",
    especie: "Perro",
    raza: "Cruza",
    edad: 2,
    estado: "perdida",
    publicar: true,
    reportePerdida: { localidad: "Palermo" },
  },
  {
    id: "demo-milo",
    nombre: "Milo",
    especie: "Gato",
    raza: "Gato",
    edad: 1,
    estado: "en_adopcion",
    publicar: true,
    ubicacion: { localidad: "Caballito" },
  },
  {
    id: "demo-toby",
    nombre: "Toby",
    especie: "Perro",
    raza: "Mestizo",
    edad: 3,
    estado: "encontrada",
    publicar: true,
    ubicacion: { localidad: "Recoleta" },
  },
  {
    id: "demo-nala",
    nombre: "Nala",
    especie: "Gato",
    raza: "Gata",
    edad: 2,
    estado: "en_adopcion",
    publicar: true,
    ubicacion: { localidad: "Belgrano" },
  },
];

// Controles de presentación compartidos entre las distintas pantallas.
function avatar(name = "") {
  return esc(
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "H",
  );
}

function showNotice(message, error = false) {
  notice.textContent = message;
  notice.hidden = false;
  notice.classList.toggle("is-error", error);
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => {
    notice.hidden = true;
  }, 4200);
}

function closeNav() {
  const nav = document.querySelector("#site-nav");
  nav?.classList.remove("is-open");
  document.querySelector(".app-shell")?.classList.remove("nav-open");
  document.body.classList.remove("nav-open");
  const toggle = document.querySelector(".menu-toggle");
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "Abrir navegación");
  if (toggle)
    toggle.innerHTML = `${icon("paw", "menu-paw")}<span class="menu-label">Menú</span><span class="visually-hidden">Abrir navegación</span>`;
}

function openModal(markup) {
  closeNav();
  disposeServiceMaps(modalContent);
  disposeControls(modalContent);
  liberarFotos(modalContent);
  modalContent.innerHTML = markup;
  enhanceControls(modalContent);
  cargarFotos(modalContent);
  if (!modal.open) modal.showModal();
  modalContent
    .querySelector(
      '[data-custom-select-trigger], [data-custom-date-trigger], input:not([type="hidden"]):not(.custom-control-native), select:not(.custom-control-native), textarea',
    )
    ?.focus({ preventScroll: true });
}

function closeModal() {
  disposeServiceMaps(modalContent);
  disposeControls(modalContent);
  liberarFotos(modalContent);
  modal.close();
  modalContent.replaceChildren();
}

/** Libera las URL temporales creadas para mostrar imágenes descargadas. */
function liberarFotos(root) {
  root.querySelectorAll("img[data-photo-blob]").forEach((image) => {
    URL.revokeObjectURL(image.dataset.photoBlob);
    delete image.dataset.photoBlob;
  });
}

/** Carga fotos privadas con el token y deja las URL externas sin credenciales. */
function cargarFotos(root) {
  root.querySelectorAll("img[data-photo-url]").forEach(async (image) => {
    image.addEventListener(
      "error",
      () => {
        if (image.dataset.photoBlob)
          URL.revokeObjectURL(image.dataset.photoBlob);
        image.remove();
      },
      { once: true },
    );
    let destino;
    try {
      destino = new URL(image.dataset.photoUrl, location.origin);
    } catch {
      image.remove();
      return;
    }

    if (destino.origin !== location.origin) {
      image.src = destino.href;
      return;
    }
    try {
      const blob = await apiBlob(`${destino.pathname}${destino.search}`);
      if (!image.isConnected) return;
      const fotoTemporal = URL.createObjectURL(blob);
      image.dataset.photoBlob = fotoTemporal;
      image.src = fotoTemporal;
    } catch {
      image.remove();
    }
  });
}

function authPanel() {
  return `<div class="auth-panel"><div class="auth-icon">${icon("paw")}</div><h2>Tu espacio empieza acá</h2><p>Inicia sesión para ver tus mascotas, compartir cuidados y contactar de forma segura.</p><button class="button button-primary" data-action="open-login">Ingresar a mi cuenta</button><button class="button button-cream" data-action="open-signup">Crear una cuenta</button></div>`;
}

function emptyPets(icon, title, text, actionLabel = "", action = "") {
  const button = actionLabel
    ? `<button class="button button-primary" data-action="${esc(action)}">${esc(actionLabel)}</button>`
    : "";
  return emptyState({ icon, title, text, action: button });
}

function topActions() {
  const actions = document.querySelector("#session-actions");
  const nav = document.querySelector("#site-nav");
  const brand = document.querySelector(".brand");
  // Cada cambio de sesión reconstruye la barra: nunca heredar el menú abierto.
  closeNav();
  if (brand) brand.href = state.user ? routeByView.inicio : "/";
  const links = state.user
    ? [
        ["inicio", "Inicio", "home"],
        ["mias", "Mis mascotas", "paw"],
        ["buscar", "Buscar", "search"],
        ["perdidas", "Avisos", "megaphone"],
        ["servicios", "Servicios", "mapPin"],
        ["cuenta", "Comunidad", "users"],
        ["sobre", "Sobre Huellas", "help"],
      ]
    : [
        ["inicio", "Inicio", "home"],
        ["buscar", "Buscar", "search"],
        ["perdidas", "Avisos", "megaphone"],
        ["servicios", "Servicios", "mapPin"],
        ["cuenta", "Comunidad", "users"],
        ["sobre", "Sobre Huellas", "help"],
      ];
  nav.innerHTML =
    `<div class="nav-drawer-heading"><strong>Huellas</strong><button class="drawer-close" type="button" aria-label="Cerrar navegación" data-action="toggle-nav">${icon("close")}</button></div>` +
    links
      .map(
        ([view, label, symbol]) =>
          `<a class="nav-link ${view === "cuenta" ? "nav-community" : ""}" href="${routeByView[view]}" data-view="${view}">${icon(symbol)}<span>${label}</span></a>`,
      )
      .join("") +
    (state.user
      ? `<a class="nav-link nav-drawer-only" href="${routeByView.mias}" data-view="mias">${icon("heart")}<span>Cuidado compartido</span></a><a class="nav-link nav-drawer-only" href="${routeByView.cuenta}" data-view="cuenta">${icon("mail")}<span>Contactos</span></a><a class="nav-link nav-drawer-only" href="${routeByView.cuenta}" data-view="cuenta">${icon("user")}<span>Mi cuenta</span></a>`
      : "") +
    (state.user
      ? ""
      : '<button class="nav-link nav-signup" type="button" data-action="open-signup">Crear cuenta</button>');
  if (state.user) {
    actions.innerHTML = `<button class="button button-primary button-small header-publish" data-action="report-public">Publicar aviso</button><button class="icon-button" title="Mensajes y notificaciones" aria-label="Mensajes y notificaciones" data-action="go-account">${icon("bell")}</button><button class="user-chip" aria-label="Abrir mi cuenta" data-action="go-account"><span class="profile-avatar">${avatar(state.user.nombre)}</span></button>`;
  } else {
    actions.innerHTML = `<button class="button button-cream button-small" data-action="open-login">Iniciar sesión</button><button class="button button-primary button-small" data-action="open-signup">Crear cuenta</button>`;
  }
  document
    .querySelectorAll("#site-nav [data-view], .mobile-nav [data-view]")
    .forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
}

// Vistas principales: inicio, búsqueda, favoritos, servicios y cuenta.
function homeView() {
  const featured = state.pets.length ? state.pets.slice(0, 4) : previewPets;
  const hasPreview = state.pets.length === 0;
  return `<section class="hero">
    <div class="hero-copy"><div class="eyebrow">HUELLAS · RED DE CUIDADO ANIMAL</div><h1>Una red para <em>cuidarlos</em></h1>
      <p>Registrá, buscá y ayudá. Porque cada mascota merece volver a casa.</p>
      <form class="hero-search" data-form="search-pets" data-kind="buscar"><span aria-hidden="true">${icon("search")}</span><input name="q" type="search" placeholder="Buscar por nombre, especie, raza…" aria-label="Buscar por nombre, especie o raza"><button type="submit">Buscar</button></form>
      <div class="hero-actions"><button class="button button-primary" data-view="buscar">${icon("search")} Buscar mascotas ${icon("arrowRight")}</button><button class="button button-outline" data-action="report-public">${icon("plus")} Publicar un aviso</button></div>
    </div><div class="hero-image-slot" aria-hidden="true"></div>
  </section>
  <section class="quick-grid" aria-label="Accesos rápidos">
    <button class="quick-tile" data-action="report-public">${icon("paw", "quick-icon")}<strong>Publicar aviso</strong><small>Perdida o encontrada</small></button>
    <button class="quick-tile" data-view="adopcion">${icon("house", "quick-icon")}<strong>Buscar en adopción</strong><small>Un hogar para cada uno</small></button>
    <button class="quick-tile" data-view="servicios">${icon("medical", "quick-icon")}<strong>Servicios</strong><small>Veterinarias y refugios</small></button>
    <button class="quick-tile" data-view="mias">${icon("heart", "quick-icon")}<strong>Cuidado compartido</strong><small>Compartí responsabilidades</small></button>
  </section>
  <section>
    <div class="section-row"><div><div class="eyebrow">DE LA COMUNIDAD</div><h2>Avisos recientes</h2>${hasPreview ? '<p class="preview-note">Ejemplos para mostrar el diseño. Los avisos publicados aparecerán aquí.</p>' : ""}</div><button class="text-link" data-view="perdidas">Ver todos ${icon("arrowRight")}</button></div>
    <div class="cards-grid landing-cards">${featured.map((pet) => petCard(pet, { demo: hasPreview, compact: true, favorite: state.favorites.has(pet.id) })).join("")}</div>
  </section>
  <section class="community-banner"><div><div class="eyebrow">JUNTOS ES MEJOR</div><h2>¿Necesitás ayuda?</h2><p>Consultá nuestros servicios o sumate a la comunidad. Siempre hay una mano cerca.</p><button class="button button-primary" data-view="servicios">Explorar servicios ${icon("arrowRight")}</button></div></section>`;
}

function dashboardView() {
  const pendingRequests = state.requests.filter(
    (request) => request.estado === "pendiente",
  ).length;
  const activeNotices = state.ownPets.filter((pet) =>
    ["perdida", "en_adopcion"].includes(pet.estado),
  ).length;
  const latest = state.pets.length
    ? state.pets.slice(0, 4)
    : previewPets.slice(0, 4);
  const hasPreview = state.pets.length === 0;
  return `<section class="dashboard-hero">
      <div class="dashboard-hero-copy"><div class="eyebrow">TU ESPACIO EN HUELLAS</div><h1>¡Hola, ${esc(state.user.nombre.split(" ")[0])}!</h1><p>Una red para cuidarlos. Registrá, buscá y ayudá, porque cada mascota merece volver a casa.</p><p class="dashboard-mobile-prompt">¿Qué querés hacer hoy?</p>
      <form class="dashboard-search" data-form="search-pets" data-kind="buscar"><span class="dashboard-search-icon">${icon("search")}</span><input name="q" type="search" aria-label="Buscar mascotas" placeholder="Nombre, especie, raza o barrio"><button type="submit"><span>Buscar</span></button></form>
      </div>
      <div class="dashboard-image-slot" aria-hidden="true"></div>
    </section>
    <section class="stats-grid" aria-label="Resumen de tu actividad">
      <button class="stat-card" data-view="mias">${icon("paw", "stat-icon")}<span>Mis mascotas</span><strong>${state.ownPets.length}</strong></button>
      <button class="stat-card" data-view="perdidas">${icon("megaphone", "stat-icon")}<span>Avisos activos</span><strong>${activeNotices}</strong></button>
      <button class="stat-card" data-view="guardados">${icon("heart", "stat-icon")}<span>Guardados</span><strong>${state.favorites.size}</strong></button>
      <button class="stat-card" data-view="cuenta">${icon("users", "stat-icon")}<span>Solicitudes pendientes</span><strong>${pendingRequests}</strong></button>
    </section>
    <section class="quick-grid dashboard-quick-grid" aria-label="Accesos rápidos">
      <button class="quick-tile" data-action="report-public">${icon("megaphone", "quick-icon")}<strong>Publicar aviso</strong></button>
      <button class="quick-tile" data-view="adopcion">${icon("house", "quick-icon")}<strong>Buscar en adopción</strong></button>
      <button class="quick-tile" data-view="servicios">${icon("mapPin", "quick-icon")}<strong>Servicios</strong></button>
      <button class="quick-tile" data-view="mias">${icon("heart", "quick-icon")}<strong>Cuidado compartido</strong></button>
    </section>
    <section class="dashboard-recent"><div class="section-row"><div><div class="eyebrow">CERCA DE TU COMUNIDAD</div><h2>Avisos recientes</h2>${hasPreview ? '<p class="preview-note">Ejemplos para mostrar el diseño. Los avisos publicados aparecerán aquí.</p>' : ""}</div><button class="text-link" data-view="perdidas">Ver todos ${icon("arrowRight")}</button></div>
      <div class="cards-grid dashboard-cards">${latest.map((pet) => petCard(pet, { demo: hasPreview, compact: true, favorite: state.favorites.has(pet.id) })).join("")}</div>
    </section>`;
}

function searchForm(kind) {
  const queryField = "q";
  const queryLabel =
    kind === "buscar" ? "Nombre, especie o raza" : "Nombre de la mascota";
  const values = state.searchFilters[kind] || {};
  const value = (field) => esc(values[field] ?? "");
  const selected = (field, option) =>
    values[field] === option ? "selected" : "";
  const advancedOpen = [
    "raza",
    "color",
    "tamano",
    "sexo",
    "edad",
    "vacunado",
    "responsable",
    "estado",
  ].some((field) => Boolean(values[field]));
  return `<form class="search-panel" data-form="search-pets" data-kind="${kind}">
    <div class="search-control"><label for="search-pet-query">${queryLabel}</label><input id="search-pet-query" name="${queryField}" type="search" placeholder="${kind === "buscar" ? "Golden, gato, Luna…" : "Nombre o raza"}" autocomplete="off" value="${value("q")}"></div>
    <div class="search-control"><label for="search-pet-species">Especie</label><input id="search-pet-species" name="especie" placeholder="Perro, gato, ave…" value="${value("especie")}"></div>
    <div class="search-control"><label for="search-pet-city">Localidad</label><input id="search-pet-city" name="localidad" placeholder="Ciudad o barrio" value="${value("localidad")}"></div>
    <div class="search-control"><label for="search-pet-country">País</label><input id="search-pet-country" name="pais" placeholder="País" value="${value("pais")}"></div>
    <details class="advanced-search" ${advancedOpen ? "open" : ""}><summary>Más filtros</summary><div class="advanced-search-grid">
      <div class="search-control"><label for="search-pet-breed">Raza</label><input id="search-pet-breed" name="raza" placeholder="Raza" value="${value("raza")}"></div>
      <div class="search-control"><label for="search-pet-color">Color</label><input id="search-pet-color" name="color" placeholder="Color o señas" value="${value("color")}"></div>
      <div class="search-control"><label for="search-pet-size">Tamaño</label><select id="search-pet-size" name="tamano"><option value="" ${selected("tamano", "")}>Todos</option><option ${selected("tamano", "Pequeño")}>Pequeño</option><option ${selected("tamano", "Mediano")}>Mediano</option><option ${selected("tamano", "Grande")}>Grande</option></select></div>
      <div class="search-control"><label for="search-pet-sex">Sexo</label><select id="search-pet-sex" name="sexo"><option value="" ${selected("sexo", "")}>Todos</option><option ${selected("sexo", "Hembra")}>Hembra</option><option ${selected("sexo", "Macho")}>Macho</option></select></div>
      <div class="search-control"><label for="search-pet-age">Edad exacta</label><input id="search-pet-age" name="edad" type="number" min="0" step="1" placeholder="Años" value="${value("edad")}"></div>
      <div class="search-control"><label for="search-pet-vaccinated">Vacunación</label><select id="search-pet-vaccinated" name="vacunado"><option value="" ${selected("vacunado", "")}>Cualquiera</option><option value="true" ${selected("vacunado", "true")}>Al día</option><option value="false" ${selected("vacunado", "false")}>Pendiente</option></select></div>
      <div class="search-control"><label for="search-pet-caregiver">Responsable o cuidador</label><input id="search-pet-caregiver" name="responsable" placeholder="Nombre" value="${value("responsable")}"></div>
      ${kind === "buscar" ? `<div class="search-control"><label for="search-pet-status">Estado</label><select id="search-pet-status" name="estado"><option value="" ${selected("estado", "")}>Cualquiera</option><option value="perdida" ${selected("estado", "perdida")}>Perdida</option><option value="encontrada" ${selected("estado", "encontrada")}>Encontrada</option><option value="en_adopcion" ${selected("estado", "en_adopcion")}>En adopción</option><option value="en_refugio" ${selected("estado", "en_refugio")}>En refugio</option><option value="en_transito" ${selected("estado", "en_transito")}>En tránsito</option></select></div>` : ""}
    </div></details>
    <button class="button button-primary search-submit">Buscar ${icon("search")}</button>
  </form>`;
}

function searchView() {
  const pets = state.searchResults ?? state.pets;
  return `${sectionHeader("BUSCA Y ENCUENTRA", "Buscar mascotas", "Busca por nombre, especie o localidad. Los perfiles privados solo los pueden ver sus responsables.")}
    ${searchForm("buscar")}
    <div class="results-bar"><span><strong>${pets.length}</strong> ${pets.length === 1 ? "perfil público" : "perfiles públicos"}</span><span>La comunidad de Huellas</span></div>
    ${pets.length ? `<div class="cards-grid">${pets.map((pet) => petCard(pet, { favorite: state.favorites.has(pet.id) })).join("")}</div>` : emptyState({ icon: "search", title: "No hay perfiles públicos todavía", text: "Prueba con otros filtros o vuelve más tarde." })}`;
}

function favoritesView() {
  const pets = [
    ...(state.pets.length ? state.pets : previewPets),
    ...state.ownPets,
  ].filter(
    (pet, index, all) =>
      state.favorites.has(pet.id) &&
      all.findIndex((candidate) => candidate.id === pet.id) === index,
  );
  return `${sectionHeader("TU COLECCIÓN", "Guardados", "Perfiles que marcaste para volver a consultar.")}
    ${pets.length ? `<div class="cards-grid">${pets.map((pet) => petCard(pet, { mine: state.ownPets.some((ownPet) => ownPet.id === pet.id), demo: pet.id.startsWith("demo-"), favorite: true })).join("")}</div>` : emptyState({ icon: "heart", title: "Todavía no guardaste perfiles", text: "Pulsa el corazón de una mascota para tenerla a mano." })}`;
}

function petListView(kind) {
  const isLost = kind === "perdidas";
  const title = isLost ? "Buscando a su familia" : "Esperando un hogar";
  const description = isLost
    ? "Filtra por nombre, especie o localidad. Los avisos muestran una zona general para proteger a quienes cuidan."
    : "Conoce a las mascotas que buscan una familia responsable. El primer contacto se hace dentro de Huellas.";
  const pets = isLost ? state.lost : state.adoptions;
  const sectionAction = isLost
    ? `<div class="section-actions"><button class="button button-outline" data-view="adopcion">Ver adopciones</button><button class="button button-danger-soft" data-action="report-public">${icon("plus")} Publicar aviso</button></div>`
    : `<button class="button button-outline" data-view="perdidas">Avisos de pérdida</button>`;
  return `${sectionHeader(isLost ? "AYUDEMOS A ENCONTRAR" : "ADOPCIÓN RESPONSABLE", title, description, sectionAction)}
    ${searchForm(kind)}
    <div class="results-bar"><span><strong>${pets.length}</strong> ${pets.length === 1 ? "resultado" : "resultados"}</span><span>Resultados de la comunidad</span></div>
    ${pets.length ? `<div class="cards-grid">${pets.map((pet) => petCard(pet, { favorite: state.favorites.has(pet.id) })).join("")}</div>` : emptyState({ icon: isLost ? "search" : "house", title: isLost ? "No encontramos avisos con esos filtros" : "Aún no hay perfiles en adopción", text: isLost ? "Prueba con otra localidad o vuelve a buscar más tarde. Si estás buscando a una mascota, publica un aviso." : "Cuando un refugio o responsable publique un perfil, aparecerá acá." })}`;
}

function serviceIcon(category = "") {
  return icon(
    {
      veterinaria: "medical",
      guardia: "medical",
      tienda: "shop",
      peluqueria: "scissors",
      refugio: "house",
      guarderia: "house",
      escuela: "school",
      perrera: "house",
      parque: "location",
      pet_friendly: "heart",
      otro: "mapPin",
    }[category] || "mapPin",
  );
}

function servicesView() {
  const filters = state.serviceFilters;
  const categories = [
    "veterinaria",
    "guardia",
    "tienda",
    "peluqueria",
    "refugio",
    "guarderia",
    "escuela",
    "perrera",
    "parque",
    "pet_friendly",
    "otro",
  ];
  const categoryLabels = {
    veterinaria: "Veterinaria",
    guardia: "Guardia",
    tienda: "Tienda / pet shop",
    peluqueria: "Peluquería",
    refugio: "Refugio",
    guarderia: "Guardería",
    escuela: "Escuela / adiestramiento",
    perrera: "Perrera",
    parque: "Parque / plaza",
    pet_friendly: "Lugar pet friendly",
    otro: "Otro",
  };
  const cards = state.places
    .map((place) => {
      const rawLatitude = place.ubicacion?.latitud;
      const rawLongitude = place.ubicacion?.longitud;
      const latitude = Number(rawLatitude);
      const longitude = Number(rawLongitude);
      const hasCoordinates =
        rawLatitude !== undefined &&
        rawLatitude !== null &&
        rawLatitude !== "" &&
        rawLongitude !== undefined &&
        rawLongitude !== null &&
        rawLongitude !== "" &&
        Number.isFinite(latitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        Number.isFinite(longitude) &&
        longitude >= -180 &&
        longitude <= 180;
      const mapUrl = hasCoordinates
        ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`
        : "";
      const phone = typeof place.telefono === "string" ? place.telefono : "";
      const phoneHref = phone.replace(/[^\d+]/g, "");
      const email = typeof place.email === "string" ? place.email.trim() : "";
      const links = [
        mapUrl
          ? `<a href="${esc(mapUrl)}" target="_blank" rel="noopener noreferrer">Abrir mapa ${icon("arrowUpRight")}</a>`
          : "",
        place.comoLlegarUrl
          ? `<a href="${esc(place.comoLlegarUrl)}" target="_blank" rel="noopener noreferrer">Cómo llegar ${icon("arrowUpRight")}</a>`
          : "",
        phoneHref
          ? `<a href="tel:${esc(phoneHref)}">Llamar ${esc(phone)}</a>`
          : "",
        email
          ? `<a href="mailto:${encodeURIComponent(email)}">Enviar email</a>`
          : "",
      ]
        .filter(Boolean)
        .join("");
      const focusAction = hasCoordinates
        ? `<button class="button button-outline button-small" type="button" data-map-place-id="${esc(place.id)}">Ver en mapa</button>`
        : "";
      const address = [
        place.direccion,
        place.localidad,
        place.provincia,
        place.pais,
      ]
        .filter(Boolean)
        .join(", ");
      const ownerActions = place.propio
        ? `<button class="button button-cream button-small" data-action="edit-service" data-id="${esc(place.id)}">Editar</button><button class="button button-danger-soft button-delete button-small" data-action="delete-service" data-id="${esc(place.id)}">Eliminar</button>`
        : "";
      return `<article class="service-card">
        <span class="service-icon">${serviceIcon(place.categoria)}</span>
        <div class="service-copy">
          <h3>${esc(place.nombre)}</h3>
          <p>${esc(categoryLabels[place.categoria] || "Otro")} · ${esc(address)}</p>
          ${place.descripcion ? `<p>${esc(place.descripcion)}</p>` : ""}
          <div class="service-meta">
            ${place.guardia ? '<span class="tiny-pill">Guardia 24 h</span>' : ""}
            <span class="tiny-pill ${place.verificado ? "is-verified" : ""}">
              ${place.verificado ? "Verificado" : "Sin verificar por Huellas"}
            </span>
          </div>
          <div class="service-review-card-row"><span class="service-review-rating" aria-label="${place.resenas?.cantidad ? `${place.resenas.promedio} de 5 estrellas` : "Sin reseñas todavía"}">${place.resenas?.cantidad ? `★ ${esc(place.resenas.promedio)} <small>(${esc(place.resenas.cantidad)})</small>` : "Sin reseñas todavía"}</span><button class="button button-outline button-small" type="button" data-action="open-service-reviews" data-id="${esc(place.id)}">Ver reseñas y opinar</button></div>
          ${links || focusAction ? `<div class="service-actions">${links}${focusAction}</div>` : ""}
          ${ownerActions ? `<div class="service-owner-actions">${ownerActions}</div>` : ""}
        </div>
      </article>`;
    })
    .join("");
  const legend = categories
    .map(
      (category) =>
        `<span class="service-map-legend-item"><span class="service-map-legend-icon service-map-legend-icon--${category.replace(/_/g, "-")}">${serviceIcon(category)}</span>${esc(categoryLabels[category])}</span>`,
    )
    .join("");
  return `${sectionHeader("CERCA DE TU COMUNIDAD", "Servicios para ellos", "Encuentra veterinarias, tiendas, plazas, espacios pet friendly y más. Los puntos comunitarios aparecen identificados hasta ser verificados.", `<button class="button button-primary" data-action="${state.user ? "add-service" : "open-signup"}">${icon("plus")} Agregar lugar</button>`)}
    <form class="search-panel" data-form="search-services"><div class="search-control"><label for="service-category">Tipo de servicio</label><select id="service-category" name="categoria"><option value="" ${!filters.categoria ? "selected" : ""}>Todos</option>${categories.map((item) => `<option value="${item}" ${filters.categoria === item ? "selected" : ""}>${esc(categoryLabels[item])}</option>`).join("")}</select></div><div class="search-control"><label for="service-city">Localidad</label><input id="service-city" name="localidad" placeholder="Ciudad o barrio" value="${esc(filters.localidad || "")}"></div><div class="search-control"><label for="service-country">País</label><input id="service-country" name="pais" placeholder="País" value="${esc(filters.pais || "")}"></div><button class="button button-primary search-submit">Filtrar ${icon("search")}</button></form>
    <section class="services-explorer" aria-labelledby="services-map-title">
      <div class="services-explorer-heading"><div><span class="eyebrow">EXPLORÁ POR ZONA</span><h2 id="services-map-title">Mapa de servicios</h2><p>Todos los lugares de esta búsqueda, ubicados por categoría.</p></div><span class="service-map-count">${state.places.length} ${state.places.length === 1 ? "lugar" : "lugares"}</span></div>
      <div class="services-map-toolbar">
        <form class="services-map-search" data-service-map-search role="search"><label class="visually-hidden" for="services-map-search-input">Buscar zona o dirección</label><input id="services-map-search-input" name="ubicacion" type="search" autocomplete="off" placeholder="Buscar dirección, barrio o ciudad"><button class="button button-primary" type="submit">Buscar zona</button></form>
        <button class="button button-cream" type="button" data-services-map-location>Mi ubicación</button>
        <button class="button button-outline" type="button" data-services-map-fit>Ver todos</button>
      </div>
      <p class="services-map-feedback" data-service-map-feedback aria-live="polite">Explora el mapa, busca una zona o usa tu ubicación actual.</p>
      <div id="services-directory-map" class="services-map-canvas" role="application" aria-label="Mapa interactivo de servicios registrados"></div>
      <div class="services-map-legend" aria-label="Categorías del mapa">${legend}</div>
      <p class="services-map-note">Toca un marcador para ver el lugar y cómo llegar. Mapa y búsqueda de direcciones: OpenStreetMap.</p>
    </section>
    <div class="service-list">${cards || emptyState({ icon: "mapPin", title: "Todavía no hay servicios", text: "Prueba otra localidad o agrega una veterinaria, tienda, plaza o lugar pet friendly para ayudar a tu zona." })}</div>`;
}

function ownView() {
  if (!state.user)
    return `${sectionHeader("TU PERFIL", "Mis mascotas", "Registra y cuida todos sus datos en un solo lugar.")}${authPanel()}`;
  const pets = state.ownPets.length
    ? `<div class="cards-grid">${state.ownPets.map((pet) => petCard(pet, { mine: true, favorite: state.favorites.has(pet.id) })).join("")}</div>`
    : emptyPets(
        "paw",
        "Aún no agregaste mascotas",
        "Crea el primer perfil. Puedes sumar salud, identificación, ubicación, fotos y más.",
        "Registrar mascota",
        "open-pet",
      );
  const invites = state.invitations
    .map(
      (invite) =>
        `<article class="inbox-card"><div class="inbox-top"><strong>Invitación para cuidar a ${esc(invite.mascota?.nombre || "una mascota")}</strong><span>${esc(invite.rol)}</span></div><p>${esc(invite.mascota?.especie || "")} · El perfil se suma a tus mascotas cuando aceptes.</p><div class="inbox-actions"><button class="button button-primary button-small" data-action="accept-invite" data-id="${esc(invite.mascotaId)}">Aceptar invitación</button></div></article>`,
    )
    .join("");
  return `${sectionHeader("TU PERFIL", "Mis mascotas", "Sus datos y cuidados, siempre a mano.", `<button class="button button-primary" data-action="open-pet">${icon("plus")} Registrar mascota</button>`)}
    ${invites ? `<section class="soft-panel invite-panel"><div class="section-row"><div><h2>Invitaciones de cuidado</h2><p>Primero aceptas, luego tendrás acceso al perfil.</p></div></div><div class="inbox-list">${invites}</div></section>` : ""}
    <div class="results-bar"><span><strong>${state.ownPets.length}</strong> ${state.ownPets.length === 1 ? "mascota en tu perfil" : "mascotas en tu perfil"}</span><span>Los perfiles nuevos son privados hasta que los publiques.</span></div>${pets}`;
}

function accountView() {
  if (!state.user)
    return `${sectionHeader("TU CUENTA", "Ingresar a Huellas", "Guarda tus datos de manera privada y participa de la comunidad.")}${authPanel()}`;
  const requests = state.requests.length
    ? state.requests
        .map((request) => {
          const received = request.remitente !== null;
          const person = received
            ? request.remitente?.nombre || "Usuario registrado"
            : request.destinatario?.nombre || "Responsable de la mascota";
          const date = request.creadaEn
            ? new Date(request.creadaEn).toLocaleDateString("es-AR")
            : "";
          const stateLabel =
            request.estado === "pendiente"
              ? "Pendiente"
              : request.estado === "aceptada"
                ? "Aceptada"
                : "Rechazada";
          const actions =
            received && request.estado === "pendiente"
              ? `<div class="inbox-actions"><label><input type="checkbox" data-share-contact="${esc(request.id)}"> Compartir email y teléfono al aceptar</label><button class="button button-primary button-small" data-action="respond-contact" data-id="${esc(request.id)}" data-decision="aceptar">Aceptar</button><button class="button button-danger-soft button-small" data-action="respond-contact" data-id="${esc(request.id)}" data-decision="rechazar">Rechazar</button></div>`
              : !received && request.estado === "pendiente"
                ? `<div class="inbox-actions"><button class="button button-danger-soft button-small" data-action="cancel-request" data-id="${esc(request.id)}">Cancelar solicitud</button></div>`
                : request.estado === "aceptada" && request.compartirContacto
                  ? `<div class="inbox-actions"><button class="button button-outline button-small" data-action="contact-channels" data-id="${esc(request.id)}">Ver canales autorizados</button></div>`
                  : "";
          return `<article class="inbox-card"><div class="inbox-top"><strong>${received ? "Mensaje de" : "Solicitud enviada a"} ${esc(person)}</strong><span>${esc(stateLabel)}${date ? ` · ${esc(date)}` : ""}</span></div><p>${esc(request.mensaje)}</p>${actions}</article>`;
        })
        .join("")
    : emptyState({
        icon: "mail",
        title: "Tu bandeja está tranquila",
        text: "Los mensajes de contacto y sus permisos aparecerán acá.",
      });
  const profile = state.user;
  return `${sectionHeader(
    "TU CUENTA",
    `Hola, ${esc(profile.nombre.split(" ")[0])}`,
    "Revisa tu perfil y las solicitudes que enviaste o recibiste.",
  )}
    <div class="profile-grid">
      <section class="profile-panel">
        <h2>Tu perfil privado</h2>
        <div class="profile-details">
          <div class="profile-detail"><span>Nombre</span><strong>${esc(profile.nombre)}</strong></div>
          <div class="profile-detail"><span>Email de la cuenta</span><strong>${esc(profile.email)}</strong></div>
          <div class="profile-detail"><span>Teléfono</span><strong>${esc(profile.telefono || "No agregaste uno")}</strong></div>
          <div class="profile-detail"><span>Ubicación</span><strong>${esc([profile.localidad, profile.pais].filter(Boolean).join(", ") || "No informada")}</strong></div>
        </div>
        <div class="profile-actions">
          <button class="button button-cream button-small" data-action="edit-profile">Editar perfil</button>
          <button class="button button-cream button-small" data-action="change-password">Cambiar contraseña</button>
          <button class="button button-quiet button-small" data-action="logout">Cerrar sesión</button>
          <button class="button button-danger-soft button-delete button-small" data-action="delete-account">Eliminar cuenta</button>
        </div>
      </section>
      <section class="profile-panel">
        <div class="section-row"><div><h2>Mensajes y permisos</h2><p>Solo tú puedes revisar estas solicitudes.</p></div></div>
        <div class="inbox-list">${requests}</div>
      </section>
    </div>`;
}

// Explica el propósito de Huellas y responde dudas frecuentes sin salir de la app.
function aboutView() {
  return `${sectionHeader(
    "SOBRE HUELLAS",
    "Una red para que ninguna mascota quede sola",
    "Conectamos a quienes buscan, cuidan y ayudan para que la información útil esté más cerca.",
  )}
    <div class="about-page">
      <section class="about-intro">
        <div class="about-intro-mark">${icon("paw")}</div>
        <div>
          <div class="eyebrow">POR QUÉ EXISTE</div>
          <h2>El cuidado también se construye en comunidad.</h2>
          <p>Huellas nació para reunir en un mismo lugar a familias, refugios y personas dispuestas a ayudar. La idea es facilitar la búsqueda de mascotas, ordenar sus cuidados y acercar a quienes pueden colaborar.</p>
          <p>Queremos que pedir ayuda y ofrecerla sea claro, útil y respetuoso con la privacidad de cada persona.</p>
        </div>
      </section>

      <section class="about-section" aria-labelledby="about-how-title">
        <div class="about-section-heading">
          <div class="eyebrow">AYUDA RÁPIDA</div>
          <h2 id="about-how-title">¿Cómo funciona Huellas?</h2>
          <p>Podés empezar mirando avisos. Para publicar, escribir o compartir cuidados, creá una cuenta.</p>
        </div>
        <ol class="about-steps">
          <li class="about-step">
            <span class="about-step-number">01</span>
            <h3>Buscá o registrá</h3>
            <p>Explorá perfiles públicos o registrá una mascota para reunir sus datos y cuidados.</p>
          </li>
          <li class="about-step">
            <span class="about-step-number">02</span>
            <h3>Compartí lo necesario</h3>
            <p>Publicá un aviso o invitá a otra cuenta a colaborar en el cuidado de una mascota.</p>
          </li>
          <li class="about-step">
            <span class="about-step-number">03</span>
            <h3>Contactá con cuidado</h3>
            <p>Los mensajes empiezan dentro de Huellas. El email y el teléfono solo se comparten con autorización.</p>
          </li>
        </ol>
      </section>

      <section class="about-section" aria-labelledby="about-faq-title">
        <div class="about-section-heading">
          <div class="eyebrow">RESOLVÉ TUS DUDAS</div>
          <h2 id="about-faq-title">Ayuda y preguntas frecuentes</h2>
        </div>
        <div class="about-faq-list">
          <details class="about-faq-item">
            <summary>¿Necesito una cuenta para buscar?</summary>
            <p>No. Podés consultar avisos, perfiles públicos y servicios sin iniciar sesión. Necesitás una cuenta para publicar, enviar mensajes o administrar una mascota.</p>
          </details>
          <details class="about-faq-item">
            <summary>¿Qué información ve el resto de la comunidad?</summary>
            <p>Solo se muestran los datos elegidos para el perfil público y una ubicación general. La dirección exacta, los datos de contacto y la información privada quedan protegidos.</p>
          </details>
          <details class="about-faq-item">
            <summary>¿Cómo comparto el cuidado de una mascota?</summary>
            <p>Desde “Mis mascotas”, invitá a una cuenta existente. La otra persona debe aceptar antes de acceder al perfil compartido.</p>
          </details>
          <details class="about-faq-item">
            <summary>¿Dónde encuentro la documentación de la API?</summary>
            <p>La <a href="/ayuda">guía técnica de la API</a> incluye las rutas disponibles y ejemplos para probarlas.</p>
          </details>
        </div>
      </section>

      <section class="about-cta">
        <div>
          <div class="eyebrow">SUMATE A LA RED</div>
          <h2>Una búsqueda compartida puede llegar más lejos.</h2>
        </div>
        <button class="button button-primary" data-view="buscar">Explorar mascotas ${icon("arrowRight")}</button>
      </section>
    </div>`;
}

// Actualiza la pantalla y la entrada correspondiente del historial del navegador.
function render(historyMode = "auto") {
  syncLocation(historyMode);
  closeNav();
  topActions();
  const shell = document.querySelector(".app-shell");
  shell.classList.toggle("has-session", Boolean(state.user));
  shell.classList.toggle("is-publishing", state.view === "publicar");
  shell.classList.toggle("is-pet-detail", state.view === "ficha");
  document.body.classList.toggle("is-publishing", state.view === "publicar");
  document.body.classList.toggle("is-pet-detail", state.view === "ficha");
  const views = {
    inicio: () => (state.user ? dashboardView() : homeView()),
    buscar: searchView,
    guardados: favoritesView,
    perdidas: () => petListView("perdidas"),
    adopcion: () => petListView("adopcion"),
    servicios: servicesView,
    publicar: publishView,
    ficha: petDetailView,
    mias: ownView,
    cuenta: accountView,
    sobre: aboutView,
  };
  const page = (views[state.view] || homeView)();
  disposeServiceMaps(content);
  disposeControls(content);
  liberarFotos(content);
  content.innerHTML = page;
  enhanceControls(content);
  cargarFotos(content);
  if (state.view === "servicios")
    mountServicesDirectoryMap(content, state.places);
  const publishPhotoInput = content.querySelector(
    'form[data-form="publish-notice"] input[name="fotosArchivos"]',
  );
  if (
    publishPhotoInput &&
    state.publishPhotoFiles.length > 0 &&
    typeof DataTransfer === "function"
  ) {
    const transfer = new DataTransfer();
    state.publishPhotoFiles.forEach((file) => transfer.items.add(file));
    publishPhotoInput.files = transfer.files;
    if (state.publishPhotosUploaded.length > 0) {
      publishPhotoInput.form.dataset.fotosSubidas = JSON.stringify(
        state.publishPhotosUploaded,
      );
    }
  }
}

// Recarga de resultados públicos y privados después de cambios o acciones.
async function reloadPublic() {
  const [pets, places] = await Promise.all([api("/mascotas"), api("/lugares")]);
  state.pets = pets;
  state.lost = pets.filter((pet) => pet.estado === "perdida");
  state.adoptions = pets.filter((pet) => pet.estado === "en_adopcion");
  state.places = places;
  state.allPlaces = places;
}

async function reloadPrivate() {
  if (!hasToken()) {
    state.user = null;
    state.ownPets = [];
    state.requests = [];
    state.invitations = [];
    return;
  }
  const [profile, pets, requests, invitations] = await Promise.all([
    api("/usuarios/me"),
    api("/mascotas/propias"),
    api("/contacto/solicitudes"),
    api("/mascotas/invitaciones"),
  ]);
  state.user = profile.usuario;
  state.ownPets = pets;
  state.requests = requests;
  state.invitations = invitations;
}

async function refreshAll() {
  try {
    await reloadPublic();
    await reloadPrivate();
    render();
    return true;
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      state.user = null;
      limpiarPropiedadServicios();
      state.ownPets = [];
      state.requests = [];
      state.invitations = [];
      render();
    }
    showNotice(error.message, true);
    return false;
  }
}

// Diálogos de cuenta, edición de mascotas, avisos y servicios.
function authDialog(mode = "login") {
  const signup = mode === "signup";
  openModal(`<div class="modal-inner"><p class="modal-kicker">${signup ? "SÚMATE A LA RED" : "QUÉ BUENO VERTE"}</p><h2>${signup ? "Crea tu cuenta" : "Ingresa a Huellas"}</h2><p class="modal-intro">${signup ? "Con una cuenta puedes cuidar tus perfiles, publicar avisos y compartir responsabilidades." : "Inicia sesión para administrar mascotas y mensajes."}</p>
    <form data-form="${signup ? "signup" : "login"}"><div class="form-grid">
      ${signup ? '<div class="field full"><label for="auth-name">Tu nombre</label><input id="auth-name" name="nombre" required autocomplete="name" placeholder="Nombre y apellido"></div>' : ""}
      <div class="field full"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" required autocomplete="email" placeholder="vos@ejemplo.com"></div>
      <div class="field full"><label for="auth-password">Contraseña</label><input id="auth-password" name="contrasena" type="password" required minlength="${signup ? 12 : 1}" maxlength="128" autocomplete="${signup ? "new-password" : "current-password"}" placeholder="${signup ? "Al menos 12 caracteres" : "Tu contraseña"}">${signup ? '<span class="help-text">Usa una frase larga y única, de al menos 12 caracteres.</span>' : ""}</div>
      ${signup ? '<div class="field"><label for="auth-country">País (opcional)</label><input id="auth-country" name="pais" autocomplete="country-name" placeholder="Argentina"></div><div class="field"><label for="auth-city">Localidad (opcional)</label><input id="auth-city" name="localidad" autocomplete="address-level2" placeholder="Buenos Aires"></div>' : ""}
    </div><p class="modal-error" data-error hidden></p><div class="form-footer"><button type="button" class="button button-cream" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">${signup ? "Crear cuenta" : "Ingresar"} ${icon("arrowRight")}</button></div></form>
    <div class="form-switch">${signup ? "¿Ya tienes cuenta?" : "¿Primera vez acá?"} <button type="button" data-action="${signup ? "open-login" : "open-signup"}">${signup ? "Ingresar" : "Crear una cuenta"}</button></div></div>`);
}

function petDialog(pet = null) {
  const editing = Boolean(pet);
  const value = (key) => esc(pet?.[key] ?? "");
  const isSelected = (key, option) =>
    (pet?.[key] || "") === option ? "selected" : "";
  const speciesOptions = ["Perro", "Gato", "Ave", "Conejo", "Tortuga", "Otra"];
  if (pet?.especie && !speciesOptions.includes(pet.especie))
    speciesOptions.push(pet.especie);
  const colors = pet?.colores?.join(", ") || pet?.color || "";
  const existingPhotos = Array.isArray(pet?.fotos)
    ? pet.fotos
        .map((foto) => photoUrl({ fotos: [foto] }))
        .filter(Boolean)
    : [];
  const vaccinated = pet?.salud?.vacunado;
  const sterilized = pet?.salud?.esterilizada;
  const additionalData = Boolean(
    pet &&
    (pet.fechaNacimiento ||
      pet.identificacion?.microchip ||
      sterilized !== undefined ||
      pet.salud?.alergias ||
      pet.salud?.medicamentos ||
      pet.salud?.observaciones ||
      pet.senasParticulares ||
      pet.comportamiento?.temperamento ||
      pet.comportamiento?.convivencia),
  );
  openModal(`<div class="modal-inner"><p class="modal-kicker">${editing ? "ACTUALIZAR EL PERFIL" : "UN NUEVO PERFIL"}</p><h2>${editing ? `Editar a ${esc(pet.nombre)}` : "Cuéntanos sobre tu mascota"}</h2><p class="modal-intro">Solo tú y quienes invites podrán ver el perfil. Tú eliges si publicarlo.</p>
    <form data-form="${editing ? "update-pet" : "create-pet"}" ${editing ? `data-id="${esc(pet.id)}"` : ""}><div class="form-grid">
      <div class="field"><label for="pet-name">Nombre *</label><input id="pet-name" name="nombre" required placeholder="Luna" value="${value("nombre")}"></div>
      <div class="field"><label for="pet-species">Especie *</label><select id="pet-species" name="especie" required><option value="">Elige una</option>${speciesOptions.map((option) => `<option ${isSelected("especie", option)}>${esc(option)}</option>`).join("")}</select></div>
      <div class="field"><label for="pet-breed">Raza</label><input id="pet-breed" name="raza" placeholder="Caniche, mestizo…" value="${value("raza")}"></div>
      <div class="field"><label for="pet-age">Edad aproximada (años)</label><input id="pet-age" name="edad" type="number" min="0" step="1" placeholder="3" value="${value("edad")}"></div>
      <div class="field"><label for="pet-sex">Sexo</label><select id="pet-sex" name="sexo"><option value="">Sin especificar</option><option ${isSelected("sexo", "Hembra")}>Hembra</option><option ${isSelected("sexo", "Macho")}>Macho</option></select></div>
      <div class="field"><label for="pet-size">Tamaño</label><select id="pet-size" name="tamano"><option value="">Sin especificar</option><option ${isSelected("tamano", "Pequeño")}>Pequeño</option><option ${isSelected("tamano", "Mediano")}>Mediano</option><option ${isSelected("tamano", "Grande")}>Grande</option></select></div>
      <div class="field"><label for="pet-colors">Colores</label><input id="pet-colors" name="colores" placeholder="blanco, marrón" value="${esc(colors)}"></div>
      <div class="field"><label for="pet-city">Localidad</label><input id="pet-city" name="localidad" placeholder="Buenos Aires" value="${esc(pet?.ubicacion?.localidad || "")}"></div>
      <div class="field"><label for="pet-country">País</label><input id="pet-country" name="pais" placeholder="Argentina" value="${esc(pet?.ubicacion?.pais || "")}"></div>
      <div class="field"><label for="pet-vaccinated">Vacunación</label><select id="pet-vaccinated" name="vacunado"><option value="" ${vaccinated === undefined ? "selected" : ""}>Sin informar</option><option value="true" ${vaccinated === true ? "selected" : ""}>Al día</option><option value="false" ${vaccinated === false ? "selected" : ""}>Pendiente</option></select></div>
      <details class="advanced-search pet-extra-fields" ${additionalData ? "open" : ""}><summary>Más datos del registro${additionalData ? " · ya completados" : ""}</summary><div class="advanced-search-grid">
        <div class="field"><label for="pet-birth">Fecha de nacimiento</label><input id="pet-birth" name="fechaNacimiento" type="date" value="${value("fechaNacimiento")}"></div>
        <div class="field"><label for="pet-microchip">Microchip o identificación</label><input id="pet-microchip" name="microchip" value="${esc(pet?.identificacion?.microchip || "")}" placeholder="Número de identificación"></div>
        <div class="field"><label for="pet-sterilized">Castración / esterilización</label><select id="pet-sterilized" name="esterilizada"><option value="" ${sterilized === undefined ? "selected" : ""}>Sin informar</option><option value="true" ${sterilized === true ? "selected" : ""}>Sí</option><option value="false" ${sterilized === false ? "selected" : ""}>No</option></select></div>
        <div class="field"><label for="pet-allergies">Alergias</label><input id="pet-allergies" name="alergias" value="${esc(pet?.salud?.alergias || "")}" placeholder="Si tiene"></div>
        <div class="field"><label for="pet-medications">Medicación</label><input id="pet-medications" name="medicamentos" value="${esc(pet?.salud?.medicamentos || "")}" placeholder="Si toma alguna"></div>
        <div class="field"><label for="pet-marks">Señas particulares</label><input id="pet-marks" name="senasParticulares" value="${value("senasParticulares")}" placeholder="Manchas, collar, cicatrices"></div>
        <div class="field"><label for="pet-temperament">Temperamento</label><input id="pet-temperament" name="temperamento" value="${esc(pet?.comportamiento?.temperamento || "")}" placeholder="Tranquila, sociable"></div>
        <div class="field"><label for="pet-cohabitation">Convivencia</label><input id="pet-cohabitation" name="convivencia" value="${esc(pet?.comportamiento?.convivencia || "")}" placeholder="Niños, otros animales"></div>
        <div class="field full"><label for="pet-health-notes">Notas de salud</label><textarea id="pet-health-notes" name="observacionesSalud" placeholder="Cuidados o antecedentes que quieras recordar">${esc(pet?.salud?.observaciones || "")}</textarea></div>
      </div></details>
      <div class="field full"><label for="pet-description">Descripción</label><textarea id="pet-description" name="descripcion" placeholder="Cuéntanos algo más sobre tu mascota">${value("descripcion")}</textarea></div>
      <div class="field full pet-photo-field"><label for="pet-photos">Fotos de la mascota (opcional)</label><input id="pet-photos" name="fotosArchivos" type="file" accept="image/jpeg,image/png,image/webp" multiple><span class="help-text">JPG, PNG o WebP · hasta 5 fotos de 5 MB cada una.</span>${existingPhotos.length ? `<div class="pet-photo-preview" aria-label="Fotos guardadas">${existingPhotos.map((url, index) => `<img data-photo-url="${esc(url)}" alt="Foto ${index + 1} de ${esc(pet.nombre)}" loading="lazy">`).join("")}</div>` : ""}</div>
      <div class="field full"><label class="check-row"><input type="checkbox" name="publicar" ${pet?.publicar ? "checked" : ""}><span>Publicar el perfil para que aparezca en búsquedas. Los datos personales y de contacto siguen privados.</span></label></div>
    </div><p class="modal-error" data-error hidden></p><div class="form-footer"><button type="button" class="button button-cream" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">${editing ? "Guardar cambios" : "Guardar perfil"} ${icon("arrowRight")}</button></div></form></div>`);
}

function lossDialog(petId = "") {
  openModal(`<div class="modal-inner"><p class="modal-kicker">ACTIVEMOS LA BÚSQUEDA</p><h2>Publicar aviso de pérdida</h2><p class="modal-intro">Publicaremos la zona general. La ubicación exacta no aparece en el perfil público.</p>
    <form data-form="report-loss" data-id="${esc(petId)}"><div class="form-grid">
      ${petId ? "" : `<div class="field full"><label for="lost-pet">Mascota de tu perfil</label><select id="lost-pet" name="mascotaId" required>${state.ownPets.map((pet) => `<option value="${esc(pet.id)}">${esc(pet.nombre)} · ${esc(pet.especie)}</option>`).join("")}</select></div>`}
      <div class="field"><label for="lost-city">Localidad o zona *</label><input id="lost-city" name="localidad" required placeholder="Palermo, Buenos Aires"></div>
      <div class="field"><label for="lost-province">Provincia</label><input id="lost-province" name="provincia" placeholder="Buenos Aires"></div>
      <div class="field"><label for="lost-country">País</label><input id="lost-country" name="pais" placeholder="Argentina"></div>
      <div class="field"><label for="lost-date">¿Cuándo se perdió?</label><input id="lost-date" name="fecha" type="date"></div>
      <div class="field full"><label for="lost-description">¿Qué pasó? ¿Cómo ayudar?</label><textarea id="lost-description" name="descripcion" placeholder="Última vez que la vieron, señas, recomendaciones…"></textarea></div>
    </div><p class="modal-error" data-error hidden></p><div class="form-footer"><button type="button" class="button button-cream" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">Publicar aviso ${icon("arrowRight")}</button></div></form></div>`);
}

function publicPetDialog(petId) {
  const pet = [
    ...state.pets,
    ...state.ownPets,
    ...state.lost,
    ...state.adoptions,
    ...(state.searchResults || []),
  ].find((item) => item.id === petId);
  if (!pet)
    return showNotice(
      "No pudimos abrir este perfil. Actualiza la búsqueda e inténtalo de nuevo.",
      true,
    );
  state.previousView = state.view;
  state.selectedPetId = petId;
  state.petTab = "informacion";
  state.view = "ficha";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function petDetailView() {
  const pet = [
    ...state.ownPets,
    ...state.pets,
    ...state.lost,
    ...state.adoptions,
    ...(state.searchResults || []),
    ...(state.routePet ? [state.routePet] : []),
  ].find((item) => item.id === state.selectedPetId);
  if (!pet)
    return `${sectionHeader("FICHA", "No encontramos esta mascota", "Vuelve a la búsqueda e inténtalo otra vez.", '<button class="button button-cream" data-action="back-from-pet">Volver</button>')}`;
  const isMine = state.ownPets.some((item) => item.id === pet.id);
  const photos = Array.isArray(pet.fotos)
    ? pet.fotos.map((foto) => photoUrl({ fotos: [foto] })).filter(Boolean)
    : [];
  const coverPhoto = photos[0]
    ? `<img data-photo-url="${esc(photos[0])}" alt="Foto de ${esc(pet.nombre)}" loading="lazy">`
    : `<div class="photo-empty">${icon("paw")}<span>Aún no hay fotos</span></div>`;
  const locationText =
    [
      pet.reportePerdida?.localidad,
      pet.reportePerdida?.provincia,
      pet.reportePerdida?.pais,
    ]
      .filter(Boolean)
      .join(", ") ||
    [pet.ubicacion?.localidad, pet.ubicacion?.provincia, pet.ubicacion?.pais]
      .filter(Boolean)
      .join(", ");
  const facts = [
    ["Especie", pet.especie],
    ["Raza", pet.raza],
    [
      "Edad",
      pet.edad === undefined
        ? ""
        : `${pet.edad} ${Number(pet.edad) === 1 ? "año" : "años"}`,
    ],
    ["Sexo", pet.sexo],
    ["Tamaño", pet.tamano],
    [
      "Colores",
      Array.isArray(pet.colores) ? pet.colores.join(", ") : pet.color,
    ],
    ["Ubicación aproximada", locationText],
  ];
  const infoContent = `<dl class="public-pet-details">${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value || "Sin informar")}</dd></div>`).join("")}</dl>
    ${pet.reportePerdida?.descripcion ? `<section class="public-pet-notes"><h3>Información del aviso</h3><p>${esc(pet.reportePerdida.descripcion)}</p></section>` : ""}
    ${pet.senasParticulares ? `<section class="public-pet-notes"><h3>Señas particulares</h3><p>${esc(pet.senasParticulares)}</p></section>` : ""}
    ${pet.descripcion ? `<section class="public-pet-notes"><h3>Sobre ${esc(pet.nombre)}</h3><p>${esc(pet.descripcion)}</p></section>` : ""}`;
  const healthFacts = [
    [
      "Vacunación",
      pet.salud?.vacunado === true
        ? "Al día"
        : pet.salud?.vacunado === false
          ? "Pendiente"
          : "Sin informar",
    ],
    [
      "Esterilización",
      pet.salud?.esterilizada === true
        ? "Sí"
        : pet.salud?.esterilizada === false
          ? "No"
          : "Sin informar",
    ],
    ...(isMine
      ? [
          ["Microchip", pet.identificacion?.microchip],
          ["Alergias", pet.salud?.alergias],
          ["Medicación", pet.salud?.medicamentos],
          ["Notas de salud", pet.salud?.observaciones],
        ]
      : []),
  ];
  const healthContent = `<dl class="public-pet-details">${healthFacts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value || "Sin informar")}</dd></div>`).join("")}</dl>
    ${!isMine ? '<p class="pet-detail-private-note">La persona responsable decide qué información médica comparte en su perfil público.</p>' : ""}`;
  const contactContent = isMine
    ? `<section class="public-pet-notes"><h3>Compartí el cuidado</h3><p>Invita a una persona de confianza. Solo verá la ficha después de aceptar.</p><button class="button button-primary" data-action="share-pet" data-id="${esc(pet.id)}">Compartir cuidado</button></section>`
    : `<section class="public-pet-notes"><h3>Contacta a quien la cuida</h3><p>El primer mensaje queda dentro de Huellas. Email y teléfono siguen privados hasta que la otra persona lo autorice.</p></section>`;
  const tabs = [
    ["informacion", "Información"],
    ["salud", "Salud"],
    ["contacto", "Contacto"],
  ];
  const tabContent =
    state.petTab === "salud"
      ? healthContent
      : state.petTab === "contacto"
        ? contactContent
        : infoContent;
  return `<section class="pet-detail-page">
    <div class="pet-detail-topbar"><button class="icon-button" data-action="back-from-pet" aria-label="Volver">${icon("arrowRight")}</button><strong>Ficha de mascota</strong><button class="favorite-toggle ${state.favorites.has(pet.id) ? "is-saved" : ""}" data-action="toggle-favorite" data-id="${esc(pet.id)}" aria-label="${state.favorites.has(pet.id) ? "Quitar de guardados" : "Guardar mascota"}" aria-pressed="${state.favorites.has(pet.id)}">${icon("heart")}</button></div>
    <div class="pet-detail-photo" aria-label="Foto de ${esc(pet.nombre)}">${coverPhoto}</div>
    ${photos.length > 1 ? `<div class="pet-detail-gallery" aria-label="Más fotos de ${esc(pet.nombre)}">${photos.slice(1).map((url, index) => `<img data-photo-url="${esc(url)}" alt="Foto ${index + 2} de ${esc(pet.nombre)}" loading="lazy">`).join("")}</div>` : ""}
    <div class="pet-detail-heading"><div><h1>${esc(pet.nombre)}</h1><p>${[pet.raza, pet.sexo, pet.edad !== undefined ? `${pet.edad} ${Number(pet.edad) === 1 ? "año" : "años"}` : "", locationText].filter(Boolean).map(esc).join(" · ")}</p></div><span class="pet-status-label">${esc(statusLabel(pet.estado))}</span></div>
    <nav class="pet-detail-tabs" aria-label="Ficha de mascota">${tabs.map(([id, label]) => `<button data-action="select-pet-tab" data-state="${id}" class="${state.petTab === id ? "is-active" : ""}" aria-current="${state.petTab === id ? "page" : "false"}">${label}</button>`).join("")}</nav>
    <section class="pet-detail-content">${tabContent}</section>
    ${!isMine && state.petTab !== "contacto" ? `<div class="pet-detail-bottom"><button class="button button-primary" data-action="contact" data-id="${esc(pet.id)}">Solicitar contacto</button></div>` : ""}
    ${!isMine && state.petTab === "contacto" ? `<div class="pet-detail-bottom"><button class="button button-primary" data-action="contact" data-id="${esc(pet.id)}">Solicitar contacto</button></div>` : ""}
  </section>`;
}

function publishView() {
  const draft = state.publishDraft || {};
  const selectedPetId = draft.mascotaId || state.ownPets[0]?.id || "__new__";
  const isNew = selectedPetId === "__new__";
  const selectedPet = state.ownPets.find((pet) => pet.id === selectedPetId);
  const existingPhoto = photoUrl(selectedPet || {});
  const types = [
    ["perdida", "Perdida"],
    ["encontrada", "Encontrada"],
    ["en_adopcion", "Adopción"],
  ];
  const localityLabel =
    state.publishType === "perdida" ? "¿Dónde se perdió? *" : "Localidad";
  const publishButton =
    state.publishType === "perdida"
      ? "Publicar aviso"
      : state.publishType === "encontrada"
        ? "Publicar mascota encontrada"
        : "Publicar en adopción";
  return `<section class="publish-page">
    <div class="publish-heading"><div><h1>Publicar un aviso</h1><p>Compartí la información sobre tu mascota.</p></div><button class="button button-cream publish-back" data-action="back-from-publish">Volver</button></div>
    <form class="publish-form" data-form="publish-notice" data-created-pet-id="${esc(draft.createdPetId || "")}">
      <nav class="publish-tabs" aria-label="Tipo de aviso">${types.map(([value, label]) => `<button type="button" data-action="select-publish-type" data-state="${value}" class="${state.publishType === value ? "is-active" : ""}" aria-pressed="${state.publishType === value}">${label}</button>`).join("")}</nav>
      <div class="publish-form-layout">
          <div class="publish-photo-slot">
            ${existingPhoto ? `<img data-photo-url="${esc(existingPhoto)}" alt="Foto de ${esc(selectedPet.nombre)}" loading="lazy">` : `<div class="photo-slot-mark">${icon("plus")}</div>`}
            <label for="publish-photos">Agregar fotos de la mascota</label>
            <input id="publish-photos" name="fotosArchivos" type="file" accept="image/jpeg,image/png,image/webp" multiple>
            <span>Opcional · JPG, PNG o WebP · hasta 5 fotos de 5 MB cada una.</span>
          </div>
        <div class="publish-fields">
          <div class="field full"><label for="publish-pet">Mascota</label><select id="publish-pet" name="mascotaId">${state.ownPets.map((pet) => `<option value="${esc(pet.id)}" ${selectedPetId === pet.id ? "selected" : ""}>${esc(pet.nombre)} · ${esc(pet.especie)}</option>`).join("")}<option value="__new__" ${isNew ? "selected" : ""}>Registrar una mascota nueva</option></select></div>
          <div class="publish-new-pet-fields" data-new-pet-fields ${isNew ? "" : "hidden"}>
            <div class="field"><label for="publish-name">Nombre</label><input id="publish-name" name="nombre" value="${esc(draft.nombre || "")}" placeholder="Si no tiene, puedes dejarlo vacío"></div>
            <div class="field"><label for="publish-species">Especie *</label><select id="publish-species" name="especie" ${isNew ? "required" : ""}><option value="">Elige una</option>${["Perro", "Gato", "Ave", "Conejo", "Tortuga", "Otra"].map((species) => `<option ${draft.especie === species ? "selected" : ""}>${species}</option>`).join("")}</select></div>
            <div class="field"><label for="publish-breed">Raza</label><input id="publish-breed" name="raza" value="${esc(draft.raza || "")}" placeholder="Opcional"></div>
            <div class="field"><label for="publish-age">Edad aproximada</label><input id="publish-age" name="edad" type="number" min="0" step="1" value="${esc(draft.edad || "")}" placeholder="Años"></div>
          </div>
          <div class="field"><label for="publish-city">${localityLabel}</label><input id="publish-city" name="localidad" value="${esc(draft.localidad || "")}" ${state.publishType === "perdida" ? "required" : ""} placeholder="Barrio o ciudad"></div>
          <div class="field"><label for="publish-country">País</label><input id="publish-country" name="pais" value="${esc(draft.pais || "")}" placeholder="País"></div>
          ${state.publishType === "perdida" ? `<div class="field"><label for="publish-date">Fecha en que se perdió</label><input id="publish-date" name="fecha" type="date" value="${esc(draft.fecha || "")}"></div>` : ""}
          <div class="field full"><label for="publish-description">Descripción y señas particulares</label><textarea id="publish-description" name="descripcion" placeholder="Color, collar, última vez que la vieron y cómo ayudar">${esc(draft.descripcion || "")}</textarea></div>
        </div>
      </div>
      <p class="modal-error publish-error" data-error hidden></p>
      <div class="publish-submit-row"><button class="button button-primary" type="submit">${publishButton}</button></div>
    </form>
  </section>`;
}

function contactDialog(petId) {
  const pet =
    state.pets.find((item) => item.id === petId) ||
    state.lost.find((item) => item.id === petId) ||
    state.adoptions.find((item) => item.id === petId);
  if (!state.user) return authDialog("login");
  openModal(`<div class="modal-inner"><p class="modal-kicker">MENSAJE PRIVADO</p><h2>Escríbele a ${esc(pet?.responsable?.nombre || "la persona responsable")}</h2><p class="modal-intro">Tu primer mensaje llega dentro de Huellas. Email y teléfono no se comparten sin permiso.</p>
    <form data-form="contact" data-id="${esc(petId)}"><div class="field"><label for="contact-message">Tu mensaje</label><textarea id="contact-message" name="mensaje" required minlength="10" maxlength="1000" placeholder="Hola, vi el aviso y quisiera ayudar…"></textarea><span class="help-text">Cuenta brevemente cómo puedes ayudar (mínimo 10 caracteres).</span></div><p class="modal-error" data-error hidden></p><div class="form-footer"><button type="button" class="button button-cream" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">Enviar mensaje ${icon("arrowRight")}</button></div></form></div>`);
}

function serviceDialog(place = null) {
  const editing = Boolean(place);
  const location = place?.ubicacion || {};
  const categories = [
    ["veterinaria", "Veterinaria"],
    ["guardia", "Guardia"],
    ["tienda", "Tienda / pet shop"],
    ["peluqueria", "Peluquería"],
    ["refugio", "Refugio"],
    ["guarderia", "Guardería"],
    ["escuela", "Escuela / adiestramiento"],
    ["perrera", "Perrera"],
    ["parque", "Parque / plaza"],
    ["pet_friendly", "Lugar pet friendly"],
    ["otro", "Otro"],
  ];
  const value = (field) => esc(place?.[field] || "");
  openModal(`<div class="modal-inner"><p class="modal-kicker">UN PUNTO QUE PUEDE AYUDAR</p><h2>${editing ? "Editar servicio" : "Agregar servicio al mapa"}</h2><p class="modal-intro">${editing ? "Actualiza la información pública de este lugar." : "Los nuevos aportes se muestran como comunitarios hasta que puedan verificarse."}</p>
    <form data-form="${editing ? "update-service" : "create-service"}" ${editing ? `data-id="${esc(place.id)}"` : ""}><div class="form-grid">
      <div class="field full"><label for="place-name">Nombre del lugar *</label><input id="place-name" name="nombre" required value="${value("nombre")}" placeholder="Veterinaria del Parque"></div>
      <div class="field"><label for="place-category">Tipo *</label><select id="place-category" name="categoria">${categories.map(([category, label]) => `<option value="${category}" ${place?.categoria === category ? "selected" : ""}>${label}</option>`).join("")}</select></div>
      <div class="field"><label for="place-phone">Teléfono público</label><input id="place-phone" name="telefono" type="tel" value="${value("telefono")}" placeholder="Solo del negocio"></div>
      <div class="field full"><label for="place-description">Descripción</label><textarea id="place-description" name="descripcion" rows="2">${value("descripcion")}</textarea></div>
      <div class="field full"><label for="place-address">Dirección</label><input id="place-address" name="direccion" value="${value("direccion")}" placeholder="Calle y número"></div>
      <div class="field"><label for="place-city">Localidad *</label><input id="place-city" name="localidad" required value="${value("localidad")}" placeholder="Buenos Aires"></div>
      <div class="field"><label for="place-province">Provincia</label><input id="place-province" name="provincia" value="${value("provincia")}"></div>
      <div class="field"><label for="place-country">País *</label><input id="place-country" name="pais" required value="${value("pais")}" placeholder="Argentina"></div>
      <div class="field"><label for="place-email">Email público</label><input id="place-email" name="email" type="email" value="${value("email")}"></div>
      <div class="field full place-location-picker">
        <div class="place-picker-heading"><div><strong>Ubicación en el mapa *</strong><span>Busca la dirección o toca el mapa para colocar el pin.</span></div><button class="button button-cream button-small" type="button" data-place-locate>Ubicar dirección</button></div>
        <p class="services-map-feedback" data-service-map-feedback aria-live="polite">${editing ? "Ubicación guardada. Toca o arrastra el pin para ajustarla." : "Completa la dirección y el mapa te ayuda a encontrar el lugar."}</p>
        <div id="place-location-map" class="place-picker-map" role="application" aria-label="Elige la ubicación del servicio en el mapa"></div>
        <input type="hidden" name="latitud" value="${esc(location.latitud ?? "")}">
        <input type="hidden" name="longitud" value="${esc(location.longitud ?? "")}">
      </div>
      <div class="field full"><label class="check-row"><input type="checkbox" name="guardia" ${place?.guardia ? "checked" : ""}><span>Este lugar tiene servicio de guardia</span></label></div>
    </div><p class="modal-error" data-error hidden></p><div class="form-footer"><button type="button" class="button button-cream" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">${editing ? "Guardar cambios" : "Agregar punto"} ${icon("arrowRight")}</button></div></form></div>`);
  mountServiceLocationPicker(modalContent);
}

// Abre la ficha comunitaria con calificaciones y opiniones del servicio.
async function serviceReviewsDialog(placeId) {
  const id = String(placeId);
  const place = state.places.find((item) => String(item.id) === id);
  if (!place) {
    showNotice("No encontré ese servicio en la lista actual.", true);
    return;
  }
  const categoryNames = {
    veterinaria: "Veterinaria",
    guardia: "Guardia",
    tienda: "Tienda / pet shop",
    peluqueria: "Peluquería",
    refugio: "Refugio",
    guarderia: "Guardería",
    escuela: "Escuela / adiestramiento",
    perrera: "Perrera",
    parque: "Parque / plaza",
    pet_friendly: "Lugar pet friendly",
    otro: "Otro",
  };
  const reviewDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ""
      : new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(date);
  };

  openModal(`<div class="modal-inner service-reviews-dialog"><p class="modal-kicker">EXPERIENCIAS DE LA COMUNIDAD</p><h2>${esc(place.nombre)}</h2><p class="modal-intro">${esc(categoryNames[place.categoria] || "Servicio")} · ${esc([place.localidad, place.provincia, place.pais].filter(Boolean).join(", "))}</p><p class="service-reviews-loading" aria-live="polite">Cargando reseñas…</p></div>`);
  try {
    const result = await api(`/lugares/${encodeURIComponent(id)}/resenas`);
    const ownReview = result.miResena;
    const reviews = result.resenas
      .map((review) => `<article class="service-review"><div class="service-review-heading"><strong>${esc(review.autor)}</strong><span class="service-review-stars" aria-label="${esc(review.puntuacion)} de 5 estrellas">${"★".repeat(review.puntuacion)}${"☆".repeat(5 - review.puntuacion)}</span></div><time datetime="${esc(review.creadoEn)}">${esc(reviewDate(review.creadoEn))}</time>${review.comentario ? `<p>${esc(review.comentario)}</p>` : "<p class=\"service-review-empty-comment\">Solo dejó su puntuación.</p>"}</article>`)
      .join("");
    const formMarkup = state.user
      ? `<section class="service-review-form-section"><h3>${ownReview ? "Editar tu reseña" : "¿Cómo fue tu experiencia?"}</h3><p>Comparte qué servicio recibiste para ayudar a otras personas a decidir.</p><form data-form="${ownReview ? "update-service-review" : "create-service-review"}" data-id="${esc(id)}" ${ownReview ? `data-review-id="${esc(ownReview.id)}"` : ""}><div class="form-grid"><div class="field full"><label for="service-review-rating">Tu calificación</label><select id="service-review-rating" name="puntuacion" required><option value="" disabled ${ownReview ? "" : "selected"}>Elige de 1 a 5 estrellas</option>${[5, 4, 3, 2, 1].map((rating) => `<option value="${rating}" ${ownReview?.puntuacion === rating ? "selected" : ""}>${"★".repeat(rating)}${"☆".repeat(5 - rating)} · ${rating} ${rating === 1 ? "estrella" : "estrellas"}</option>`).join("")}</select></div><div class="field full"><label for="service-review-comment">Tu experiencia (opcional)</label><textarea id="service-review-comment" name="comentario" rows="3" maxlength="1200" placeholder="Cuéntanos cómo te atendieron, qué servicio recibiste o qué conviene saber…">${esc(ownReview?.comentario || "")}</textarea><span class="help-text">Máximo 1200 caracteres. Evita incluir datos personales.</span></div></div><p class="modal-error" data-error hidden></p><div class="form-footer"><button type="button" class="button button-cream" data-action="close-modal">Cerrar</button><button class="button button-primary" type="submit">${ownReview ? "Guardar cambios" : "Publicar reseña"} ${icon("arrowRight")}</button></div></form></section>`
      : `<section class="service-review-login"><p>Inicia sesión para contar tu experiencia con este lugar.</p><button class="button button-primary" type="button" data-action="open-login">Ingresar y opinar</button></section>`;
    openModal(`<div class="modal-inner service-reviews-dialog"><p class="modal-kicker">EXPERIENCIAS DE LA COMUNIDAD</p><h2>${esc(place.nombre)}</h2><p class="modal-intro">${esc(categoryNames[place.categoria] || "Servicio")} · ${esc([place.localidad, place.provincia, place.pais].filter(Boolean).join(", "))}</p><div class="service-reviews-summary"><strong>${result.cantidad ? esc(result.promedio) : "—"}</strong><span class="service-review-stars" aria-label="${result.cantidad ? `${esc(result.promedio)} de 5 estrellas` : "Aún sin calificaciones"}">${result.cantidad ? `${"★".repeat(Math.round(result.promedio))}${"☆".repeat(5 - Math.round(result.promedio))}` : "☆☆☆☆☆"}</span><span>${result.cantidad} ${result.cantidad === 1 ? "reseña" : "reseñas"}</span></div><div class="service-reviews-list">${reviews || `<p class="service-reviews-empty">Todavía no hay reseñas. Puedes ser la primera persona en compartir su experiencia.</p>`}</div>${formMarkup}</div>`);
  } catch (error) {
    openModal(`<div class="modal-inner service-reviews-dialog"><p class="modal-kicker">EXPERIENCIAS DE LA COMUNIDAD</p><h2>${esc(place.nombre)}</h2><p class="modal-intro">No se pudieron cargar las reseñas: ${esc(error.message)}</p><div class="form-footer"><button type="button" class="button button-primary" data-action="close-modal">Cerrar</button></div></div>`);
  }
}

function shareDialog(petId) {
  const pet = state.ownPets.find((item) => item.id === petId);
  openModal(`<div class="modal-inner"><p class="modal-kicker">CUIDAR EN EQUIPO</p><h2>Compartir el perfil de ${esc(pet?.nombre || "tu mascota")}</h2><p class="modal-intro">La otra persona recibirá una invitación y deberá aceptarla antes de ver o editar el perfil.</p>
    <form data-form="invite" data-id="${esc(petId)}"><div class="form-grid"><div class="field full"><label for="invite-email">Email de una cuenta Huellas</label><input id="invite-email" type="email" name="email" required placeholder="cuidador@ejemplo.com"></div><div class="field full"><label for="invite-role">Rol</label><select id="invite-role" name="rol"><option value="cuidador">Cuidador/a</option><option value="transito">Familia de tránsito</option><option value="refugio">Refugio</option></select></div></div><p class="modal-error" data-error hidden></p><div class="form-footer"><button type="button" class="button button-cream" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">Enviar invitación ${icon("arrowRight")}</button></div></form></div>`);
}

function editProfileDialog() {
  openModal(`<div class="modal-inner"><p class="modal-kicker">TU PERFIL PRIVADO</p><h2>Editar mis datos</h2><p class="modal-intro">Estos datos no aparecen en los perfiles públicos.</p>
    <form data-form="edit-profile"><div class="form-grid"><div class="field full"><label>Nombre</label><input name="nombre" required value="${esc(state.user.nombre)}"></div><div class="field full"><label>Teléfono</label><input name="telefono" type="tel" value="${esc(state.user.telefono || "")}"></div><div class="field"><label>País</label><input name="pais" value="${esc(state.user.pais || "")}"></div><div class="field"><label>Localidad</label><input name="localidad" value="${esc(state.user.localidad || "")}"></div><div class="field full"><label>Nombre para mostrar en búsquedas (opcional)</label><input name="nombrePublico" value="${esc(state.user.nombrePublico || "")}"></div><div class="field full"><label class="check-row"><input type="checkbox" name="mostrarNombrePublico" ${state.user.mostrarNombrePublico ? "checked" : ""}><span>Permitir que este nombre aparezca junto a perfiles públicos.</span></label></div></div><p class="modal-error" data-error hidden></p><div class="form-footer"><button type="button" class="button button-cream" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">Guardar cambios</button></div></form></div>`);
}

// Solicita la contraseña actual antes de guardar una nueva credencial.
function changePasswordDialog() {
  openModal(`<div class="modal-inner"><p class="modal-kicker">SEGURIDAD DE LA CUENTA</p><h2>Cambiar contraseña</h2><p class="modal-intro">Usa al menos 12 caracteres. Al guardarla, las demás sesiones se cerrarán.</p>
    <form data-form="change-password"><div class="form-grid">
      <div class="field full"><label for="current-password">Contraseña actual</label><input id="current-password" name="contrasenaActual" type="password" autocomplete="current-password" required maxlength="128"></div>
      <div class="field full"><label for="new-password">Nueva contraseña</label><input id="new-password" name="nuevaContrasena" type="password" autocomplete="new-password" required minlength="12" maxlength="128"></div>
      <div class="field full"><label for="confirm-password">Repetir nueva contraseña</label><input id="confirm-password" name="confirmacion" type="password" autocomplete="new-password" required minlength="12" maxlength="128"></div>
    </div><p class="modal-error" data-error hidden></p><div class="form-footer"><button type="button" class="button button-cream" data-action="close-modal">Cancelar</button><button class="button button-primary" type="submit">Actualizar contraseña</button></div></form></div>`);
}

// Confirma la baja con contraseña y una frase escrita por la persona titular.
function deleteAccountDialog() {
  openModal(`<div class="modal-inner"><p class="modal-kicker">ACCIÓN PERMANENTE</p><h2>Eliminar mi cuenta</h2><p class="modal-intro">Tus datos de cuenta y solicitudes se eliminarán. Las mascotas compartidas pasarán a otro responsable activo; si alguna no tiene otro responsable, también se eliminará su perfil y sus avisos. Los servicios comunitarios que agregaste seguirán en el mapa, desvinculados de tu cuenta.</p>
    <form data-form="delete-account"><div class="form-grid">
      <div class="field full"><label for="delete-password">Confirma tu contraseña</label><input id="delete-password" name="contrasena" type="password" autocomplete="current-password" required maxlength="128"></div>
      <div class="field full"><label for="delete-confirmation">Escribe ELIMINAR para confirmar</label><input id="delete-confirmation" name="confirmacion" required autocomplete="off"></div>
    </div><p class="modal-error" data-error hidden></p><div class="form-footer"><button type="button" class="button button-cream" data-action="close-modal">Cancelar</button><button class="button button-danger-soft button-delete" type="submit">Eliminar cuenta</button></div></form></div>`);
}

function modalError(form, message) {
  const target = form.querySelector("[data-error]");
  if (!target) return;
  target.textContent = message;
  target.hidden = false;
}

function formJson(form) {
  return Object.fromEntries(new FormData(form).entries());
}

/** Valida formato, tamaño y cantidad antes de iniciar una carga de fotos. */
function validarCargaFotos(form, mascotaId = null) {
  const input = form.querySelector('input[name="fotosArchivos"]');
  const archivos = Array.from(input?.files || []);
  const tiposPermitidos = new Set(["image/jpeg", "image/png", "image/webp"]);
  const maximoBytes = 5 * 1024 * 1024;
  const maximoFotos = 5;

  if (archivos.length > maximoFotos)
    throw new Error(`Puedes seleccionar hasta ${maximoFotos} fotos por vez.`);
  for (const archivo of archivos) {
    if (!tiposPermitidos.has(archivo.type))
      throw new Error("Las fotos deben estar en formato JPG, PNG o WebP.");
    if (archivo.size > maximoBytes)
      throw new Error("Cada foto debe pesar 5 MB o menos.");
  }

  let subidas = [];
  try {
    subidas = JSON.parse(form.dataset.fotosSubidas || "[]");
  } catch {
    subidas = [];
  }
  const subidasSet = new Set(Array.isArray(subidas) ? subidas : []);
  const pendientes = mascotaId
    ? archivos.filter(
        (archivo) => !subidasSet.has(claveArchivoFoto(mascotaId, archivo)),
      )
    : archivos;
  if (mascotaId) {
    const mascota = buscarMascotaEnEstado(mascotaId);
    const fotosExistentes = Array.isArray(mascota?.fotos)
      ? mascota.fotos.length
      : 0;
    if (fotosExistentes + pendientes.length > maximoFotos) {
      throw new Error(
        `Esta mascota ya tiene ${fotosExistentes} fotos. El máximo es ${maximoFotos}.`,
      );
    }
  }

  return { input, archivos, pendientes, subidasSet };
}

/** Devuelve una firma local para no repetir una carga que quedó a medias. */
function claveArchivoFoto(mascotaId, archivo) {
  return `${mascotaId}:${archivo.name}:${archivo.size}:${archivo.lastModified}:${archivo.type}`;
}

/** Busca un perfil en las listas ya cargadas en la interfaz. */
function buscarMascotaEnEstado(mascotaId) {
  const listas = [
    state.ownPets,
    state.pets,
    state.lost,
    state.adoptions,
    ...(state.searchResults || []),
  ];
  return listas.find((mascota) => mascota.id === mascotaId);
}

/** Actualiza en memoria las fotos nuevas devueltas por el backend. */
function actualizarFotosEnEstado(mascotaId, fotos) {
  const listas = [
    state.ownPets,
    state.pets,
    state.lost,
    state.adoptions,
    ...(state.searchResults || []),
  ];
  for (const mascota of listas) {
    if (mascota.id === mascotaId) mascota.fotos = fotos;
  }
  if (state.routePet?.id === mascotaId) state.routePet.fotos = fotos;
}

/** Envía cada archivo al endpoint protegido de fotos de la mascota. */
async function subirFotosMascota(mascotaId, form) {
  const { input, pendientes, subidasSet } = validarCargaFotos(form, mascotaId);
  if (pendientes.length === 0) return;

  for (const archivo of pendientes) {
    const respuesta = await api(
      `/mascotas/${encodeURIComponent(mascotaId)}/fotos`,
      {
        method: "POST",
        headers: { "Content-Type": archivo.type },
        body: archivo,
      },
    );
    subidasSet.add(claveArchivoFoto(mascotaId, archivo));
    form.dataset.fotosSubidas = JSON.stringify([...subidasSet]);
    if (form.dataset.form === "publish-notice") {
      state.publishPhotosUploaded = [...subidasSet];
    }
    actualizarFotosEnEstado(mascotaId, respuesta.fotos);
  }

  if (input) input.value = "";
  delete form.dataset.fotosSubidas;
  if (form.dataset.form === "publish-notice") {
    state.publishPhotoFiles = [];
    state.publishPhotosUploaded = [];
  }
}

// Convierte los formularios en solicitudes de API y comunica el resultado.
async function handleSubmit(form) {
  const type = form.dataset.form;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    if (type === "login" || type === "signup") {
      const body = formJson(form);
      const result = await api(
        type === "signup" ? "/usuarios" : "/usuarios/login",
        { method: "POST", body: JSON.stringify(body) },
      );
      saveSession(result);
      await Promise.all([reloadPrivate(), reloadPublic()]);
      if (state.pendingAction === "publish") {
        state.pendingAction = "";
        state.previousView = "inicio";
        state.publishDraft = {};
        state.view = "publicar";
      }
      closeModal();
      showNotice(
        type === "signup"
          ? "¡Tu cuenta está lista! Ahora puedes registrar mascotas."
          : "Sesión iniciada. ¡Qué bueno tenerte de vuelta!",
      );
      render();
      return;
    }
    if (type === "publish-notice") {
      const body = formJson(form);
      delete body.fotosArchivos;
      let id =
        body.mascotaId === "__new__"
          ? form.dataset.createdPetId
          : body.mascotaId;
      validarCargaFotos(form, id || null);
      if (!id || id === "__new__") {
        const profile = {
          nombre: body.nombre?.trim() || "Sin nombre",
          especie: body.especie,
          publicar: true,
          ubicacion: { localidad: body.localidad || "", pais: body.pais || "" },
        };
        if (body.raza?.trim()) profile.raza = body.raza.trim();
        if (body.edad !== "") profile.edad = Number(body.edad);
        const created = await api("/mascotas", {
          method: "POST",
          body: JSON.stringify(profile),
        });
        id = created.id;
        state.ownPets.unshift(created);
        form.dataset.createdPetId = id;
        state.publishDraft = { ...body, mascotaId: id, createdPetId: id };
      }
      await subirFotosMascota(id, form);
      if (state.publishType === "perdida") {
        const report = {
          localidad: body.localidad,
          pais: body.pais,
          descripcion: body.descripcion,
        };
        if (body.fecha)
          report.fecha = new Date(`${body.fecha}T12:00:00`).toISOString();
        await api(`/mascotas/${encodeURIComponent(id)}/reportes/perdida`, {
          method: "POST",
          body: JSON.stringify(report),
        });
      } else {
        const status =
          state.publishType === "en_adopcion" ? "en_adopcion" : "encontrada";
        await api(`/mascotas/${encodeURIComponent(id)}/estado`, {
          method: "PATCH",
          body: JSON.stringify({ estado: status }),
        });
      }
      if (!(await refreshAll())) return;
      if (state.publishType === "perdida") state.view = "perdidas";
      else if (state.publishType === "en_adopcion") state.view = "adopcion";
      else {
        state.view = "buscar";
        state.searchResults = null;
        state.searchFilters.buscar = {};
      }
      state.publishDraft = {};
      state.publishPhotoFiles = [];
      state.publishPhotosUploaded = [];
      render();
      showNotice(
        state.publishType === "perdida"
          ? "El aviso de pérdida ya está publicado."
          : state.publishType === "en_adopcion"
            ? "El perfil ya aparece en adopción."
            : "El aviso de mascota encontrada ya está publicado.",
      );
      return;
    }
    if (type === "create-pet" || type === "update-pet") {
      validarCargaFotos(
        form,
        type === "update-pet" ? form.dataset.id : null,
      );
      const body = formJson(form);
      const existingPet =
        type === "update-pet"
          ? state.ownPets.find((pet) => pet.id === form.dataset.id)
          : null;
      const savedHealth = { ...(existingPet?.salud || {}) };
      for (const [field, formField] of [
        ["vacunado", "vacunado"],
        ["esterilizada", "esterilizada"],
      ]) {
        if (body[formField] === "") delete savedHealth[field];
        else savedHealth[field] = body[formField] === "true";
      }
      for (const [field, formField] of [
        ["alergias", "alergias"],
        ["medicamentos", "medicamentos"],
        ["observaciones", "observacionesSalud"],
      ]) {
        if (body[formField]?.trim())
          savedHealth[field] = body[formField].trim();
        else delete savedHealth[field];
      }
      const identificacion = { ...(existingPet?.identificacion || {}) };
      if (body.microchip?.trim())
        identificacion.microchip = body.microchip.trim();
      else delete identificacion.microchip;
      const comportamiento = { ...(existingPet?.comportamiento || {}) };
      if (body.temperamento?.trim())
        comportamiento.temperamento = body.temperamento.trim();
      else delete comportamiento.temperamento;
      if (body.convivencia?.trim())
        comportamiento.convivencia = body.convivencia.trim();
      else delete comportamiento.convivencia;
      const result = {
        nombre: body.nombre,
        especie: body.especie,
        raza: body.raza,
        edad: body.edad === "" ? undefined : Number(body.edad),
        fechaNacimiento: body.fechaNacimiento || undefined,
        sexo: body.sexo,
        tamano: body.tamano,
        colores: body.colores
          ? body.colores
              .split(",")
              .map((color) => color.trim())
              .filter(Boolean)
          : [],
        ubicacion: {
          ...(existingPet?.ubicacion || {}),
          localidad: body.localidad,
          pais: body.pais,
        },
        salud: savedHealth,
        identificacion,
        comportamiento,
        senasParticulares: body.senasParticulares,
        descripcion: body.descripcion,
        publicar: form.elements.publicar.checked,
      };
      Object.keys(result).forEach((key) => {
        if (result[key] === undefined) delete result[key];
      });
      if (!Object.keys(result.salud).length) delete result.salud;
      if (!Object.keys(result.identificacion).length)
        delete result.identificacion;
      if (!Object.keys(result.comportamiento).length)
        delete result.comportamiento;
      const mascotaGuardada = await api(
        type === "create-pet"
          ? "/mascotas"
          : `/mascotas/${encodeURIComponent(form.dataset.id)}`,
        {
          method: type === "create-pet" ? "POST" : "PUT",
          body: JSON.stringify(result),
        },
      );
      if (type === "create-pet") {
        form.dataset.form = "update-pet";
        form.dataset.id = mascotaGuardada.id;
        state.ownPets.unshift(mascotaGuardada);
        const submitLabel = form.querySelector('button[type="submit"]');
        if (submitLabel)
          submitLabel.innerHTML = `Guardar cambios ${icon("arrowRight")}`;
      }
      await subirFotosMascota(mascotaGuardada.id, form);
      closeModal();
      if (!(await refreshAll())) return;
      state.view = "mias";
      render();
      showNotice(
        type === "create-pet"
          ? "Perfil guardado. Puedes agregar más datos o publicar un aviso cuando quieras."
          : "Perfil actualizado.",
      );
      return;
    }
    if (type === "report-loss") {
      const body = formJson(form);
      const id = form.dataset.id || body.mascotaId;
      delete body.mascotaId;
      if (body.fecha)
        body.fecha = new Date(`${body.fecha}T12:00:00`).toISOString();
      else delete body.fecha;
      await api(`/mascotas/${encodeURIComponent(id)}/reportes/perdida`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      closeModal();
      if (!(await refreshAll())) return;
      state.view = "perdidas";
      render();
      showNotice(
        "El aviso ya está publicado con la zona general. ¡Ojalá vuelva pronto!",
      );
      return;
    }
    if (type === "contact") {
      await api("/contacto/solicitudes", {
        method: "POST",
        body: JSON.stringify({
          mascotaId: form.dataset.id,
          mensaje: formJson(form).mensaje,
        }),
      });
      closeModal();
      await reloadPrivate();
      state.view = "cuenta";
      render();
      showNotice(
        "Mensaje enviado. El responsable lo recibirá en su bandeja privada.",
      );
      return;
    }
    if (type === "create-service" || type === "update-service") {
      const body = formJson(form);
      const latitude = Number(form.elements.latitud.value);
      const longitude = Number(form.elements.longitud.value);
      if (
        form.elements.latitud.value === "" ||
        form.elements.longitud.value === "" ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        modalError(
          form,
          "Elige la ubicación del lugar: busca su dirección o toca el punto exacto en el mapa.",
        );
        form.querySelector(".place-location-picker")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }
      body.latitud = latitude;
      body.longitud = longitude;
      body.guardia = form.elements.guardia.checked;
      const editing = type === "update-service";
      await api(
        editing ? `/lugares/${encodeURIComponent(form.dataset.id)}` : "/lugares",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(body),
        },
      );
      closeModal();
      if (!(await refreshAll())) return;
      state.view = "servicios";
      render();
      showNotice(
        editing
          ? "Los datos del servicio fueron actualizados."
          : "Punto agregado al mapa como aporte comunitario.",
      );
      return;
    }
    if (
      type === "create-service-review" ||
      type === "update-service-review"
    ) {
      const body = formJson(form);
      const id = encodeURIComponent(form.dataset.id);
      const editing = type === "update-service-review";
      const reviewId = encodeURIComponent(form.dataset.reviewId || "");
      await api(
        editing
          ? `/lugares/${id}/resenas/${reviewId}`
          : `/lugares/${id}/resenas`,
        { method: editing ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      const updatedPlace = await api(`/lugares/${id}`);
      const placeIndex = state.places.findIndex(
        (place) => String(place.id) === String(form.dataset.id),
      );
      if (placeIndex >= 0) state.places[placeIndex] = updatedPlace;
      const allPlaceIndex = state.allPlaces?.findIndex(
        (place) => String(place.id) === String(form.dataset.id),
      );
      if (allPlaceIndex >= 0) state.allPlaces[allPlaceIndex] = updatedPlace;
      render();
      await serviceReviewsDialog(form.dataset.id);
      showNotice(editing ? "Tu reseña fue actualizada." : "Gracias por compartir tu experiencia.");
      return;
    }
    if (type === "invite") {
      await api(
        `/mascotas/${encodeURIComponent(form.dataset.id)}/responsables`,
        { method: "POST", body: JSON.stringify(formJson(form)) },
      );
      closeModal();
      showNotice(
        "Invitación enviada. El acceso se activa cuando la otra persona acepte.",
      );
      return;
    }
    if (type === "search-pets") {
      const body = formJson(form);
      const kind = form.dataset.kind;
      const params = new URLSearchParams();
      if (kind === "perdidas") params.set("estado", "perdida");
      if (kind === "adopcion") params.set("estado", "en_adopcion");
      [
        "q",
        "nombre",
        "especie",
        "raza",
        "color",
        "tamano",
        "sexo",
        "edad",
        "vacunado",
        "responsable",
        "localidad",
        "pais",
        ...(kind === "buscar" ? ["estado"] : []),
      ].forEach((field) => {
        const value = body[field];
        if (value !== undefined && String(value).trim() !== "")
          params.set(field, String(value).trim());
      });
      const pets = await api(`/mascotas${params.size ? `?${params}` : ""}`);
      state.searchFilters[kind] = body;
      if (kind === "perdidas") state.lost = pets;
      else if (kind === "adopcion") state.adoptions = pets;
      else {
        state.searchResults = pets;
        state.view = "buscar";
      }
      render();
      return;
    }
    if (type === "search-services") {
      const body = formJson(form);
      const params = new URLSearchParams();
      ["categoria", "localidad", "pais"].forEach((field) => {
        if (body[field]?.trim()) params.set(field, body[field].trim());
      });
      state.places = await api(`/lugares${params.size ? `?${params}` : ""}`);
      state.serviceFilters = body;
      render();
      return;
    }
    if (type === "edit-profile") {
      const body = formJson(form);
      body.mostrarNombrePublico = form.elements.mostrarNombrePublico.checked;
      await api("/usuarios/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      closeModal();
      await reloadPrivate();
      render();
      showNotice("Perfil actualizado.");
      return;
    }
    if (type === "change-password") {
      const body = formJson(form);
      if (body.nuevaContrasena !== body.confirmacion) {
        modalError(form, "Las contraseñas nuevas no coinciden.");
        return;
      }
      delete body.confirmacion;
      const result = await api("/usuarios/me/contrasena", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      saveSession(result);
      state.user = result.usuario;
      closeModal();
      render();
      showNotice("Contraseña actualizada. La sesión actual sigue activa.");
      return;
    }
    if (type === "delete-account") {
      const body = formJson(form);
      if (body.confirmacion !== "ELIMINAR") {
        modalError(form, "Escribe ELIMINAR para confirmar la baja.");
        return;
      }
      await api("/usuarios/me", {
        method: "DELETE",
        body: JSON.stringify({ contrasena: body.contrasena }),
      });
      clearSession();
      state.user = null;
      limpiarPropiedadServicios();
      state.ownPets = [];
      state.requests = [];
      state.invitations = [];
      state.view = "inicio";
      closeModal();
      render();
      showNotice("Tu cuenta y los datos asociados fueron eliminados.");
      return;
    }
  } catch (error) {
    if (submitButton) submitButton.disabled = false;
    if (form.querySelector("[data-error]")) modalError(form, error.message);
    else showNotice(error.message, true);
  }
}

// Acciones delegadas para los botones y controles de cada pantalla.
async function handleAction(action, element) {
  const id = element.dataset.id;
  if (action === "close-modal") {
    state.pendingAction = "";
    return closeModal();
  }
  if (action === "toggle-nav") {
    const nav = document.querySelector("#site-nav");
    const isOpen = nav.classList.toggle("is-open");
    document.querySelector(".app-shell")?.classList.toggle("nav-open", isOpen);
    document.body.classList.toggle("nav-open", isOpen);
    document
      .querySelector(".menu-toggle")
      ?.setAttribute("aria-expanded", String(isOpen));
    document
      .querySelector(".menu-toggle")
      ?.setAttribute(
        "aria-label",
        isOpen ? "Cerrar navegación" : "Abrir navegación",
      );
    document.querySelector(".menu-toggle").innerHTML =
      `${icon("paw", "menu-paw")}<span class="menu-label">Menú</span><span class="visually-hidden">${isOpen ? "Cerrar navegación" : "Abrir navegación"}</span>`;
    return;
  }
  if (action === "open-login") return authDialog("login");
  if (action === "open-signup") return authDialog("signup");
  if (action === "open-pet") {
    if (!state.user) return authDialog("signup");
    return petDialog();
  }
  if (action === "edit-pet") {
    const pet = state.ownPets.find((item) => item.id === id);
    if (pet) return petDialog(pet);
  }
  if (action === "view-pet") return publicPetDialog(id);
  if (action === "back-from-pet") {
    state.view = state.previousView || "inicio";
    render("replace");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (action === "select-pet-tab") {
    state.petTab = element.dataset.state;
    render("replace");
    return;
  }
  if (action === "toggle-favorite") {
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    saveFavorites();
    render();
    return;
  }
  if (action === "delete-pet") {
    const pet = state.ownPets.find((item) => item.id === id);
    if (
      !pet ||
      !window.confirm(
        `¿Eliminar el perfil de ${pet.nombre}? Esta acción también elimina sus avisos y solicitudes asociados.`,
      )
    )
      return;
    try {
      await api(`/mascotas/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!(await refreshAll())) return;
      state.view = "mias";
      render();
      showNotice("El perfil de la mascota fue eliminado.");
    } catch (error) {
      showNotice(error.message, true);
    }
    return;
  }
  if (action === "edit-service") {
    const place = state.places.find((item) => String(item.id) === id);
    if (place?.propio) serviceDialog(place);
    return;
  }
  if (action === "open-service-reviews") {
    await serviceReviewsDialog(id);
    return;
  }
  if (action === "delete-service") {
    const place = state.places.find((item) => String(item.id) === id);
    if (
      !place?.propio ||
      !window.confirm(`¿Eliminar el punto de servicio "${place.nombre}"?`)
    )
      return;
    try {
      await api(`/lugares/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!(await refreshAll())) return;
      state.view = "servicios";
      render();
      showNotice("El punto de servicio fue eliminado.");
    } catch (error) {
      showNotice(error.message, true);
    }
    return;
  }
  if (action === "report-public") {
    if (!state.user) {
      state.pendingAction = "publish";
      return authDialog("login");
    }
    state.previousView = state.view;
    state.publishDraft = {};
    state.publishPhotoFiles = [];
    state.publishPhotosUploaded = [];
    state.publishType = "perdida";
    state.view = "publicar";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (action === "back-from-publish") {
    state.publishPhotoFiles = [];
    state.publishPhotosUploaded = [];
    state.view = state.previousView || "inicio";
    render("replace");
    return;
  }
  if (action === "select-publish-type") {
    const form = document.querySelector('form[data-form="publish-notice"]');
    if (form) {
      const draft = formJson(form);
      delete draft.fotosArchivos;
      state.publishPhotoFiles = Array.from(
        form.elements.fotosArchivos?.files || [],
      );
      state.publishDraft = {
        ...state.publishDraft,
        ...draft,
        createdPetId:
          form.dataset.createdPetId || state.publishDraft.createdPetId || "",
      };
    }
    state.publishType = element.dataset.state;
    render("replace");
    return;
  }
  if (action === "report-loss") return lossDialog(id);
  if (action === "contact") {
    if (modal.open) closeModal();
    return contactDialog(id);
  }
  if (action === "add-service") {
    if (!state.user) return authDialog("login");
    return serviceDialog();
  }
  if (action === "change-password") return changePasswordDialog();
  if (action === "delete-account") return deleteAccountDialog();
  if (action === "share-pet") return shareDialog(id);
  if (action === "edit-profile") return editProfileDialog();
  if (action === "go-account") {
    state.view = "cuenta";
    render();
    return;
  }
  if (action === "logout") {
    try {
      if (hasToken()) await api("/usuarios/logout", { method: "POST" });
    } catch {
      /* El token puede haber vencido; limpiar igualmente la sesión local. */
    }
    clearSession();
    state.user = null;
    limpiarPropiedadServicios();
    state.ownPets = [];
    state.requests = [];
    state.invitations = [];
    state.view = "inicio";
    render();
    showNotice("Sesión cerrada. Tus perfiles siguen guardados.");
    return;
  }
  if (action === "set-adoption") {
    try {
      await api(`/mascotas/${encodeURIComponent(id)}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "en_adopcion" }),
      });
      if (!(await refreshAll())) return;
      state.view = "mias";
      render();
      showNotice("Perfil publicado en la sección de adopción.");
    } catch (error) {
      showNotice(error.message, true);
    }
    return;
  }
  if (action === "resolve-lost") {
    try {
      await api(`/mascotas/${encodeURIComponent(id)}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "encontrada" }),
      });
      if (!(await refreshAll())) return;
      state.view = "mias";
      render();
      showNotice(
        "La mascota figura como encontrada. Gracias por actualizar el aviso.",
      );
    } catch (error) {
      showNotice(error.message, true);
    }
    return;
  }
  if (action === "set-status") {
    const pet = state.ownPets.find((item) => item.id === id);
    if (
      element.dataset.state === "adoptada" &&
      pet &&
      !window.confirm(
        `¿Marcar a ${pet.nombre} como adoptada? Su perfil dejará de aparecer en búsquedas públicas.`,
      )
    )
      return;
    try {
      await api(`/mascotas/${encodeURIComponent(id)}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: element.dataset.state }),
      });
      if (!(await refreshAll())) return;
      state.view = "mias";
      render();
      showNotice("El estado de la mascota fue actualizado.");
    } catch (error) {
      showNotice(error.message, true);
    }
    return;
  }
  if (action === "accept-invite") {
    try {
      await api(`/mascotas/${encodeURIComponent(id)}/responsables/aceptar`, {
        method: "POST",
        body: "{}",
      });
      await reloadPrivate();
      render();
      showNotice("Invitación aceptada. La mascota ya está en tu lista.");
    } catch (error) {
      showNotice(error.message, true);
    }
    return;
  }
  if (action === "respond-contact") {
    const checkbox = document.querySelector(
      `[data-share-contact="${CSS.escape(id)}"]`,
    );
    const compartirContacto =
      element.dataset.decision === "aceptar" && Boolean(checkbox?.checked);
    try {
      await api(`/contacto/solicitudes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          decision: element.dataset.decision,
          compartirContacto,
        }),
      });
      await reloadPrivate();
      render();
      showNotice(
        element.dataset.decision === "aceptar"
          ? "Solicitud aceptada."
          : "Solicitud rechazada.",
      );
    } catch (error) {
      showNotice(error.message, true);
    }
    return;
  }
  if (action === "cancel-request") {
    const request = state.requests.find((item) => String(item.id) === id);
    if (
      !request ||
      request.remitente !== null ||
      request.estado !== "pendiente" ||
      !window.confirm("¿Cancelar esta solicitud de contacto pendiente?")
    )
      return;
    try {
      await api(`/contacto/solicitudes/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await reloadPrivate();
      render();
      showNotice("La solicitud fue cancelada.");
    } catch (error) {
      showNotice(error.message, true);
    }
    return;
  }
  if (action === "contact-channels") {
    try {
      const channels = await api(
        `/contacto/solicitudes/${encodeURIComponent(id)}/contacto`,
      );
      openModal(
        `<div class="modal-inner"><p class="modal-kicker">CANALES AUTORIZADOS</p><h2>Contacto compartido</h2><p class="modal-intro">La persona responsable permitió compartir estos datos para esta solicitud.</p><div class="profile-details"><div class="profile-detail"><span>Email</span><strong>${esc(channels.email)}</strong></div><div class="profile-detail"><span>Teléfono</span><strong>${esc(channels.telefono || "No informado")}</strong></div></div><div class="form-footer"><button class="button button-primary" data-action="close-modal">Listo</button></div></div>`,
      );
    } catch (error) {
      showNotice(error.message, true);
    }
  }
}

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    if (viewButton instanceof HTMLAnchorElement) event.preventDefault();
    state.view = viewButton.dataset.view;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    if (actionButton.dataset.action !== "toggle-nav") closeNav();
    await handleAction(actionButton.dataset.action, actionButton);
    return;
  }
  if (!event.target.closest("#site-nav")) closeNav();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.open) closeNav();
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  await handleSubmit(form);
});

document.addEventListener("change", (event) => {
  const form = event.target.closest('form[data-form="publish-notice"]');
  if (!form || event.target.name !== "mascotaId") return;
  const isNew = event.target.value === "__new__";
  const fields = form.querySelector("[data-new-pet-fields]");
  const species = form.elements.especie;
  if (fields) fields.hidden = !isNew;
  if (species) species.required = isNew;
});

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});
modal.addEventListener("close", () => {
  state.pendingAction = "";
});

// Inicializa eventos, restaura la sesión y carga la primera pantalla.
async function start() {
  readRoute();
  try {
    if (hasToken()) {
      try {
        await reloadPrivate();
      } catch (error) {
        if (error.status === 401) {
          clearSession();
          state.user = null;
          limpiarPropiedadServicios();
          state.ownPets = [];
          state.requests = [];
          state.invitations = [];
        } else showNotice(error.message, true);
      }
    }
    if (state.view === "publicar" && !state.user) {
      state.pendingAction = "publish";
      state.view = "inicio";
    }
    await reloadPublic();
    try {
      await loadRouteData();
    } catch (error) {
      showNotice(error.message, true);
    }
    render("replace");
    if (state.pendingAction === "publish" && !state.user) authDialog("login");
  } catch (error) {
    render("replace");
    showNotice(error.message, true);
  }
}

window.addEventListener("popstate", async () => {
  readRoute();
  try {
    await loadRouteData();
  } catch (error) {
    showNotice(error.message, true);
  }
  render("replace");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

start();
