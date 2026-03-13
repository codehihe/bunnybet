import React, {useEffect} from "react"

import { io } from 'socket.io-client'

import 'bootstrap/dist/css/bootstrap.min.css'
import "./css/fonts.css"
import "./css/special_occasions.css"
import "./css/style.css"

import Page from "./components/pages/page"

const socket = io(process.env.REACT_APP_SERVER_URL || "", {
  transports: ['websocket', 'polling']
})

function App(){
  	useEffect(() => {
		socket.connect()		
		return () => {
			socket.disconnect()
		}
	}, [])

  	setInterval(()=>{
    	socket.emit('heartbeat', { data: "ping" })
  	}, 15000)

	return <Page socket={socket}/>
}

export default App