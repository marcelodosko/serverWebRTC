
import express from 'express'
import bodyParser from 'body-parser'
import methodOverride from 'method-override'
import path from 'path'
import cors from 'cors'
import fs from 'fs'
// import page from './web/index.html'
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 3001 })
const users = {}

const app = express()
const port = process.env.PORT || 3000
const router = express.Router()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(cors())
app.use(methodOverride())
app.use(router)

const sendTo = (ws, message) => {
  ws.send(JSON.stringify(message))
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
      case 'getJson':
      console.log('llego', data)
        fs.readFile(`./tests/${data.name}.json`, (err, data) => {
          err && console.log('error', err)
           const loremIpsum = JSON.parse(data)
           sendTo(ws, { type: 'sendJson', filejson: loremIpsum})
        })
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
