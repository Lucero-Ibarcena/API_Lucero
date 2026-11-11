//Hacer una API, un CRUD

//administración de mascotas por usuarios según id y otras caracteristicas (como nombre, dueño, etc)


import express from 'express';

const app = express();

app.use(express.json());

// MIDDLEWARE: muestra las solicitudes recibidas
app.use((req, res, next) => {
    console.log(`Middleware → ${req.method} ${req.url}`);
    next();
});

// DATOS DE EJEMPLO (simulando una base de datos)


let mascotas = [
    {
    id: 1,

    // Datos de la mascota
    nombre: 'Luna',
    especie: 'Perro',
    raza: 'Caniche',
    edad: 3,
    sexo: 'Hembra',
    color: 'Blanco',
    peso: 6.5,

    // Datos del dueño
    dueño: {
        nombre: 'Ana',
        telefono: '1123456789',
        direccion: 'Buenos Aires',
        email: 'ana@gmail.com'
    },

    // Información adicional
    vacunado: true,
    castrado: false,
    observaciones: 'Tiene una pequeña mancha en la pata derecha'
    },

    {
    id: 2,

    // Datos de la mascota
    nombre: 'Michi',
    especie: 'Gato',
    raza: 'Siames',
    edad: 2,
    sexo: 'Macho',
    color: 'Café',
    peso: 3,

    // Datos del dueño
    dueño: {
        nombre: 'Luis',
        telefono: '1123456789',
        direccion: 'Buenos Aires',
        email: 'luis@gmail.com'
    },

    // Información adicional
    vacunado: true,
    castrado: false,
    observaciones: 'Tiene una pequeña mancha en forma de corazon en el pecho'
    },

    {
    id: 3,

    // Datos de la mascota
    nombre: 'Rocky',
    especie: 'Perro',
    raza: 'Labrador',
    edad: 5,
    sexo: 'Macho',
    color: 'Blanco',
    peso: 7.8,

    // Datos del dueño
    dueño: {
        nombre: 'Carla',
        telefono: '1123456789',
        direccion: 'CABA',
        email: 'carla@gmail.com'
    },

    // Información adicional
    vacunado: true,
    castrado: false,
    observaciones: 'Tiene un pequeño corte en la oreja izquierda'
    }
];

// RUTA PRINCIPAL
app.get('/', (req, res) => {
    res.send('Bienvenido a la API de Mascotas');
});

// GET: consultar todas las mascotas
app.get('/mascotas', (req, res) => {
    res.json(mascotas);
});

// GET: buscar mascota por ID
app.get('/mascotas/:id', (req, res) => {
    const id = Number(req.params.id);

    const mascota = mascotas.find(m => m.id === id);

    if (!mascota) {
        return res.status(404).json({
            mensaje: 'Mascota no encontrada'
        });
    }

    res.json(mascota);
});


//AGREGAR MÁS FILTROS (CARACTERISTICAS COMO NOMBRE DE LA MASCOTA, ESPECIE, RAZA, EDAD, SEXO, COLOR, TAMAÑO, NOMBRE DEL DUEÑO, ETC)

// GET: buscar mascota por nombre de la mascota
app.get('/mascotas/nombremascota/:nombremascota', (req, res) => {
    const nombremascota = req.params.nombremascota;

    const mascota = mascotas.filter(m => m.nombre === nombremascota);

    if (mascota.length === 0) {
        return res.status(404).json({
            mensaje: 'Mascota no encontrada'
        });
    }

    res.json(mascota);
});

// GET: buscar mascota por especie
app.get('/mascotas/especie/:especie', (req, res) => {
    const especie = req.params.especie;

    const mascota = mascotas.filter(m => m.especie === especie);

    if (mascota.length === 0) {
        return res.status(404).json({
            mensaje: 'Mascota no encontrada'
        });
    }

    res.json(mascota);
});

// GET: buscar mascota por raza
app.get('/mascotas/raza/:raza', (req, res) => {
    const raza = req.params.raza;

    const mascota = mascotas.filter(m => m.raza === raza);

    if (mascota.length === 0) {
        return res.status(404).json({
            mensaje: 'Mascota no encontrada'
        });
    }

    res.json(mascota);
});

// GET: buscar mascota por edad
app.get('/mascotas/edad/:edad', (req, res) => {
    const edad = req.params.edad;

    const mascota = mascotas.filter(m => m.edad === edad);

    if (isNaN(edad) || edad < 0) {
        return res.status(400).json({
            mensaje: 'La edad debe ser un número válido'
        });
    }

    res.json(mascota);
});

// GET: buscar mascota por sexo
app.get('/mascotas/sexo/:sexo', (req, res) => {
    const sexo = req.params.sexo;

    const mascota = mascotas.filter(m => m.sexo === sexo);

    if (mascota.length === 0) {
        return res.status(404).json({
            mensaje: 'Mascota no encontrada'
        });
    }

    res.json(mascota);
});

// GET: buscar mascota por color
app.get('/mascotas/color/:color', (req, res) => {
    const color = req.params.color;

    const mascota = mascotas.filter(m => m.color === color);

    if (mascota.length === 0) {
        return res.status(404).json({
            mensaje: 'Mascota no encontrada'
        });
    }

    res.json(mascota);
});

// GET: buscar mascota por nombre de la mascota
app.get('/mascotas/tamaño/:tamaño', (req, res) => {
    const tamaño = req.params.tamaño;

    const mascota = mascotas.filter(m => m.tamaño === tamaño);

    if (mascota.length === 0) {
        return res.status(404).json({
            mensaje: 'Mascota no encontrada'
        });
    }

    res.json(mascota);
});

// GET: buscar mascota por nombre del dueño
app.get('/mascotas/dueño/:nombredueño', (req, res) => {
    const nombredueño = req.params.nombredueño;

    const mascota = mascotas.filter(m => m.nombre === nombredueño);

    if (mascota.length === 0) {
        return res.status(404).json({
            mensaje: 'Mascota no encontrada'
        });
    }

    res.json(mascota);
});


// POST: registrar una nueva mascota
app.post('/mascotas', (req, res) => {
    const nuevaMascota = req.body;

    const id = mascotas.length > 0
        ? Math.max(...mascotas.map(m => m.id)) + 1
        : 1;

    const mascotaCreada = {
        id,
        ...nuevaMascota
    };

    mascotas.push(mascotaCreada);

    res.status(201).json(mascotaCreada);
});

// PUT: modificar una mascota
app.put('/mascotas/:id', (req, res) => {
    const id = Number(req.params.id);

    const indice = mascotas.findIndex(m => m.id === id);

    if (indice === -1) {
        return res.status(404).json({
            mensaje: 'Mascota no encontrada'
        });
    }

    mascotas[indice] = {
        ...mascotas[indice],
        ...req.body,
        id
    };

    res.json(mascotas[indice]);
    res.json({
        mensaje: "mascota actualizada corectamente",
        mascotas:[indice]
    });


});

// DELETE: eliminar una mascota
app.delete('/mascotas/:id', (req, res) => {
    const id = Number(req.params.id);

    const indice = mascotas.findIndex(m => m.id === id);

    if (indice === -1) {
        return res.status(404).json({
            mensaje: 'Mascota no encontrada'
        });
    }

    const mascotaEliminada = mascotas.splice(indice, 1);

    res.json({
        mensaje: 'Mascota eliminada correctamente',
        mascota: mascotaEliminada[0]
    });
});

// INICIAR SERVIDOR
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});


