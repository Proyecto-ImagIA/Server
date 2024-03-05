const express = require('express')
const multer = require('multer');
const url = require('url')
const { exec } = require('child_process');
const winston = require('winston');
const { format } = require('winston');
const fs = require('fs');
const path = require('path');

const http = require('http');
const { log } = require('console');
const app = express()
const port = process.env.PORT || 80
let stop = false;

// Configuring files received through POST Method
const storage = multer.memoryStorage(); // Save files on memory
const upload = multer({ storage: storage });

const getCurrentDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
};

// Define la carpeta donde se guardarán los archivos de registro
const logDirectory = path.join(__dirname, 'logs', getCurrentDateTime());
console.log(logDirectory);

// Crea la carpeta si no existe
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Configura el nombre del archivo de registro basado en la fecha y hora actual
const logFileName = `log.log`;
const logFilePath = path.join(logDirectory, logFileName);

// Configura el logger de Winston
const logger = winston.createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    // Log a la consola
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      ),
    }),
    // Log a un archivo
    new winston.transports.File({ filename: logFilePath }),
  ],
});

// Maneja las excepciones no capturadas
logger.exceptions.handle(
  new winston.transports.File({ filename: path.join(logDirectory, 'uncaughtExceptions.log') })
);

app.use(express.static('public'))

// Receive data from POST method in JSON format
app.use(express.json());

// Activate HTTP server
const httpServer = app.listen(port, appListen)
async function appListen() {
  console.log(`Listening for HTTP queries on: http://localhost:${port}`)
}

// Shutdown all connections when server is stopped
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
function shutDown() {
  console.log('Shutting down server');
  httpServer.close()
  process.exit(0);
}

app.post('/api/user/validate', (req, res) => {
  try {
    const userData = req.body;
    console.log(userData);
    logger.info('Received user data:', userData);

    validateUser(userData.phone, userData.code, (resp) => {
      if (resp) {
        resp = JSON.parse(resp);
        console.log(resp);
        logger.info('Validation response:', resp);
        if (resp.status === 'OK') {
          res.status(200).send(resp);
        }else{
          console.error('Error validating user:', resp);
          logger.error('Error validating user:', resp);
          res.status(400).send(resp);
        }
      }
    });
  } catch (error) {
    logger.error('An error occurred while validating user:', error);
    console.error(error);
    res.status(500).send("ERROR")
  }

  function validateUser(phone, smscode, onDataCallback) {
    const data = JSON.stringify({
      telefon: phone,
      codi_validacio: smscode
    });

    const options = {
      hostname: '127.0.0.1',
      port: 8080,
      path: '/api/usuaris/validar',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }

    const req = http.request(options, res => {
      let chunks = [];
    
      res.on('data', chunk => {
        chunks.push(chunk);
      });
    
      res.on('end', () => {
        let body = Buffer.concat(chunks).toString();
        onDataCallback(body);
      });
    });
    req.on('error', error => {
      console.error('Error validating user', error);
      logger.error('Error validating user', error);
    });

    req.write(data);
    req.end();
  }
});

app.post('/api/user/register', (req, res) => {
  try {
    const userData = req.body;

    registerUser(userData.email, userData.contrasenya, userData.telefon, userData.nickname, (resp) => {
      if (resp) {
        resp = JSON.parse(resp);
        if (resp.status === 'OK') {
          res.status(200).send(resp);
        }else{
          console.error('Error calling DBAPI:', resp);
          logger.error('Error calling DBAPI:', resp);
          res.status(400).send(resp);
        }
      }
    });

  } catch (error) {
    console.error(error);
    logger.error('An error occurred while registering user:', error);
    res.status(500).send("ERROR")
  }

  function registerUser(email, password, phone, nickname, onDataCallback) {

    const data = JSON.stringify({
      email: email,
      contrasenya: password,
      telefon: phone,
      nickname: nickname
    });

    const options = {
      hostname: '127.0.0.1',
      port: 8080,
      path: '/api/usuaris/registrar_usuari',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }
    const req = http.request(options, res => {
      let chunks = [];
    
      res.on('data', chunk => {
        chunks.push(chunk);
      });
    
      res.on('end', () => {
        let body = Buffer.concat(chunks).toString();
        onDataCallback(body);
      });
    });


    req.on('error', error => {
      console.error('Error registering user', error);
      logger.error('Error registering user', error);
    });

    req.write(data);
    req.end();
  }
});

app.post('/data', upload.single('file'), async (req, res) => {
    // Process form data and attached file
    console.log(req.body);
    logger.info('Received form data:', req.body);
    let objPost = {}
  
    try {
      objPost = req.body;
    } catch (error) {
      res.status(400).send('Bad request.\n')
      console.log(error)
      logger.error('Bad request:', error);
      return
    }

    let prompt = objPost.prompt == "" ? "What is in this picture?" : objPost.prompt

    registerPetition(prompt, objPost.imatge, req.headers.authorization, (chunk) => {
      if (chunk) {
        console.log(chunk);
        let resp = JSON.parse(chunk);

        if (resp.status || stop) {
          stop = false;
          if (resp.status === 'OK') {
            console.log('Petition registered');
            console.log('Calling MarIA API...');
            callLlavaApi(prompt, objPost.imatge)
            .then(response => {
              res.status(200).json(response);
              return;
            })
            .catch(error => {
                console.error(error);
                res.status(500).send('Internal Server Error');
            })
            .finally(() => {
              res.end(); // Envía la respuesta solo después de la petición callLlavaApi
            });
          }
        }else{
          res.write(resp.response);
        }
      }
    });


    function registerPetition(prompt, image, token, onDataCallback) {
      const data = JSON.stringify({
        prompt: prompt,
        model: 'llava',
        imatge: image
      });

      console.log(token);
      logger.info('Registering petition:', data);

      const options = {
        hostname: '127.0.0.1',
        port: 8080,
        path: '/api/peticions/crear_peticio',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'Content-Length': data.length
        }
      };

      const req = http.request(options, res => {
        let chunks = [];
      
        res.on('data', chunk => {
          chunks.push(chunk);
        });
      
        res.on('end', () => {
          let body = Buffer.concat(chunks).toString();
          onDataCallback(body);
        });
      });

      req.on('error', error => {
        console.error('Error creating petition', error);
        logger.error('Error creating petition', error);
      });
  
      req.write(data);
      req.end();
    }
  
    function callLlavaApi(prompt, image) {
      return new Promise ((resolve, reject) => {
        const data = JSON.stringify({
          model: 'llava',
          prompt: prompt,
          imatge: image
        });
    
        const options = {
          hostname: '192.168.1.14',
          port: 11434,
          path: '/api/generate',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
          }
        };
    
        const req = http.request(options, res => {
          let chunks = [];
        
          res.on('data', chunk => {
            chunks.push(chunk);
          });
        
          res.on('end', () => {
            let body = Buffer.concat(chunks).toString();
            const response = { status: 200, body: body };
            resolve(response);
          });
        });
        
        req.on('error', error => {
          console.error('Error calling MarIA API:', error);
          logger.error('Error calling MarIA API:', error);
          // Managing errors
        });
    
        req.write(data);
        req.end();
      });
    }
});
