const moongoose = require('mongoose');

const userSchema = new moongoose.Schema({
    phoneNumber:{type:String, required:false,sparse:true ,unique:true},
    phoneSuffix:{type:String,unique:false,required:false},
    username:{type:String, required:false},
    email:{
        type:String,
        required:false,
        unique:true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} is not a valid email!`
        },
       
    },
    
emailOtp: { type: String },
emailOtpExpiry: { type: Date },
profilePicture: { type: String },
about: { type: String },
lastSeen: { type: Date },
isOnline: { type: Boolean, default: false },
isVerified: { type: Boolean, default: false },
agreed: { type: Boolean, default: false },





},{    timestamps: true,});
const User = moongoose.model('User', userSchema);
module.exports = User;