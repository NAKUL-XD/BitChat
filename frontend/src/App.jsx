import React, { useEffect } from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './pages/user-login/Login.jsx';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'
import { ProtectedRoute, PublicRoute } from './protected';
import HomePage from './components/HomePage.jsx'
import UserDetails from './components/UserDetails.jsx';
import Status from './pages/statusSection/Status.jsx';
import Setting from './pages/settingSection/Setting.jsx';
import useUserStore from './store/useUserStore.js';
import { disconnectSocket, initializeSocket } from './services/chat.service.js';
import { useChatStore } from './store/chatStore.js';

const App = () => {
  const {user} = useUserStore();
  const {setCurrentUser,initisocketListeners,cleanUp} = useChatStore();

  useEffect(() => {
    if(user?._id){
      const socket = initializeSocket();


      if(socket){
        setCurrentUser(user);

       initisocketListeners();

      }





    }
    return () => {
      cleanUp();
      disconnectSocket();
   
  }
},[user,setCurrentUser,initisocketListeners,cleanUp])
  

  return (
    <>
      <ToastContainer position='top-right' autoClose={3000} />
      <Router>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/user-login" element={<Login />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path='/' element={<HomePage />} />
            <Route path='/user-profile' element={<UserDetails />} />
            <Route path='/status' element={<Status/>} />
            <Route path='/setting' element={<Setting />} />

          </Route>



        </Routes>
      </Router>


    </>

  )
}

export default App
