import { io } from 'socket.io-client';
import useUserStore from '../store/useUserStore';


let socket = null;
const token = localStorage.getItem("auth_token")

export const initializeSocket = () => {
    if (socket) {
        return socket;
    }

    const user = useUserStore.getState().user;

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

    socket = io(BACKEND_URL, {
        auth:{token},
       // withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });
    //connection events
    socket.on('connect', () => {
        console.log('Connected to server', socket.id);
        console.log('User connecting:', user);
        socket.emit('user_connected', user._id);
        console.log('Emitted user_connected with ID:', user._id);
    })

    socket.on("connect_error", (error) => {
        console.error('Connection error:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server', reason);
    });

    return socket;





}

export const getSocket = () => {
    if (!socket) {
        return initializeSocket();
    }
    return socket;
}

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}


