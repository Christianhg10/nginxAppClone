const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const app = express();
const port = 3001;
const ffmpeg = require('fluent-ffmpeg');
const { pipeline } = require('stream');
const {PassThrough} = require('stream');
const { spawn } = require('child_process');
const { Server } = require('socket.io');
const http = require('http');
const server = http.createServer(app);
const io = new Server(server);


// Configurar el almacenamiento de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage, limits: {fileSize: 100 * 1024 * 1024}});

//localhost
app.use(cors({
  origin: ['https://provata-admin-c240b282fc64.herokuapp.com','https://provata.com.pe','http://localhost:3000','http://localhost:3001'],
  methods: ['GET', 'POST'],
}));

// Ruta para recibir archivos MP4
app.post('/upload', upload.single('video'), (req, res) => {
  const inputPath = path.join('uploads', req.file.filename);
  const outputPath = path.join('public', 'hls', req.file.filename.replace('.mp4', ''));
  
  // Crear el comando FFmpeg para convertir MP4 a HLS
  const command = `ffmpeg -i ${inputPath} -c:v libx264 -c:a aac -strict experimental -f hls -hls_time 3 -hls_list_size 0 -hls_segment_filename "${outputPath}_%03d.ts" ${outputPath}.m3u8`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).send(`Error en la conversión del video-error: ${error.message}`);
    }
    //if (stderr) {
    //  console.error(`Stderr: ${stderr}`);
    //  return res.status(500).send(`Error en la conversión del video: ${stderr}`);
    //}
    fs.unlinkSync(inputPath); // Elimina el archivo MP4 original
    res.send('Video convertido a HLS');
  });
});

// Crear directorios si no existen
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads',{ recursive: true });
if (!fs.existsSync('public/hls')) fs.mkdirSync('public/hls',{ recursive: true });

//Archivos estaticos
app.use('/hls', express.static(path.join(__dirname, 'public','hls')));

//hls get
app.get('/hls/:nameVideo', (req, res) => {
    const nameVideo = req.params.nameVideo;
    const filePath = path.join(__dirname, 'public','hls', `${nameVideo}.m3u8`);

    // Establecer los encabezados adecuados para CORS
    res.setHeader('Access-Control-Allow-Origin', '*'); // Permitir cualquier origen
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Establecer el tipo de contenido adecuado para el archivo .m3u8
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

    // Envía el archivo .m3u8 si existe
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error al enviar el archivo:', err);
            res.status(404).send('Archivo no encontrado: '+filePath);
        }
    });
});

io.on('connection', (socket) => {
  console.log('Client connected');

  // Escuchar el evento 'message'
  socket.on('message', (text) => {
    console.log('Received message:', text);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(3000, () => {
  console.log('Servidor escuchando en el puerto 3000');
});


// Configurar ffmpeg para recibir el flujo y emitirlo a RTMP
// Configuramos FFmpeg usando spawn
const startFFmpeg = (inputStream, rtmpUrl) => {
  
  // Iniciar FFmpeg
  const ffmpeg = spawn('ffmpeg', [
  '-fflags', '+genpts',
  '-i', 'pipe:0',                      // Entrada desde el pipe (frontend)
  '-c:v', 'libx264',                   // Codificador de video H.264 (x264)
  '-b:v', '2500k',                     // Tasa de bits de video
  '-maxrate', '2500k',                 // Tasa de bits máxima
  '-bufsize', '5000k',                 // Tamaño del buffer de bits
  '-g', '50',                          // Intervalo de keyframes (50 asumiendo 25 fps)
  '-keyint_min', '50',                 // Mínimo de intervalos de keyframe
  '-sc_threshold', '0',                // Umbral de cambio de escena
  '-preset', 'veryfast',               // Preset de codificación (puede ser slow, fast, etc.)
  '-tune', 'zerolatency',              // Sintonización para baja latencia
  '-c:a', 'aac',                       // Codificador de audio AAC
  '-b:a', '128k',                      // Tasa de bits de audio
  '-f', 'flv',                         // Formato de salida
    rtmpUrl                  // URL del servidor RTMP
  ]);

  // Redirigir salida estándar y errores de FFmpeg
  ffmpeg.stdout.on('data', (data) => {
    console.log(`Data de FFmpeg stdout: ${data}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`Data de FFmpeg stderr: ${data}`);
  });

  ffmpeg.on('close', (code) => {
    console.log(`Data de FFmpeg process exited with code ${code}`);
  });

  // Redirigir el stream de entrada al proceso FFmpeg
  inputStream.pipe(ffmpeg.stdin);
};

app.post('/stream/:liveCode', (req, res) => {
  // Generar el URL RTMP
  const liveCode =  req.params.liveCode; // Código de stream único
  const rtmpUrl = `rtmp://livestream.provata.shop/stream/${liveCode}`;
  const inputStream = new PassThrough();
  startFFmpeg(inputStream,rtmpUrl);  
  req.pipe(inputStream);
  // Manejar el cierre de la conexión
  req.on('end', () => {
    res.status(200).send('Fragment received');
  });
  req.on('error', (err) => {
    console.error('Request error::',err);
    res.status(500).send('Error processing request');
  });

});
// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
