const { Server } = require('socket.io');
const User = require('../models/User');
const Message = require('../models/Message');
const socketMiddleware = require('../middleware/socketMiddleware');


//map to store connected users
const onlineUsers = new Map();

//map to track typing status
const typingUsers = new Map();


const initializeSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],


        },
        pingTimeout: 60000, // 60 seconds
    })

    //middleware

  io.use(socketMiddleware);

    //when new socket connects
    io.on('connection', (socket) => {
        console.log(`New socket connected: ${socket.id}`);
        let userId = null;

        //handle user connection and mark as online
        socket.on('user_connected', async (connectingUserId) => {
            try {
                console.log('User connected event received:', connectingUserId);
                console.log('Socket ID:', socket.id);
                userId = connectingUserId;
                onlineUsers.set(userId, socket.id);
                socket.join(userId); // Join the user-specific room
                console.log('User added to onlineUsers map:', userId, '->', socket.id);
                console.log('Current online users:', Array.from(onlineUsers.entries()));

                //update user status in db
                await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

                //notify all users that this user is online
                io.emit('user_status', {
                    userId,
                    isOnline: true,
                });


            } catch (error) {
                console.error("Error handling user connection:", error);


            }

        });
        //return online users
        socket.on('get_user_status', (requestedUserId, callback) => {
            const isOnline = onlineUsers.has(requestedUserId);
            callback({
                userId,
                isOnline,
                lastSeen: isOnline ? null : new Date(),
            });

        })

        //forward message to receiver if online
        socket.on('send_message', async (message) => {
            try {
                const receiverSocketId = onlineUsers.get(message.receiver?._id);
                if (receiverSocketId) {
                    //if receiver is online, emit message to receiver
                    io.to(receiverSocketId).emit('receive_message', message);
                }
            } catch (error) {
                console.error("Error sending message:", error);
                socket.emit("message_error", {
                    error: "Failed to send message"
                });

            }


        })


        //update message as read and notify sender
        socket.on('message_read', async (messageIds, senderId) => {
            try {
                await Message.updateMany(
                    { _id: { $in: messageIds } },
                    { $set: { messageStatus: 'read' } }
                );

                const senderSocketId = onlineUsers.get(senderId);
                if (senderSocketId) {
                    messageIds.forEach((messageId) => {
                        io.to(senderSocketId).emit('message_status_update', {
                            messageId,
                            receiverId: userId
                        });
                    });
                }
            } catch (error) {
                console.error("Error updating message status:", error);

            }

        })

        //handle typing status event and auto stop typing after 3 seconds
        socket.on('typing_start', ({ conversationId, receiverId }) => {
            if (!userId || !receiverId || !conversationId) return;

            if (!typingUsers.has(userId)) {
                typingUsers.set(conversationId, new Set(userId));
            }

            const userTyping = typingUsers.get(userId);
            userTyping[conversationId] = true;

            //clear any exising timeout
            if (userTyping[`${conversationId}_timeout`]) {
                clearTimeout(userTyping[`$${conversationId}_timeout`]);
            }

            //auto stop typing after 3 seconds
            userTyping[`${conversationId}_timeout`] = setTimeout(() => {
                userTyping[conversationId] = false;
                socket.to(receiverId).emit('user_typing', { conversationId, userId, isTyping: false });


            }, 3000);

            //notify receiver that user is typing
            socket.to(receiverId).emit('user_typing', { conversationId, userId, isTyping: true });




        });

        //handle stopping typing
        socket.on('typing_stop', ({ conversationId, receiverId }) => {
            if (!userId || !receiverId || conversationId) return;

            if (typingUsers.has(userId)) {
                const userTyping = typingUsers.get(userId);
                userTyping[conversationId] = false;

                if (userTyping[`${conversationId}_timeout`]) {
                    clearTimeout(userTyping[`${conversationId}_timeout`]);
                    delete userTyping[`${conversationId}_timeout`];
                }

            }

            socket.to(receiverId).emit('user_typing', { conversationId, userId, isTyping: false });




        })

        //add reaction to message and upated
        socket.on('add_reaction', async ({ messageId, emoji, userId }) => {
            try {
                console.log('Adding reaction:', { messageId, emoji, userId });
                console.log('Current socket userId:', userId);
                console.log('Online users map:', Array.from(onlineUsers.entries()));

                const message = await Message.findById(messageId);
                if (!message) {
                    console.log('Message not found:', messageId);
                    return;
                }

                console.log('Message found:', message._id, 'Sender:', message.sender._id, 'Receiver:', message.receiver._id);

                const existingIndex = message.reactions.findIndex((r) => r.user.toString() === userId);

                if (existingIndex !== -1) {
                    //if reaction already exists, update it
                    const existing = message.reactions[existingIndex];

                    if (existing.emoji === emoji) {
                        //if same reaction, remove it
                        message.reactions.splice(existingIndex, 1)
                    } else {
                        //change emoji
                        message.reactions[existingIndex].emoji = emoji;
                    }
                } else {
                    //add new reaction
                    message.reactions.push({ user: userId, emoji });
                }
                await message.save();

                const populatedMessage = await Message.findOne(message?._id)
                    .populate('sender', 'username profilePicture')
                    .populate('receiver', 'username profilePicture')
                    .populate('reactions.user', 'username profilePicture');

                const reactionUpdated = {
                    messageId,
                    reactions: populatedMessage.reactions
                }

                console.log('Reaction updated, sending to clients:', reactionUpdated);

                const senderSocket = onlineUsers.get(populatedMessage.sender._id.toString());
                const receiverSocket = onlineUsers.get(populatedMessage.receiver?._id.toString())

                console.log('Sender socket ID:', senderSocket, 'for user:', populatedMessage.sender._id.toString());
                console.log('Receiver socket ID:', receiverSocket, 'for user:', populatedMessage.receiver._id.toString());

                if (senderSocket) {
                    console.log('Emitting reaction_update to sender socket:', senderSocket);
                    io.to(senderSocket).emit('reaction_update', reactionUpdated);
                }
                if (receiverSocket) {
                    console.log('Emitting reaction_update to receiver socket:', receiverSocket);
                    io.to(receiverSocket).emit('reaction_update', reactionUpdated);
                }

            } catch (error) {
                console.log("Error adding reaction:", error);

            }

        })
        //handle socket disconnection and mark user offline
        const handleDisconnected = async (socket) => {
            if (!userId) return;
            try {
                onlineUsers.delete(userId);
                //clear typing status
                if (typingUsers.has(userId)) {
                    const userTyping = typingUsers.get(userId);
                    Object.keys(userTyping).forEach((key) => {
                        if (key.endsWith('_timeout')) {
                            clearTimeout(userTyping[key]);

                        }
                    });
                    typingUsers.delete(userId);
                }

                await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
                io.emit('user_status', {
                    userId,
                    isOnline: false,
                    lastSeen: new Date()
                });
                socket.leave(userId); // Leave the user-specific room
                console.log(`user ${userId} disconnected `);
            } catch (error) {
                console.error("Error handling socket disconnection:", error);

            }
        }
        //diconnect event
        socket.on('disconnect', () => {
            handleDisconnected(socket);
        });



    });
    io.socketUserMap = onlineUsers;

    return io;

};

module.exports = initializeSocket;