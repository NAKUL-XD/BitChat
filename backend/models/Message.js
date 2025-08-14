const moongoose = require('mongoose');

const messageSchema = new moongoose.Schema({
    conversation: { type: moongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: moongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    receiver :{ type: moongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true }, 
    imageOrVideoUrl :{ type: String },
    contentType: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
    reactions: [{
        user: { type: moongoose.Schema.Types.ObjectId, ref: 'User' },
       emoji:{type:String}
    }],

    messageStatus: { type: String,  default: 'sent' },

}, { timestamps: true });

const Message = moongoose.model('Message', messageSchema);
module.exports = Message;
