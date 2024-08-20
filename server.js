const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001;

// Configurar el almacenamiento de multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage }, limits: {fileSize: 100 * 1024 * 1024});

// Ruta para recibir archivos MP4
app.post('/upload', upload.single('video'), (req, res) => {
  const inputPath = path.join('uploads', req.file.filename);
  const outputPath = path.join('public', 'hls', req.file.filename.replace('.mp4', ''));
  
  // Crear el comando FFmpeg para convertir MP4 a HLS
  const command = `ffmpeg -i ${inputPath} -c:v libx264 -c:a aac -strict experimental -f hls -hls_time 10 -hls_list_size 0 -hls_segment_filename "${outputPath}_%03d.ts" ${outputPath}.m3u8`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).send(`Error en la conversión del video-error: ${error.message}`);
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return res.status(500).send(`Error en la conversión del video: ${stderr}`);
    }
    fs.unlinkSync(inputPath); // Elimina el archivo MP4 original
    res.send('Video convertido a HLS');
  });
});

// Crear directorios si no existen
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads',{ recursive: true });
if (!fs.existsSync('public/hls')) fs.mkdirSync('public/hls',{ recursive: true });

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
