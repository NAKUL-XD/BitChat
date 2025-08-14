const User = require("../models/User");
const response = require("../utils/responseHandler");
const otpGenerate = require("../utils/otpGenerator");
const { sendOtpToEmail } = require("../services/emailService");
const twilloService = require("../services/twilloService");
const generateToken = require('../utils/generateToken');
const { uploadFileToCloudinary } = require("../config/cloudinaryConfig");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const sendOtp = async (req, res) => {
    const { phoneNumber, phoneSuffix, email } = req.body;
    const otp = otpGenerate();
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    let user;

    try {
        // Handle Email OTP
        if (email) {
            user = await User.findOne({ email }) || new User({ email });

            user.emailOtp = otp;
            user.emailOtpExpiry = expiryTime;
            await user.save();

            await sendOtpToEmail(email, otp);

            return response(res, 200, "OTP sent to email");
        }

        // Handle Phone OTP
        if (!phoneNumber || !phoneSuffix) {
            return response(res, 400, "Phone number and suffix are required");
        }

        const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`;
        user = await User.findOne({ phoneNumber: fullPhoneNumber }) || new User({ phoneNumber: fullPhoneNumber, phoneSuffix });

        await twilloService.sendOtpToPhoneNumber(fullPhoneNumber);
        await user.save();

        return response(res, 200, "OTP sent to phone number", {
            fullPhoneNumber,
        });

    } catch (error) {
        console.error("Error sending OTP:", error);
        return response(res, 500, "Internal server error");
    }
};

const verifyOtp = async (req, res) => {
    const { phoneNumber, phoneSuffix, email, otp } = req.body;

    try {
        let user;

        // Email OTP verification
        if (email) {
            user = await User.findOne({ email });
            if (!user) return response(res, 404, "User not found with this email");

            const now = new Date();
            if (!user.emailOtp || String(user.emailOtp) !== String(otp) || new Date(user.emailOtpExpiry) < now) {
                return response(res, 400, "Invalid or expired OTP");
            }

            user.isVerified = true;
            user.emailOtp = null;
            user.emailOtpExpiry = null;
            await user.save();
        } else {
            // Phone OTP verification
            if (!phoneNumber || !phoneSuffix) {
                return response(res, 400, "Phone number and suffix are required");
            }

            const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`;
            user = await User.findOne({ phoneNumber: fullPhoneNumber });
            if (!user) return response(res, 404, "User not found with this phone number");

            const result = await twilloService.verifyOtp(fullPhoneNumber, otp);
            if (result.status !== "approved") {
                return response(res, 400, "Invalid or expired OTP");
            }

            user.isVerified = true;
            user.phoneNumber = fullPhoneNumber;
            await user.save();
        }
        const token = generateToken(user._id);
        res.cookie("auth_token", token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
        });

        return response(res, 200, "OTP verified successfully", {
            token,
            user,
        });

    } catch (error) {
        console.error("Error verifying OTP:", error);
        return response(res, 500, "Internal server error");
    }
};

const updateProfile = async(req, res) => {
    const {username,agreed,about} = req.body;
    const userId = req.user.userId;
    try {
        const user = await User.findById(userId);
        const file = req.file;
        if(file){
            const uploadResult = await uploadFileToCloudinary(file);
            console.log("File uploaded to Cloudinary:", uploadResult);
            user.profilePicture = uploadResult?.secure_url;
        }else if(req.body.profilePicture){
            user.profilePicture = req.body.profilePicture;
        }

        if(username) {
            user.username = username;
        }
        if(agreed) {
            user.agreed = agreed;
        }
        if(about) {
            user.about = about;
        }
        await user.save();
        
        return response(res, 200, "Profile updated successfully",user)

        
    } catch (error) {
        console.error("Error updating profile:", error);
        return response(res, 500, "Internal server error");
        
    }
}

const logout = (req, res) => {
    try {
        res.cookie("auth_token", "", {
            httpOnly: true,
            expires: new Date(0), // Set cookie to expire immediately
        });
        return response(res, 200, "Logged out successfully");
    } catch (error) {
        console.error("Error updating profile:", error);
        return response(res, 500, "Internal server error");
        
    }
}

const checkAuthenticate = async (req, res) => {
    try {
        const userId = req.user.userId;
        if (!userId) {
            return response(res, 404, "User not authenticated !!! please login");
        }
        const user = await User.findById(userId);
        if (!user) {
            return response(res, 404, "User not found");
        }
        return response(res, 200, "User authenticated successfully",user);
    } catch (error) {
        console.error("Error checking authentication:", error);
        return response(res, 500, "Internal server error");
        
    }
}

const getAllusers = async(req, res) => {
    const loggedInUser = req.user.userId;
    try {
        const users = await User.find({ _id: { $ne: loggedInUser } }).select("username profilePicture phoneSuffix phoneNumber email isOnline lastSeen about").lean();
        const usersWithConversation = await Promise.all(users.map(async (user) => {
            const conversation = await Conversation.findOne({
                participants: { $all: [loggedInUser, user?._id] }
            }).populate({
                path: "lastMessage",
                select: "content createdAt sender receiver",
            }).lean();
            
            // Calculate unread count for the current user
            let unreadCount = 0;
            if (conversation) {
                // Count messages that are sent to the current user and not read
                unreadCount = await Message.countDocuments({
                    conversation: conversation._id,
                    receiver: loggedInUser,
                    messageStatus: { $in: ["sent", "delivered"] }
                });
                conversation.unreadCount = unreadCount;
            }
            
            return {
                ...user,
                conversation: conversation || null,
            };
        }));
        return response(res, 200, "Users fetched successfully", usersWithConversation);
    } catch (error) {
        console.error("Error fetching users:", error);
        return response(res, 500, "Internal server error");
    }
}




module.exports = {
    sendOtp,
    verifyOtp,
    updateProfile,
    logout,
    checkAuthenticate,
    getAllusers
};
    

