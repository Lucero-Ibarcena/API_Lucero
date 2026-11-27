import { ahora, db } from "../../config/database.js";

// Lugares públicos de CABA para que la primera carga del directorio no esté vacía.
// Los horarios y contactos se copiaron de los sitios oficiales indicados en cada ficha.
const lugaresInicialesCaba = [
  {
    nombre: "Hospital Escuela de Veterinaria UBA",
    categoria: "veterinaria",
    descripcion:
      "Atención de pequeños animales: lunes a viernes de 9 a 19 h, según la UBA. Confirma turnos e indicaciones antes de ir. Fuente: https://www.uba.ar/redhospitales",
    direccion: "Av. Chorroarín 280",
    localidad: "CABA",
    provincia: "Ciudad Autónoma de Buenos Aires",
    pais: "Argentina",
    telefono: "+54 11 5287-2000",
    email: "admision@fvet.uba.ar",
    latitud: -34.5955641,
    longitud: -58.4774341,
    guardia: false,
  },
  {
    nombre: "CAVI Veterinaria · Caballito",
    categoria: "guardia",
    descripcion:
      "El sitio oficial informa atención las 24 h. Confirma disponibilidad antes de trasladarte. Fuente: https://www.cavi.com.ar/",
    direccion: "Av. La Plata 404",
    localidad: "CABA",
    provincia: "Ciudad Autónoma de Buenos Aires",
    pais: "Argentina",
    telefono: "11 5919-9198",
    email: "",
    latitud: -34.6195684,
    longitud: -58.4281561,
    guardia: true,
  },
  {
    nombre: "Petit CAVI · Flores",
    categoria: "veterinaria",
    descripcion:
      "El sitio oficial informa atención de lunes a sábados de 8 a 20 h. Confirma horarios antes de ir. Fuente: https://www.cavi.com.ar/",
    direccion: "Av. Directorio 2299",
    localidad: "CABA",
    provincia: "Ciudad Autónoma de Buenos Aires",
    pais: "Argentina",
    telefono: "",
    email: "",
    latitud: -34.6328111,
    longitud: -58.4589567,
    guardia: false,
  },
  {
    nombre: "CILAP Central · Villa Crespo",
    categoria: "guardia",
    descripcion:
      "El sitio oficial informa atención de urgencias y consultas las 24 h. Confirma disponibilidad antes de trasladarte. Fuente: https://veterinariacilap.com.ar/contacto/",
    direccion: "Av. Ángel Gallardo 75",
    localidad: "CABA",
    provincia: "Ciudad Autónoma de Buenos Aires",
    pais: "Argentina",
    telefono: "+54 9 11 3137-0132",
    email: "administracion@veterinariacilap.com.ar",
    latitud: -34.6026758,
    longitud: -58.4335597,
    guardia: true,
  },
  {
    nombre: "CentroPet · San Nicolás",
    categoria: "tienda",
    descripcion:
      "Pet shop. El sitio oficial informa atención de lunes a sábados de 11 a 19:30 h. Confirma horarios antes de ir. Fuente: https://centropet.com/",
    direccion: "Av. Córdoba 1557",
    localidad: "CABA",
    provincia: "Ciudad Autónoma de Buenos Aires",
    pais: "Argentina",
    telefono: "11 7079-1234",
    email: "ventas2@centropet.com",
    latitud: -34.5992666,
    longitud: -58.3889976,
    guardia: false,
  },
  {
    nombre: "Parque Centenario",
    categoria: "parque",
    descripcion:
      "Espacio verde público de la Ciudad. Ubicación según el mapa oficial de parques de Buenos Aires.",
    direccion: "Av. Ángel Gallardo y Río de Janeiro",
    localidad: "CABA",
    provincia: "Ciudad Autónoma de Buenos Aires",
    pais: "Argentina",
    telefono: "",
    email: "",
    latitud: -34.603765,
    longitud: -58.437976,
    guardia: false,
  },
];

// Inserta una sola vez y en una transacción los lugares iniciales de referencia.
export function seedInitialPlaces() {
  const clave = "servicios-publicos-caba-v1";
  if (db.prepare("SELECT 1 FROM semillas_aplicadas WHERE clave = ?").get(clave))
    return;

  db.exec("BEGIN IMMEDIATE");
  try {
    if (!db.prepare("SELECT 1 FROM semillas_aplicadas WHERE clave = ?").get(clave)) {
      const insertar = db.prepare(`
        INSERT INTO lugares
          (creador_id, nombre, categoria, descripcion, direccion, localidad,
           provincia, pais, telefono, email, latitud, longitud, guardia,
           verificado, creado_en)
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `);
      const fecha = ahora();
      for (const lugar of lugaresInicialesCaba) {
        insertar.run(
          lugar.nombre,
          lugar.categoria,
          lugar.descripcion,
          lugar.direccion,
          lugar.localidad,
          lugar.provincia,
          lugar.pais,
          lugar.telefono,
          lugar.email,
          lugar.latitud,
          lugar.longitud,
          lugar.guardia ? 1 : 0,
          fecha,
        );
      }
      db.prepare(
        "INSERT INTO semillas_aplicadas (clave, aplicada_en) VALUES (?, ?)",
      ).run(clave, fecha);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
