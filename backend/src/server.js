import app from './app.js';

const puerto = Number(process.env.PORT || 3000);

app.listen(puerto, () => {
  console.log(`Red de Mascotas disponible en http://localhost:${puerto}`);
});