import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const archivo = fileURLToPath(new URL('./mascotas.json', import.meta.url));

// El archivo JSON hace de base de datos simple para este proyecto.
let datos;

try {
    datos = JSON.parse(await readFile(archivo, 'utf8'));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
    datos = { usuarios: [], mascotas: [] };
}

// Acepta también el formato viejo, que guardaba solo una lista de mascotas.
if (Array.isArray(datos)) {
    datos = { usuarios: [], mascotas: datos };
}

if (!Array.isArray(datos.usuarios) || !Array.isArray(datos.mascotas)) {
    throw new Error('data/mascotas.json debe tener las listas "usuarios" y "mascotas".');
}

export { datos };

export async function guardarDatos() {
    await writeFile(archivo, `${JSON.stringify(datos, null, 2)}\n`, 'utf8');
}
