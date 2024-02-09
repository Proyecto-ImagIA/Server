const express = require('express')
const multer = require('multer');
const url = require('url')

const http = require('http');
const { log } = require('console');
const app = express()
const port = process.env.PORT || 8888
let stop = false;

// Configuring files received through POST Method
const storage = multer.memoryStorage(); // Save files on memory
const upload = multer({ storage: storage });

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

app.post('/data', upload.single('file'), async (req, res) => {
    // Process form data and attached file
    const textPost = req.body;
    console.log(textPost);
    const uploadedFile = req.file;
    let objPost = {}
  
    try {
      objPost = JSON.parse(textPost.data);
    } catch (error) {
      res.status(400).send('Bad request.\n')
      console.log(error)
      return
    }

    if (objPost.type === 'imatge') {
      let prompt = objPost.prompt == "" ? "What is in this picture?" : objPost.prompt
      callLlavaApi(prompt, objPost.image, (chunk) => {
        if (chunk) {
          let resp = JSON.parse(chunk)
  
          if (resp.done || stop) {
            stop = false;
            res.end();
          } else {
            res.write(resp.response);
          }
        }
      });
    }
    else if (objPost.type === 'conversa') {
      callMistralApi(objPost.prompt, (chunk) => {
        if (chunk) {
          let resp = JSON.parse(chunk)
          res.write(resp.response);
          if (resp.done || stop) {
            stop = false;
            res.end();
          }
        }
      });
    }
    else if (objPost.type === 'stop') {
      stop = true;
      res.end();
    }
    else {
      res.status(400).send('Bad request.\n')
    }
  
    function callLlavaApi(prompt, image, onDataCallback) {
      const data = JSON.stringify({
        model: 'llava',
        prompt: prompt,
        images: [image]
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
        res.on('data', chunk => {
          // Call the callback with each fragment of data received
          onDataCallback(chunk);
        });
      });
  
      req.on('error', error => {
        console.error('Error calling MarIA API:', error);
        // Managing errors
      });
  
      req.write(data);
      req.end();
    }
    function callMistralApi(prompt, onDataCallback) {
      const data = JSON.stringify({
        model: 'mistral',
        prompt: prompt
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
        res.on('data', chunk => {
          // Llamar al callback con cada fragmento de datos recibido
          onDataCallback(chunk);
        });
      });
  
      req.on('error', error => {
        console.error('Error al llamar a la API de Mistral:', error);
        // Manejar el error adecuadamente, tal vez con otro callback
      });
  
      req.write(data);
      req.end();
    }
  })