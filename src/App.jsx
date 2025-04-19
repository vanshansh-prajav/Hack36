import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router'
import Auth from './Components/Auth'
import Home from './Components/Home'
import Chat from './Components/Chat'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Auth />}/>
        <Route path='/home' element={<Home />}/>
        <Route path='/chat' element={<Chat />}/>
      </Routes>
    </BrowserRouter>
  )
}

export default App