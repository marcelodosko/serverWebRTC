
import express from 'express'
import psTree from 'ps-tree'
import  { exec, spawn, execSync } from 'child_process'
import bodyParser from 'body-parser'
import methodOverride from 'method-override'
import path from 'path'
import ADB from 'appium-adb'
import cors from 'cors'
import fs from 'fs'

import FileService from './fileService'
// import page from './web/index.html'
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 3501 })
const users = {}

const app = express()
const port = process.env.PORT || 3500
const router = express.Router()
let nameJson = 1000

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cors())
app.use(methodOverride())
app.use(router)

const sendTo = (ws, message) => {
  ws.send(JSON.stringify(message))
}

let cpu = {}

const getRunningApp = () => {
        const command = `adb shell top | grep com.livestreama+`;
        console.log('🗒 [ADB - Listing processes]:', command);
        // return spawn('sh', ['-c', command]);
        return exec(command)
}
const listenAndSaveCPUusage = (fileName, folderName) => {
      console.log('👂 [ADB - Listening processes]');
      cpu.stdout.on('data', data => {
          console.log('📝 [ADB - Writing outputs]');
          const fileService = new FileService(folderName, fileName);
          fileService._writeFile(data);
      })
      cpu.stderr.on('data', function(data) {
          console.log('stdout: ' + data);
      });
      cpu.on('close', function(code) {
          console.log('closing code: ' + code);
      });
  }

  const kill = (pid, signal, callback) => {
    signal   = signal || 'SIGTERM';
    callback = callback || function () {};
    var killTree = true;
    if(killTree) {
        psTree(pid, function (err, children) {
            [pid].concat(
                children.map(function (p) {
                    return p.PID;
                })
            ).forEach(function (tpid) {
                console.log('foreach pids', tpid)
                try { execSync(`kill ${tpid}`) }
                catch (ex) { }
            });
            callback();
        });
    } else {
        try { cpu.kill(pid, signal) }
        catch (ex) { }
        callback();
    }
}

const closeCPUSocket = (techType) => {
  console.log('kill')
  setTimeout(() => kill(cpu.pid), 5000)
  if (nameJson <= 10000) {
    techType === 'webrtc'
    ? setTimeout(() => startTest(users['B'], techType), 5000)
    : setTimeout(() => startTest(users['A'], techType), 5000)
  }
}

const startTest = (ws, techType) => {
  cpu = getRunningApp()
  listenAndSaveCPUusage(`${nameJson}`, techType)
  fs.readFile(`./tests/${nameJson}.json`, (err, data) => {
    err && console.log('error', err)
    const loremIpsum = JSON.parse(data)
    if (techType === 'webrtc'){  
      setTimeout(() => sendTo(ws, { type: 'sendJson', filejson: loremIpsum}), 5000)
    } else {
      setTimeout(() => sendLoremIpsun(ws, loremIpsum), 5000)
    }
  })
  nameJson += 250
}

const sendLoremIpsun = (ws, loremIpsum) => {
  const cantMjes = loremIpsum.test.length
  sendTo(ws, { type: 'setCantMjes', cantMjes})
  loremIpsum.test.forEach(e => sendTo(ws, { type: 'loremIpsum', message: e}))
}

wss.on('connection', ws => {
  console.log('User connected')

  ws.on('message', message => {
    let data = null

    try {
      data = JSON.parse(message)
    } catch (error) {
      console.error('Invalid JSON', error)
      data = {}
    }

    switch (data.type) {
      case 'login':
        console.log('User logged', data.username)
        if (users[data.username]) {
          sendTo(ws, { type: 'login', success: false })
        } else {
          users[data.username] = ws
          ws.username = data.username
          sendTo(ws, { type: 'login', success: true })
        }
        break
      case 'offer':
        console.log('Sending offer to: ', data.otherUsername)
        if (users[data.otherUsername] != null) {
          ws.otherUsername = data.otherUsername
          sendTo(users[data.otherUsername], {
            type: 'offer',
            offer: data.offer,
            username: ws.username
          })
        }
        break
      case 'answer':
        console.log('Sending answer to: ', data.otherUsername)
        if (users[data.otherUsername] != null) {
          ws.otherUsername = data.otherUsername
          sendTo(users[data.otherUsername], {
            type: 'answer',
            answer: data.answer
          })
        }
        break
      case 'candidate':
        console.log('Sending candidate to:', data.otherUsername)
        if (users[data.otherUsername] != null) {
          sendTo(users[data.otherUsername], {
            type: 'candidate',
            candidate: data.candidate
          })
        }
        break
      case 'close':
        console.log('Disconnecting from', data.otherUsername)
        console.log('users[data.otherUsername].otherUsername', users[data.otherUsername].otherUsername)
        users[data.otherUsername].otherUsername = null

        if (users[data.otherUsername] != null) {
          sendTo(users[data.otherUsername], { type: 'close' })
        }
        break
      case 'startTestWebSocket':
        startTest(users['A'], 'websocket')
        break
      case 'startTestWebRTC':
        startTest(users['B'], 'webrtc')
        break
      case 'stopADB':
        console.log('Stop ADB')
        closeCPUSocket(data.testType)
        break
          
      default:
        sendTo(ws, {
          type: 'error',
          message: 'Command not found: ' + data.type
        })

        break
    }
  })

  ws.on('close', () => {
    if (ws.username) {
      delete users[ws.username]

      if (ws.otherUsername) {
        console.log('Disconnecting from ', ws.otherUsername)
        users[ws.otherUsername].otherUsername = null

        if (users[ws.otherUsername] != null) {
          sendTo(users[ws.otherUsername], { type: 'close' })
        }
      }
    }
  })
})

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname+'/index.html'))
})

app.listen(port, () => console.log('Server on port: ', port))
