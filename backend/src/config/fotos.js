import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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

const nombreFotoValido = /^[a-f0-9-]{36}\.(?:jpg|png|webp)$/i;

/** Comprueba que los bytes coincidan con el tipo declarado por el navegador. */
export function contenidoFotoValido(contenido, tipo) {
  if (!Buffer.isBuffer(contenido)) return false;
  if (tipo === "image/jpeg") {
    return (
      contenido.length >= 3 &&
      contenido
        .subarray(0, 3)
        .equals(Buffer.from([0xff, 0xd8, 0xff]))
    );
  }
  if (tipo === "image/png") {
    return (
      contenido.length >= 8 &&
      contenido
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (tipo === "image/webp")
    return (
      contenido.length >= 12 &&
      contenido.toString("ascii", 0, 4) === "RIFF" &&
      contenido.toString("ascii", 8, 12) === "WEBP"
    );
  return false;
}

/** Guarda una imagen con nombre aleatorio y devuelve la ruta pública local. */
export async function guardarFotoMascota(mascotaId, contenido, tipo) {
  const extension = extensionesFoto.get(tipo);
  if (!extension || !Buffer.isBuffer(contenido)) {
    throw new TypeError("El archivo de imagen no es válido.");
  }

  await mkdir(directorioFotos, { recursive: true });
  const nombre = `${randomUUID()}.${extension}`;
  await writeFile(resolve(directorioFotos, nombre), contenido, { flag: "wx" });
  return `/mascotas/${encodeURIComponent(mascotaId)}/fotos/${nombre}`;
}

/** Resuelve solo nombres aleatorios de fotos dentro de la carpeta local. */
export function rutaArchivoFoto(nombre) {
  if (!nombreFotoValido.test(nombre)) return null;
  return resolve(directorioFotos, nombre);
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
  const coincidencia = url.pathname.match(
    /^\/mascotas\/[^/]+\/fotos\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i,
  );
  const nombre = coincidencia?.[1];
  if (!nombre || !nombreFotoValido.test(nombre)) return;

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
