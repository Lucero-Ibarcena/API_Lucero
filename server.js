import express from 'express';
import { fileURLToPath } from 'node:url';
import mascotasRoutes from './routes/mascotas.js';
import usuariosRoutes from './routes/usuarios.js';

const app = express();
const puerto = process.env.PORT || 3000;
const paginaAyuda = fileURLToPath(new URL('./public/ayuda.html', import.meta.url));

app.use(express.json());

// La página principal abre una guía.
app.get('/', (_req, res) => res.redirect('/ayuda'));
app.get('/ayuda', (_req, res) => res.sendFile(paginaAyuda));

// Cada grupo de rutas vive en su propio archivo para poder ampliarlo fácilmente.
app.use('/usuarios', usuariosRoutes);
app.use('/mascotas', mascotasRoutes);

app.use((_req, res) => {
    res.status(404).json({ mensaje: 'Ruta no encontrada. Consulta la guía en /ayuda.' });
});

// Devuelve un mensaje claro cuando el JSON enviado no tiene el formato correcto.
app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError) {
        return res.status(400).json({ mensaje: 'El JSON enviado no es válido.' });
    }
    console.error(error);
    res.status(500).json({ mensaje: 'Ocurrió un error en el servidor.' });
});

app.listen(puerto, () => {
    console.log(`API lista en http://localhost:${puerto}`); //TAMBIEN PUEDE TENER DIRECTAMENTE 3000 EN LUGAR DE PUERTO (o como dice en este caso puerto)
});