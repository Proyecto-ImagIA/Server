const express = require('express')
const multer = require('multer');
const url = require('url')

const http = require('http');
const { log } = require('console');
const app = express()
const port = process.env.PORT || 80
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
    console.log(req.body);
    const textPost = req.body;
    const uploadedFile = req.file;
    let objPost = {}
  
    try {
      objPost = req.body;
    } catch (error) {
      res.status(400).send('Bad request.\n')
      console.log(error)
      return
    }

    let prompt = objPost.prompt == "" ? "What is in this picture?" : objPost.prompt

    registerPetition(prompt, objPost.imatge, (chunk) => {
      if (chunk) {
        console.log(chunk);
        let resp = JSON.parse(chunk);

        if (resp.status || stop) {
          stop = false;
          res.end();
        }else{
          res.write(resp.response);
        }
      }
    });


    callLlavaApi(prompt, objPost.imatge, (error, chunk) => {
      if (error) {
        console.error('Error calling Llava API:', error);
        return;
      }
    
      if (chunk) {
        console.log(chunk);
        let resp = JSON.parse(chunk)
        console.log(resp);
    
        if (resp.done || stop) {
          stop = false;
          res.end();
        } else {
          res.write(resp.response);
        }
      }
    });

    function registerPetition(prompt, image, onDataCallback) {
      const data = JSON.stringify({
        prompt: prompt,
        model: 'llava',
        imatge: image,
        usuari: 1
      });
  
      const options = {
        hostname: '127.0.0.1',
        port: 8080,
        path: '/api/peticions/crear_peticio',
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
          onDataCallback(body);
        });
      });

      req.on('error', error => {
        console.error('Error creating petition', error);
      });
  
      req.write(data);
      req.end();
    }
  
    function callLlavaApi(prompt, image, onDataCallback) {
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
          onDataCallback(body);
        });
      });
      
      req.on('error', error => {
        console.error('Error calling MarIA API:', error);
        // Managing errors
      });
  
      req.write(data);
      req.end();
    }
  })
