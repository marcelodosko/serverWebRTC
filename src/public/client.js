const ws = new WebSocket('ws://192.168.0.31:3501')

let connection = null
let otherUsername = 'A'
let channel = null

// WebSocket configuration
ws.onopen = () => {
  console.log('Connected to the signaling server')
}

ws.onerror = err => {
  console.error(err)
}

ws.onmessage = msg => {
  const data = JSON.parse(msg.data)
  console.log('Got Message', data)
  switch (data.type) {
    case 'login':
      handleLogin(data.success)
      break
    case 'offer':
      handleOffer(data.offer, data.username)
      break
    case 'answer':
      handleAnswer(data.answer)
      break
    case 'candidate':
      handleCandidate(data.candidate)
      break
    case 'sendJson':
      sendJson(data.filejson)
    default:
      break
  }
}

// Send messages through webSocket
const sendMessage = message => {
  if (otherUsername) {
    message.otherUsername = otherUsername
  }
  ws.send(JSON.stringify(message))
}

const handleLogin = async success => {
  if (success === false) {
    alert('Username already taken')
  } else {
    const configuration = {
      iceServers: [{ url: 'stun:stun2.1.google.com:19302' }],
    }

    connection = new RTCPeerConnection(configuration)

    console.log('new RTCPeerConnection connection', connection)

    channel = connection.createDataChannel({ optional: [{ RtpDataChannels: true}] })

    connection.ondatachannel = event => {
      event.channel.onmessage = event => {
        console.log('event.channel.onmessage', event.data);
      }

      event.channel.onopen = event => {
          channel.send('RTCDataChannel opened.', event);
      }
      
      event.channel.onclose = event => {
          console.log('RTCDataChannel closed.', event);
      }
      
      event.channel.onerror = event => {
          console.error(event)
      }
    }

    connection.onicecandidate = event => {
      if (event.candidate) {
        sendMessage({
          type: 'candidate',
          candidate: event.candidate
        })
      }
    }
  }
}

const handleOffer = (offer, username) => {
  otherUsername = username
  connection.setRemoteDescription(new RTCSessionDescription(offer))
  connection.createAnswer(
    answer => {
      connection.setLocalDescription(answer)
      sendMessage({
        type: 'answer',
        answer: answer
      })
    },
    error => {
      alert('Error when creating an answer')
      console.error(error)
    }
  )
}

const handleAnswer = answer => {
  connection.setRemoteDescription(new RTCSessionDescription(answer))
}

const handleCandidate = candidate => {
  connection.addIceCandidate(new RTCIceCandidate(candidate))
}

// When the package JSON arrive at the client through WebSocket,
// WebRTC starts to transfer messages to device app 
const sendJson = async fileJson => {
  const cantMjes = fileJson.test.length
  channel.send(cantMjes)
  fileJson.test.forEach(e => channel.send(e)) 
}

const startTest = () =>  ws.send(JSON.stringify({ type: 'startTestWebRTC' }))

document.querySelector('button#run-test').addEventListener('click', () => {
  
  sendMessage({
    type: 'login',
    username:'B'
  })

  setTimeout(() => {
    connection.createOffer(
      offer => {
        sendMessage({
          type: 'offer',
          offer: offer
        })
        connection.setLocalDescription(offer)
      },
      error => console.error(error)
    )
  startTest()
  },
    2500
  )
})
