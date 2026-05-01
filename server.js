const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const multer       = require('multer');
const cloudinary   = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const connection   = require('./db');

// ── Configuro Cloudinary con las variables de entorno de Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app  = express();
// Render asigna el puerto por variable de entorno, nunca uses 3000 fijo
const port = process.env.PORT || 3000;

// ── Permito solicitudes desde cualquier origen y acepto JSON de hasta 10mb
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rutas principales VAN ANTES del static para que tengan prioridad
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'public.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

// ── UptimeRobot: endpoint de health-check para que el servidor no duerma
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// ── Sirvo CSS, JS e imágenes del frontend como archivos estáticos
// IMPORTANTE: va DESPUÉS de las rutas para que / no sea interceptado
app.use(express.static(path.join(__dirname, 'frontend')));

// ── Configuro multer para subir fotos directo a Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'huellitas_mascotas',       // carpeta dentro de tu cuenta Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, quality: 'auto' }],  // optimizo el tamaño automáticamente
    public_id: (req, file) => `mascota_${Date.now()}`
  }
});

// Solo acepto imágenes de máximo 5mb
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

/* ── LOGIN ── */
app.post('/login', (req, res) => {
  const { usuario, contrasena } = req.body;
  if (!usuario || !contrasena)
    return res.status(400).json({ mensaje: 'Faltan datos' });

  connection.query(
    'SELECT * FROM usuario WHERE Nombre = ? AND Password = ?',
    [usuario, contrasena],
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
      if (results.length === 0)
        return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });

      const user = results[0];
      if (user.estado !== 'aprobado')
        return res.status(403).json({ mensaje: 'Usuario no aprobado' });

      res.json({
        mensaje: 'Login exitoso',
        usuario: { Id: user.Id_usuario, Nombre: user.Nombre, Rol: user.rol }
      });
    }
  );
});

/* ── REGISTRO ── */
app.post('/registro', (req, res) => {
  const { nombre, password } = req.body;
  if (!nombre || !password)
    return res.status(400).json({ mensaje: 'Faltan campos' });

  connection.query(
    'SELECT Id_usuario FROM usuario WHERE Nombre = ?', [nombre],
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
      if (results.length > 0)
        return res.status(409).json({ mensaje: 'El usuario ya existe' });

      connection.query(
        'INSERT INTO usuario (Nombre, Password, rol, estado) VALUES (?, ?, "voluntario", "pendiente")',
        [nombre, password],
        (err2) => {
          if (err2) return res.status(500).json({ mensaje: 'Error en servidor' });
          res.json({ mensaje: 'Solicitud enviada. Espera aprobación.' });
        }
      );
    }
  );
});

/* ── LISTAR SOLICITUDES PENDIENTES ── */
app.get('/solicitudes', (req, res) => {
  connection.query(
    'SELECT Id_usuario, Nombre FROM usuario WHERE estado = "pendiente"',
    (err, results) => {
      if (err) return res.status(500).json([]);
      res.json(results);
    }
  );
});

/* ── APROBAR O RECHAZAR USUARIO ── */
app.post('/solicitud/:id', (req, res) => {
  const { id }     = req.params;
  const { accion } = req.body;

  if (!['aprobado', 'rechazado'].includes(accion))
    return res.status(400).json({ mensaje: 'Acción inválida' });

  connection.query(
    'UPDATE usuario SET estado = ? WHERE Id_usuario = ?', [accion, id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
      res.json({ mensaje: `Usuario ${accion}` });
    }
  );
});

