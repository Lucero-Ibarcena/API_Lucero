// Catálogo de iconos reutilizables en botones y componentes.
// La huella conserva la silueta de referencia desde assets/huellas.png.
const shapes = {
  home: '<path d="m3.5 10.5 8.5-7 8.5 7v9a1 1 0 0 1-1 1h-5.2v-6h-4.6v6H4.5a1 1 0 0 1-1-1v-9Z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  megaphone:
    '<path d="M4 13V9a1 1 0 0 1 1-1h3l10-4v14L8 14H5a1 1 0 0 1-1-1Z"/><path d="m8 14 1.5 6h3L11 15"/><path d="M21 8v6"/>',
  house: '<path d="m3 11 9-7 9 7"/><path d="M5.5 10v10h13V10M9.5 20v-6h5v6"/>',
  medical:
    '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="currentColor" stroke="none"/>',
  heart:
    '<path d="M20.6 8.6c0 5.2-8.6 11-8.6 11s-8.6-5.8-8.6-11A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.6 2.2Z"/>',
  users:
    '<path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 18.5V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M16 11a3.5 3.5 0 1 0-.2-7M17 14h1a4 4 0 0 1 4 4v2"/>',
  mapPin:
    '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  arrowRight: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.3 1-1.4 2.4-1.6-.6a8 8 0 0 1-1.8 1l-.3 1.7h-2.8l-.3-1.7a8 8 0 0 1-1.8-1l-1.6.6-1.4-2.4 1.3-1a8 8 0 0 1 0-2l-1.3-1 1.4-2.4 1.6.6a8 8 0 0 1 1.8-1l.3-1.7h2.8l.3 1.7a8 8 0 0 1 1.8 1l1.6-.6 1.4 2.4-1.3 1a8 8 0 0 1 0 2Z" transform="translate(-1 -1) scale(1.08)"/>',
  logout:
    '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  shop: '<path d="M4 9h16v11H4zM3 9l2-5h14l2 5M8 13v3M12 13v3M16 13v3"/>',
  scissors:
    '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="m8 8 12 12M8 16 20 4M12.5 11.5 15 9"/>',
  school:
    '<path d="m2.5 9 9.5-5 9.5 5-9.5 5-9.5-5Z"/><path d="M6 11v5c3.5 3 8.5 3 12 0v-5M21.5 9v6"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/>',
  shield:
    '<path d="M12 3 20 6v5c0 5.5-3.4 8.5-8 10-4.6-1.5-8-4.5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.6 1.7c-1.2 1.1-2.1 1.5-2.1 3M12 17.5v.1"/>',
  location: '<path d="M5 4h14M5 20h14M8 4c0 8 8 8 8 16M16 4c0 8-8 8-8 16"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
};

/** Genera un icono SVG accesible a partir del nombre registrado. */
export function icon(name, className = "") {
  if (name === "paw") {
    const classes = ["icon", "icon-paw", className].filter(Boolean).join(" ");
    return `<span class="${classes}" aria-hidden="true"></span>`;
  }

  const shape =
    shapes[name] ||
    '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>';
  const classes = ["icon", className].filter(Boolean).join(" ");
  return `<svg class="${classes}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shape}</svg>`;
}
