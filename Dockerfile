# Usa una imagen base de Node.js
FROM node:20-alpine

# Instala FFmpeg
RUN apk add --no-cache ffmpeg

# Crea un directorio para la aplicación
WORKDIR /app

# Copia el package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias de Node.js
RUN npm install

# Copia el resto del código de la aplicación
COPY . .

# Expone el puerto en el que corre la API
EXPOSE 3001

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
