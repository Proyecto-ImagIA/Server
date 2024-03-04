const express = require('express')
const multer = require('multer');
const url = require('url')
const { exec } = require('child_process');

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

app.post('/api/user/validate', (req, res) => {
  try {
    const userData = req.body;
    console.log(userData);
    
    validateUser(userData.phone, userData.code, (resp) => {
      if (resp) {
        resp = JSON.parse(resp);
        console.log(resp);
        if (resp.status === 'OK') {
          res.status(200).send(resp);
        }else{
          console.error('Error validating user:', resp);
          res.status(400).send(resp);
        }
      }
    });


  } catch (error) {
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
          res.status(400).send(resp);
        }
      }
    });

  } catch (error) {
    console.error(error);
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
    });

    req.write(data);
    req.end();
  }
});

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
        res.status(200).send(error);
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
        imatge: image
      });

      const options = {
        hostname: '127.0.0.1',
        port: 8080,
        path: '/api/peticions/crear_peticio',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': '',
          'Content-Length': data.length
        }
      };

      const req = http.request(options, res => {
        options['Authorization'] = req.getHeader('Authorization');
        console.log('Authorization:', options['Authorization']);
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
