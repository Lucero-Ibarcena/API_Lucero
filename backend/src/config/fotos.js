import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Archivos de imagen locales, separados de los datos JSON de las mascotas.
const directorioFotos = fileURLToPath(
  new URL("../../../data/uploads/mascotas/", import.meta.url),
);

export const extensionesFoto = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
export const maximoBytesFoto = 5 * 1024 * 1024;
export const maximoFotosMascota = 5;

/** Guarda una imagen con nombre aleatorio y devuelve la ruta pública local. */
export async function guardarFotoMascota(contenido, tipo) {
  const extension = extensionesFoto.get(tipo);
  if (!extension || !Buffer.isBuffer(contenido)) {
    throw new TypeError("El archivo de imagen no es válido.");
  }

  await mkdir(directorioFotos, { recursive: true });
  const nombre = `${randomUUID()}.${extension}`;
  await writeFile(resolve(directorioFotos, nombre), contenido, { flag: "wx" });
  return `/uploads/mascotas/${nombre}`;
}

/** Borra una foto local Huellas sin tocar enlaces externos del perfil. */
export async function eliminarFotoMascota(ruta) {
  if (typeof ruta !== "string") return;

  let url;
  try {
    url = new URL(ruta, "http://huellas.local");
  } catch {
    return;
  }
  if (url.origin !== "http://huellas.local") return;
  const nombre = basename(url.pathname);
  if (!/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i.test(nombre)) return;

  try {
    await unlink(resolve(directorioFotos, nombre));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

/** Elimina los archivos propios del perfil de una mascota. */
export async function eliminarFotosMascota(mascota) {
  if (!Array.isArray(mascota?.fotos)) return;
  await Promise.all(mascota.fotos.map(eliminarFotoMascota));
}
