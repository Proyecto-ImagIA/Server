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
    callLlavaApi(prompt, objPost.images, (chunk) => {
      if (chunk) {
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
  })