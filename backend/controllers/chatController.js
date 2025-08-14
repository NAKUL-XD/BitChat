const Conversation = require('../models/Conversation');
const response = require('../utils/responseHandler');
const { uploadFileToCloudinary } = require('../config/cloudinaryConfig');
const Message = require('../models/Message');




exports.sendMessage = async (req, res) => {
    try {
        const { senderId, receiverId, content, messageStatus } = req.body;
        const file = req.file;

        const participants = [senderId, receiverId].sort();
        let conversation = await Conversation.findOne({ participants: participants });
        if (!conversation) {
            conversation = new Conversation({
                participants,


            });

            await conversation.save();
        }
        let imageOrVideoUrl = null;
        let contentType = null;

        //hanndle file upload
        if (file) {
            const uploadFile = await uploadFileToCloudinary(file);

            if (!uploadFile?.secure_url) {
                return response(res, 400, "File upload failed");
            };
            imageOrVideoUrl = uploadFile?.secure_url;
            if (file.mimetype.startsWith('image')) {
                contentType = 'image';
            } else if (file.mimetype.startsWith('video')) {
                contentType = 'video';
            } else {
                return response(res, 400, "Unsupported file type");
            }

        } else if (content?.trim()) {
            contentType = 'text';
        }
        else {
            return response(res, 400, "Content or file is required");
        }

        const message = new Message({
            conversation: conversation?._id,
            sender: senderId,
            receiver: receiverId,
            content,
            contentType,
            imageOrVideoUrl,

            messageStatus
        })
        await message.save();
        if (message?.content) {

            conversation.lastMessage = message?._id;
        }
        await conversation.save();

        const populatedMessage = await Message.findOne(message?._id)
            .populate('sender', 'username profilePicture')
            .populate('receiver', 'username profilePicture')
            .populate('reactions.user', 'username profilePicture');

        //emit event socket for realtime
        if (req.io && req.socketUserMap) {
            const receiverSocketId = req.socketUserMap.get(receiverId);
            if (receiverSocketId) {
                req.io.to(receiverSocketId).emit('receive_message', populatedMessage);
                message.messageStatus = 'delivered'; // Update message status to delivered
                await message.save();
            }



        }





        return response(res, 201, "Message sent successfully", populatedMessage);
    } catch (error) {
        console.error("Error sending message:", error);
        return response(res, 500, "Internal server error");

    }
}

//get all conversation


exports.getConversation = async (req, res) => {
    const userId = req.user.userId;
    try {

        let conversation = await Conversation.find({ participants: userId }).populate('participants', 'username profilePicture isOnline lastSeen')
            .populate({ path: 'lastMessage', populate: { path: 'sender receiver reactions.user', select: 'username profilePicture' } }).sort({ updatedAt: -1 });
        return response(res, 201, "Conversations retrieved successfully", conversation);
    } catch (error) {
        console.error("Error retrieving conversations:", error);
        return response(res, 500, "Internal server error");



    }

};

//get messages of specific conversation

exports.getMessages = async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return response(res, 404, "Conversation not found");
        };

        if (!conversation.participants.includes(userId)) {
            return response(res, 403, "You are not a participant in this conversation");
        }

        const messages = await Message.find({ conversation: conversationId })
            .populate('sender', 'username profilePicture')
            .populate('receiver', 'username profilePicture')
            .populate('reactions.user', 'username profilePicture')
            .sort({ createdAt: 1 });

        await Message.updateMany(
            { conversation: conversationId, receiver: userId, messageStatus: { $in: ["sent", "delivered"] } },
            { $set: { messageStatus: 'read' } }
        );

        return response(res, 200, "Messages retrieved successfully", messages);

    } catch (error) {
        console.error("Error retrieving messages:", error);
        return response(res, 500, "Internal server error");

    }
}

//mark as read
exports.markAsRead = async (req, res) => {
    const { messageIds } = req.body;
    const userId = req.user.userId;

    try {
        //get relevant messages to determine senders
        let messages = await Message.find({ _id: { $in: messageIds }, receiver: userId, })
        await Message.updateMany(
            { _id: { $in: messageIds }, receiver: userId },
            { $set: { messageStatus: 'read' } }
        );


        //notify to og sender
        if (req.io && req.socketUserMap) {
            const receiverSocketId = req.socketUserMap.get(receiverId);
            for (const message of messages) {
                if (receiverSocketId) {
                    const senderSocketId = req.socketUserMap.get(message.sender.toString());
                    if (senderSocketId) {
                        const updatedMessage = {
                            _id: message._id,
                            messageStatus: 'read',

                        };
                        req.io.to(senderSocketId).emit('message_read', updatedMessage);
                        await message.save();
                    }


                };
            }
        }




        return response(res, 200, "Messages marked as read successfully", messages);

    } catch (error) {
        console.error("Error marking messages as read:", error);
        return response(res, 500, "Internal server error");

    }
}

//delete message
exports.deleteMessage = async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.userId;


    try {
        const message = await Message.findById(messageId);
        if (!message) {
            return response(res, 404, "Message not found");
        }
        if (message.sender.toString() !== userId) {
            return response(res, 403, "You are not authorized to delete this message");
        }
        await message.deleteOne();

        if (req.io && req.socketUserMap) {
            const receiverSocketId = req.socketUserMap.get(message.receiver.toString())
            if (receiverSocketId) {
                req.io.to(receiverSocketId).emit('message_deleted', messageId);
            }



        }

        return response(res, 200, "Message deleted successfully");
    } catch (error) {
        console.error("Error deleting message:", error);
        return response(res, 500, "Internal server error");

    }
}
