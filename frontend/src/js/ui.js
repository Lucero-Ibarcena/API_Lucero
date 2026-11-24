import { icon } from "./icons.js";

// Componentes HTML reutilizables para tarjetas, estados y encabezados.
/** Escapa texto antes de insertarlo en el HTML generado por la interfaz. */
export const esc = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

const statusLabels = {
  perdida: "Perdido",
  en_adopcion: "En adopción",
  en_refugio: "En refugio",
  en_transito: "En tránsito",
  encontrada: "Encontrado",
  registrada: "Registrada",
  adoptada: "Adoptada",
};

/** Traduce el código interno de estado a una etiqueta para la interfaz. */
export function statusLabel(status = "registrada") {
  return statusLabels[status] || status.replaceAll("_", " ");
}

/** Acepta fotos HTTPS o del mismo origen para evitar enlaces inseguros. */
function photoUrl(pet) {
  const candidate = Array.isArray(pet.fotos)
    ? pet.fotos.find((item) => typeof item === "string")
    : null;
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate, location.origin);
    return parsed.protocol === "https:" || parsed.origin === location.origin
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}

/** Renderiza la tarjeta de una mascota con acciones según el contexto. */
export function petCard(
  pet,
  { mine = false, demo = false, compact = false, favorite = false } = {},
) {
  const locationText =
    pet.reportePerdida?.localidad ||
    pet.ubicacion?.localidad ||
    "Ubicación no informada";
  const image = photoUrl(pet);
  const imageContent = image
    ? `<img src="${esc(image)}" alt="Foto de ${esc(pet.nombre)}" loading="lazy">`
    : "";
  const colors = Array.isArray(pet.colores)
    ? pet.colores.join(" · ")
    : pet.color || "";
  const age =
    pet.edad === undefined
      ? ""
      : `${esc(pet.edad)} ${Number(pet.edad) === 1 ? "año" : "años"}`;
  const vaccine =
    pet.salud?.vacunado === true
      ? "Vacunas al día"
      : pet.salud?.vacunado === false
        ? "Vacunas pendientes"
        : "";
  const favoriteAction = `<button class="favorite-toggle ${favorite ? "is-saved" : ""}" type="button" data-action="toggle-favorite" data-id="${esc(pet.id)}" aria-label="${favorite ? "Quitar de guardados" : "Guardar mascota"}" aria-pressed="${favorite}" title="${favorite ? "Quitar de guardados" : "Guardar mascota"}">${icon("heart")}</button>`;
  const publicActions = `<div class="pet-actions"><button class="button button-light button-small" data-action="view-pet" data-id="${esc(pet.id)}">Ver perfil</button><button class="button button-outline button-small" data-action="contact" data-id="${esc(pet.id)}">${pet.estado === "en_adopcion" ? "Quiero ayudar" : "Enviar mensaje"} ${icon("arrowUpRight")}</button></div>`;
  const action = demo
    ? ""
    : compact
      ? `<button class="compact-pet-open" data-action="view-pet" data-id="${esc(pet.id)}">Ver ficha</button>`
      : mine
        ? `<div class="pet-actions">
        ${pet.estado === "perdida" ? `<button class="button button-primary button-small" data-action="resolve-lost" data-id="${esc(pet.id)}">Ya volvió</button>` : ""}
        ${pet.estado !== "perdida" ? `<button class="button button-danger-soft button-small" data-action="report-loss" data-id="${esc(pet.id)}">Avisar que se perdió</button>` : ""}
        ${pet.estado !== "perdida" && pet.estado !== "en_adopcion" ? `<button class="button button-light button-small" data-action="set-adoption" data-id="${esc(pet.id)}">Buscarle hogar</button>` : ""}
        ${pet.estado === "en_adopcion" ? `<button class="button button-light button-small" data-action="set-status" data-state="adoptada" data-id="${esc(pet.id)}">Marcar adoptada</button>` : ""}
        <button class="button button-light button-small" data-action="view-pet" data-id="${esc(pet.id)}">Ver ficha</button>
        <button class="button button-light button-small" data-action="edit-pet" data-id="${esc(pet.id)}">Editar perfil</button>
        <button class="button button-quiet button-small" data-action="share-pet" data-id="${esc(pet.id)}">Compartir cuidado</button>
        <button class="button button-danger-soft button-delete button-small" data-action="delete-pet" data-id="${esc(pet.id)}">Eliminar perfil</button>
      </div>`
        : publicActions;

  return `<article class="pet-card ${mine ? "pet-card-mine" : ""} ${demo ? "pet-card-demo" : ""}">
    <div class="pet-card-media ${pet.estado === "perdida" ? "media-lost" : pet.estado === "en_adopcion" ? "media-adoption" : "media-general"}">
      ${imageContent}
      ${favoriteAction}
      <span class="pet-status ${pet.estado === "perdida" ? "status-lost" : pet.estado === "en_adopcion" ? "status-adoption" : ""}">${esc(statusLabel(pet.estado))}</span>
      ${mine && !pet.publicar ? '<span class="private-badge">Solo tú la ves</span>' : ""}
    </div>
    <div class="pet-card-body">
      <div class="pet-title-row"><div><h3>${esc(pet.nombre)}</h3><p>${[pet.especie, pet.raza, pet.sexo, age].filter(Boolean).map(esc).join(" · ")}</p></div></div>
      <div class="pet-meta"><span>${icon("mapPin")}${esc(locationText)}</span>${colors ? `<span>${icon("location")}${esc(colors)}</span>` : ""}${vaccine ? `<span>${icon("shield")}${vaccine}</span>` : ""}</div>
      ${pet.descripcion ? `<p class="pet-description">${esc(pet.descripcion)}</p>` : ""}
      ${action}
    </div>
  </article>`;
}

/** Renderiza un mensaje cuando una sección no tiene resultados. */
export function emptyState({
  icon: iconName = "paw",
  title,
  text,
  action = "",
}) {
  return `<div class="empty-state"><div class="empty-icon">${icon(iconName)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}

/** Renderiza el título y la descripción de una sección de pantalla. */
export function sectionHeader(kicker, title, subtitle, action = "") {
  return `<div class="section-header"><div><div class="eyebrow">${esc(kicker)}</div><h1>${title}</h1><p>${esc(subtitle)}</p></div>${action}</div>`;
}
