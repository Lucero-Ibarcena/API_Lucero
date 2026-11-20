import express from 'express';
import { fileURLToPath } from 'node:url';
import contactRoutes from '../modules/contact/routes.js';
import petRoutes from '../modules/pets/routes.js';
import placeRoutes from '../modules/places/routes.js';
import userRoutes from '../modules/users/routes.js';

const app = express();
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
const helpPage = fileURLToPath(new URL('../public/ayuda.html', import.meta.url));

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDirectory));

app.get('/ayuda', (_req, res) => res.sendFile(helpPage));
app.get('/estado', (_req, res) => res.json({ estado: 'disponible', bases: ['SQL', 'NoSQL documental'] }));

app.use('/usuarios', userRoutes);
app.use('/mascotas', petRoutes);
app.use('/contacto', contactRoutes);
app.use('/lugares', placeRoutes);

// Las rutas de la interfaz comparten el servidor con la API, pero tienen su propio prefijo.
// Así una URL como /app/mascotas/:id también carga la aplicación al abrirse o recargarse.
app.get(/^\/app(?:\/.*)?$/, (_req, res) => res.sendFile(fileURLToPath(new URL('../public/index.html', import.meta.url))));

app.use((_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada. Consulta la guía en /ayuda.' });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError || error.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El JSON enviado no es válido.' });
  }
  if (error.status === 413 || error.type === 'entity.too.large') {
    return res.status(413).json({ mensaje: 'El cuerpo de la solicitud supera el máximo de 1 MB.' });
  }
  console.error(error);
  res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
});

export default app;