/* ── LISTAR MASCOTAS CON SEMÁFORO ── */
app.get('/mascotas', (req, res) => {
  const { sexo } = req.query;

  const sql  = sexo
    ? 'SELECT * FROM mascota WHERE Sexo = ? ORDER BY Nombre'
    : 'SELECT * FROM mascota ORDER BY Nombre';
  const args = sexo ? [sexo] : [];

  connection.query(sql, args, (err, mascotas) => {
    if (err) return res.status(500).json([]);
    if (!mascotas.length) return res.json([]);

    const ids = mascotas.map(m => m.Id_mascota);
    const hoy = new Date(); hoy.setHours(0,0,0,0);

    connection.query(
      'SELECT * FROM cuidados WHERE id_mascota IN (?) ORDER BY fecha_proxima ASC', [ids],
      (err2, cuidados) => {
        connection.query(
          'SELECT * FROM seguimiento WHERE id_mascota IN (?) ORDER BY fecha DESC', [ids],
          (err3, seguimientos) => {

            const resultado = mascotas.map(m => {
              const misCuidados     = (cuidados     || []).filter(c => c.id_mascota === m.Id_mascota);
              const misSeguimientos = (seguimientos || []).filter(s => s.id_mascota === m.Id_mascota);

              let semaforo = 'gris';
              if (misCuidados.length || misSeguimientos.length) semaforo = 'verde';

              for (const c of misCuidados) {
                if (!c.fecha_proxima) continue;
                const fp   = new Date(c.fecha_proxima);
                const diff = (fp - hoy) / 86400000;
                if (diff < 0)  { semaforo = 'roja';    break; }
                if (diff <= 7) { semaforo = 'amarilla'; }
              }

              if (semaforo !== 'roja' && misSeguimientos.length) {
                const ultimo = misSeguimientos[0];
                if (ultimo.energia != null && ultimo.energia < 4) semaforo = 'roja';
                else if (ultimo.energia != null && ultimo.energia < 7 && semaforo === 'verde') semaforo = 'amarilla';
              }

              const proxCuidado = misCuidados.find(c => c.fecha_proxima);

              return {
                ...m,
                semaforo,
                prox_cuidado_tipo:  proxCuidado?.tipo          || null,
                prox_cuidado_fecha: proxCuidado?.fecha_proxima || null,
              };
            });

            res.json(resultado);
          }
        );
      }
    );
  });
});

/* ── DETALLE DE UNA MASCOTA ── */
app.get('/mascota/:id', (req, res) => {
  const id = req.params.id;

  connection.query('SELECT * FROM mascota WHERE Id_mascota = ?', [id], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ mensaje: 'No encontrada' });
    const m = rows[0];

    connection.query('SELECT * FROM cuidados WHERE id_mascota = ? ORDER BY fecha DESC', [id], (err2, cuidados) => {
      connection.query('SELECT * FROM seguimiento WHERE id_mascota = ? ORDER BY fecha DESC', [id], (err3, seguimientos) => {

        const hoy = new Date(); hoy.setHours(0,0,0,0);
        let semaforo = 'gris';
        if ((cuidados||[]).length || (seguimientos||[]).length) semaforo = 'verde';

        for (const c of (cuidados||[])) {
          if (!c.fecha_proxima) continue;
          const fp   = new Date(c.fecha_proxima);
          const diff = (fp - hoy) / 86400000;
          if (diff < 0)  { semaforo = 'roja';    break; }
          if (diff <= 7) { semaforo = 'amarilla'; }
        }

        if (semaforo !== 'roja' && (seguimientos||[]).length) {
          const u = seguimientos[0];
          if (u.energia != null && u.energia < 4) semaforo = 'roja';
          else if (u.energia != null && u.energia < 7 && semaforo === 'verde') semaforo = 'amarilla';
        }

        res.json({ ...m, semaforo, cuidados: cuidados||[], seguimientos: seguimientos||[] });
      });
    });
  });
});

