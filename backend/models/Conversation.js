const moongoose = require('mongoose');

const conversationSchema = new moongoose.Schema({
    participants: [{ type: moongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: { type:moongoose.Schema.Types.ObjectId , ref: 'Message' },
    unreadCount:{ type: Number, default: 0 },

    


},{ timestamps: true });

const Conversation = moongoose.model('Conversation', conversationSchema);
module.exports = Conversation;

