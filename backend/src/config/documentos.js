import { readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

// Persiste perfiles flexibles de mascotas en una colección JSON local.
const archivo = fileURLToPath(
  new URL("../../../data/mascotas-documentos.json", import.meta.url),
);
let documentos = [];
let colaEscritura = Promise.resolve();

try {
  const guardado = JSON.parse(await readFile(archivo, "utf8"));
  if (!Array.isArray(guardado.documentos))
    throw new Error('La colección NoSQL no tiene un arreglo "documentos".');
  documentos = guardado.documentos;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

/** Devuelve todos los perfiles cargados en memoria. */
export function listarDocumentos() {
  return documentos;
}

/** Busca un perfil por su identificador. */
export function obtenerDocumento(id) {
  return documentos.find((documento) => documento.id === id);
}

/** Inserta o reemplaza un perfil y espera a que se guarde en disco. */
export async function guardarDocumento(documento) {
  const existente = documentos.findIndex((item) => item.id === documento.id);
  if (existente === -1) documentos.push(documento);
  else documentos[existente] = documento;
  await persistir();
  return documento;
}

/** Elimina un perfil y actualiza la colección local si existía. */
export async function eliminarDocumento(id) {
  const anterior = documentos;
  documentos = documentos.filter((documento) => documento.id !== id);
  if (documentos.length !== anterior.length) await persistir();
}

/** Escribe el archivo temporal y lo reemplaza de forma segura. */
async function persistir() {
  const contenido = `${JSON.stringify({ documentos }, null, 2)}\n`;
  const temporal = `${archivo}.${randomUUID()}.tmp`;
  colaEscritura = colaEscritura
    .catch(() => {})
    .then(async () => {
      await writeFile(temporal, contenido, "utf8");
      await rename(temporal, archivo);
    });
  await colaEscritura;
}