/* ── AGREGAR MASCOTA ── */
// La foto ahora va a Cloudinary; guardamos la URL segura en la BD
app.post('/mascota', upload.single('fotografia'), (req, res) => {
  const { nombre, edad, peso, sexo, caracteristicas } = req.body;
  if (!nombre || !sexo)
    return res.status(400).json({ mensaje: 'Nombre y Sexo son obligatorios' });

  // Cloudinary devuelve req.file.path como la URL pública HTTPS
  const fotografia = req.file ? req.file.path : null;

  connection.query(
    `INSERT INTO mascota (Nombre, Edad, Peso, Sexo, Caracteristicas, Fotografia)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nombre, edad || null, peso || null, sexo, caracteristicas || null, fotografia],
    (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
      res.json({ mensaje: 'Mascota agregada', id: result.insertId });
    }
  );
});

/* ── EDITAR MASCOTA ── */
app.put('/mascota/:id', upload.single('fotografia'), (req, res) => {
  const { nombre, edad, peso, sexo, caracteristicas } = req.body;
  const id = req.params.id;

  if (req.file) {
    // Nueva foto subida a Cloudinary
    const fotografia = req.file.path;
    connection.query(
      `UPDATE mascota SET Nombre=?, Edad=?, Peso=?, Sexo=?, Caracteristicas=?, Fotografia=? WHERE Id_mascota=?`,
      [nombre, edad || null, peso || null, sexo, caracteristicas || null, fotografia, id],
      (err) => {
        if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
        res.json({ mensaje: 'Mascota actualizada' });
      }
    );
  } else {
    // Sin foto nueva: conservo la que ya tenía
    connection.query('SELECT Fotografia FROM mascota WHERE Id_mascota = ?', [id], (err, rows) => {
      if (err || !rows.length) return res.status(500).json({ mensaje: 'Error en servidor' });
      const fotoActual = rows[0].Fotografia || null;
      connection.query(
        `UPDATE mascota SET Nombre=?, Edad=?, Peso=?, Sexo=?, Caracteristicas=?, Fotografia=? WHERE Id_mascota=?`,
        [nombre, edad || null, peso || null, sexo, caracteristicas || null, fotoActual, id],
        (err2) => {
          if (err2) return res.status(500).json({ mensaje: 'Error en servidor' });
          res.json({ mensaje: 'Mascota actualizada' });
        }
      );
    });
  }
});

/* ── ELIMINAR MASCOTA ── */
app.delete('/mascota/:id', (req, res) => {
  connection.query(
    'DELETE FROM mascota WHERE Id_mascota = ?', [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
      res.json({ mensaje: 'Mascota eliminada' });
    }
  );
});

/* ── LISTAR CUIDADOS ── */
app.get('/cuidados', (req, res) => {
  const { id_mascota } = req.query;

  const sql  = id_mascota
    ? `SELECT c.*, m.Nombre AS NombreMascota
       FROM cuidados c JOIN mascota m ON c.id_mascota = m.Id_mascota
       WHERE c.id_mascota = ? ORDER BY c.fecha DESC`
    : `SELECT c.*, m.Nombre AS NombreMascota
       FROM cuidados c JOIN mascota m ON c.id_mascota = m.Id_mascota
       ORDER BY c.fecha DESC`;
  const args = id_mascota ? [id_mascota] : [];

  connection.query(sql, args, (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results);
  });
});

/* ── AGREGAR CUIDADO ── */
app.post('/cuidado', (req, res) => {
  const { id_mascota, tipo, fecha, fecha_proxima, descripcion } = req.body;
  if (!id_mascota || !tipo || !fecha)
    return res.status(400).json({ mensaje: 'Faltan campos obligatorios' });

  connection.query(
    'INSERT INTO cuidados (id_mascota, tipo, fecha, fecha_proxima, descripcion) VALUES (?, ?, ?, ?, ?)',
    [id_mascota, tipo, fecha, fecha_proxima || null, descripcion || null],
    (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
      res.json({ mensaje: 'Cuidado registrado', id: result.insertId });
    }
  );
});

/* ── ELIMINAR CUIDADO ── */
app.delete('/cuidado/:id', (req, res) => {
  connection.query(
    'DELETE FROM cuidados WHERE id_cuidado = ?', [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al eliminar' });
      res.json({ mensaje: 'Cuidado eliminado' });
    }
  );
});

/* ── EDITAR CUIDADO ── */
app.put('/cuidado/:id', (req, res) => {
  const { tipo, fecha, fecha_proxima, descripcion } = req.body;
  if (!tipo) return res.status(400).json({ mensaje: 'El tipo es obligatorio' });

  connection.query(
    `UPDATE cuidados SET tipo=?, fecha=?, fecha_proxima=?, descripcion=?
     WHERE id_cuidado=?`,
    [tipo, fecha || null, fecha_proxima || null, descripcion || null, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar' });
      res.json({ mensaje: 'Cuidado actualizado' });
    }
  );
});

/* ── LISTAR SEGUIMIENTOS ── */
app.get('/seguimiento', (req, res) => {
  const { id_mascota } = req.query;
  const sql  = id_mascota
    ? `SELECT s.*, m.Nombre AS NombreMascota
       FROM seguimiento s JOIN mascota m ON s.id_mascota = m.Id_mascota
       WHERE s.id_mascota = ? ORDER BY s.fecha DESC`
    : `SELECT s.*, m.Nombre AS NombreMascota
       FROM seguimiento s JOIN mascota m ON s.id_mascota = m.Id_mascota
       ORDER BY s.fecha DESC`;
  const args = id_mascota ? [id_mascota] : [];

  connection.query(sql, args, (err, results) => {
    if (err) return res.status(500).json([]);
    res.json(results);
  });
});

/* ── REGISTRAR SEGUIMIENTO ── */
app.post('/seguimiento', (req, res) => {
  const { id_mascota, fecha, comportamiento, energia, notas } = req.body;
  if (!id_mascota || !fecha)
    return res.status(400).json({ mensaje: 'Faltan campos obligatorios' });

  connection.query(
    'INSERT INTO seguimiento (id_mascota, fecha, comportamiento, energia, notas) VALUES (?, ?, ?, ?, ?)',
    [id_mascota, fecha, comportamiento || null, energia || null, notas || null],
    (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error en servidor' });
      res.json({ mensaje: 'Seguimiento registrado', id: result.insertId });
    }
  );
});

/* ── ELIMINAR SEGUIMIENTO ── */
app.delete('/seguimiento/:id', (req, res) => {
  connection.query(
    'DELETE FROM seguimiento WHERE id_seguimiento = ?', [req.params.id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al eliminar' });
      res.json({ mensaje: 'Seguimiento eliminado' });
    }
  );
});

/* ── DONACIÓN PÚBLICA ── */
app.post('/donacion', (req, res) => {
  const { nombre, descripcion, cantidad, unidad, fecha } = req.body;
  if (!descripcion || !cantidad || !unidad || !fecha)
    return res.status(400).json({ mensaje: 'Faltan campos' });

  connection.query(
    `INSERT INTO donacion (Nombre, Descripcion, Cantidad, unidad, Fecha, Estado)
     VALUES (?, ?, ?, ?, ?, 'Pendiente')`,
    [nombre || 'Anónimo', descripcion, cantidad, unidad, fecha],
    (err) => {
      if (err) { console.error(err); return res.status(500).json({ mensaje: 'Error en servidor' }); }
      res.json({ mensaje: 'Solicitud de donación enviada. Esperando aprobación.' });
    }
  );
});

/* ── DONACIÓN DESDE ADMIN ── */
app.post('/donacion-admin', (req, res) => {
  const { nombre, descripcion, cantidad, unidad, fecha } = req.body;
  if (!descripcion || !cantidad || !unidad || !fecha)
    return res.status(400).json({ mensaje: 'Faltan campos' });

  connection.query(
    `INSERT INTO donacion (Nombre, Descripcion, Cantidad, unidad, Fecha, Estado)
     VALUES (?, ?, ?, ?, ?, 'aprobado')`,
    [nombre || 'Administrador', descripcion, cantidad, unidad, fecha],
    (err, result) => {
      if (err) { console.error(err); return res.status(500).json({ mensaje: 'Error al registrar donación' }); }

      const idDonacion    = result.insertId;
      const tipoConUnidad = `${descripcion} (${unidad})`;

      connection.query(
        'INSERT INTO inventario (Id_donacion, Tipo, Cantidad, Fecha) VALUES (?, ?, ?, ?)',
        [idDonacion, tipoConUnidad, cantidad, fecha],
        (err2) => {
          if (err2) { console.error(err2); return res.status(500).json({ mensaje: 'Donación OK pero error en inventario' }); }
          res.json({ mensaje: 'Donación registrada y agregada al inventario.' });
        }
      );
    }
  );
});

/* ── LISTAR DONACIONES PENDIENTES ── */
app.get('/donaciones', (req, res) => {
  connection.query(
    "SELECT * FROM donacion WHERE Estado = 'Pendiente' ORDER BY Fecha DESC",
    (err, results) => {
      if (err) return res.status(500).json([]);
      res.json(results);
    }
  );
});

/* ── APROBAR O RECHAZAR DONACIÓN ── */
app.post('/donacion/:id', (req, res) => {
  const { id }     = req.params;
  const { accion } = req.body;
  if (!['aprobado', 'rechazado'].includes(accion))
    return res.status(400).json({ mensaje: 'Acción inválida' });

  connection.query(
    'SELECT * FROM donacion WHERE Id_donacion = ?', [id],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(404).json({ mensaje: 'Donación no encontrada' });

      const don = results[0];

      connection.query(
        'UPDATE donacion SET Estado = ? WHERE Id_donacion = ?', [accion, id],
        (err2) => {
          if (err2) return res.status(500).json({ mensaje: 'Error en servidor' });

          if (accion === 'aprobado') {
            const tipoConUnidad = `${don.Descripcion} (${don.unidad || ''})`;
            connection.query(
              'INSERT INTO inventario (Id_donacion, Tipo, Cantidad, Fecha) VALUES (?, ?, ?, ?)',
              [don.Id_donacion, tipoConUnidad, don.Cantidad, don.Fecha],
              (err3) => { if (err3) console.error('Error al agregar inventario:', err3); }
            );
          }

          res.json({ mensaje: `Donación ${accion}` });
        }
      );
    }
  );
});

/* ── LISTAR INVENTARIO ── */
app.get('/inventario', (req, res) => {
  connection.query(
    `SELECT i.Id_inventario, i.Tipo, i.Cantidad, i.Fecha,
            d.unidad AS Unidad
     FROM inventario i
     LEFT JOIN donacion d ON i.Id_donacion = d.Id_donacion
     WHERE i.Cantidad > 0
     ORDER BY i.Fecha DESC`,
    (err, results) => {
      if (err) return res.status(500).json([]);
      res.json(results);
    }
  );
});

/* ── DESCONTAR DEL INVENTARIO ── */
app.post('/inventario/descontar/:id', (req, res) => {
  const { id }       = req.params;
  const { cantidad } = req.body;
  if (!cantidad || isNaN(cantidad) || Number(cantidad) <= 0)
    return res.status(400).json({ mensaje: 'Cantidad inválida' });

  connection.query(
    'SELECT Cantidad FROM inventario WHERE Id_inventario = ?', [id],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(404).json({ mensaje: 'Artículo no encontrado' });

      const disponible = parseFloat(results[0].Cantidad);
      const descontar  = parseFloat(cantidad);

      if (descontar > disponible)
        return res.status(400).json({ mensaje: `Solo hay ${disponible} disponibles` });

      const nueva = disponible - descontar;

      connection.query(
        'UPDATE inventario SET Cantidad = ? WHERE Id_inventario = ?', [nueva, id],
        (err2) => {
          if (err2) return res.status(500).json({ mensaje: 'Error al descontar' });
          res.json({ mensaje: `✓ Descontado. Quedan ${nueva}.` });
        }
      );
    }
  );
});

/* ── AGREGAR AL INVENTARIO ── */
app.post('/inventario/agregar/:id', (req, res) => {
  const { id }       = req.params;
  const { cantidad } = req.body;
  if (!cantidad || isNaN(cantidad) || Number(cantidad) <= 0)
    return res.status(400).json({ mensaje: 'Cantidad inválida' });

  connection.query(
    'SELECT Cantidad FROM inventario WHERE Id_inventario = ?', [id],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(404).json({ mensaje: 'Artículo no encontrado' });

      const actual = parseFloat(results[0].Cantidad);
      const nueva  = actual + parseFloat(cantidad);

      connection.query(
        'UPDATE inventario SET Cantidad = ? WHERE Id_inventario = ?', [nueva, id],
        (err2) => {
          if (err2) return res.status(500).json({ mensaje: 'Error al agregar' });
          res.json({ mensaje: `✓ Agregado. Total: ${nueva}.` });
        }
      );
    }
  );
});

// ── Arranco el servidor en el puerto que asigne Render
app.listen(port, '0.0.0.0', () => {
  console.log('');
  console.log('🐾 Servidor HuellitasTec corriendo en Render!');
  console.log(`   Puerto: ${port}`);
  console.log(`   Health-check disponible en /ping`);
  console.log('');
});
