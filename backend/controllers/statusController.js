const Status = require('../models/Status');
const response = require('../utils/responseHandler');
const { uploadFileToCloudinary } = require('../config/cloudinaryConfig');
const Message = require('../models/Message');




exports.createStatus = async (req, res) => {
    try {
        const { content, contentType } = req.body;
        const userId = req.user.userId;
        const file = req.file;
        let mediaUrl = null;
        let finalContentType = contentType || 'text';





        //hanndle file upload
        if (file) {
            const uploadFile = await uploadFileToCloudinary(file);

            if (!uploadFile?.secure_url) {
                return response(res, 400, "File upload failed");
            };
            mediaUrl = uploadFile?.secure_url;
            if (file.mimetype.startsWith('image')) {
                finalContentType = 'image';
            } else if (file.mimetype.startsWith('video')) {
                finalContentType = 'video';
            } else {
                return response(res, 400, "Unsupported file type");
            }

        } else if (content?.trim()) {
            finalContentType = 'text';
        }
        else {
            return response(res, 400, "Content or file is required");
        }
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Status expires in 24 hours

        const status = new Status({
            user: userId,

            content: mediaUrl || content,
            contentType: finalContentType,
            expiresAt



        })
        await status.save();


        const populatedStatus = await Status.findOne(Status?._id)
            .populate('user', 'username profilePicture')
            .populate('viewers', 'username profilePicture')

        //EMIT SOCKET EVENT
        if (req.io && req.socketUserMap) {
            //broadcast the new status to all connected users except the one who created it
            for (const [connectedUserId, socketId] of req.socketUserMap) {
                if (connectedUserId !== userId) {
                    req.io.to(socketId).emit('new_status', populatedStatus);
                }
            }
        }





        return response(res, 201, "Status created  successfully", populatedStatus);
    } catch (error) {
        console.error("Error sending message:", error);
        return response(res, 500, "Internal server error");

    }
}

exports.getStatus = async (req, res) => {
    try {
        const statuses = await Status.find({
            expiresAt: { $gt: new Date() } // Only get statuses that haven't expired
        }).populate('user', 'username profilePicture')
            .populate('viewers', 'username profilePicture').sort({ createdAt: -1 });

        return response(res, 200, "Statuses retrieved successfully", statuses);

    } catch (error) {
        console.error("Error retrieving statuses:", error);
        return response(res, 500, "Internal server error");

    }
}

exports.viewStatus = async (req, res) => {
    const { statusId } = req.params;
    const userId = req.user.userId;

    try {
        const status = await Status.findById(statusId);
        if (!status) {
            return response(res, 404, "Status not found");
        }

        // Add viewer if not already viewed
        if (!status.viewers.includes(userId)) {
            status.viewers.push(userId);
            await status.save();
        } else {
            console.log("User has already viewed this status");
        }

        // Fetch populated status after any update
        const updatedStatus = await Status.findById(statusId)
            .populate('user', 'username profilePicture')
            .populate('viewers', 'username profilePicture');

        //emit socket event 
        if (req.io && req.socketUserMap) {
            //broadcast the new status to all connected users except the one who created it
            const statusOwnnerSocketId = req.socketUserMap.get(status.user._id.toString());
            if (statusOwnnerSocketId) {
                const viewData = {
                    statusId,
                    viewerId: userId,
                    totalViewers: updatedStatus.viewers.length,
                    viewers: updatedStatus.viewers

                }

                req.io.to(statusOwnnerSocketId).emit('status_viewed', viewData);

            } else {
                console.log("Status owner is not connected");

            }

        }




        return response(res, 200, "Status viewed successfully", updatedStatus);

    } catch (error) {
        console.error("Error viewing status:", error);
        return response(res, 500, "Internal server error");
    }
}


exports.deleteStatus = async (req, res) => {
    const { statusId } = req.params;
    const userId = req.user.userId;
    try {
        const status = await Status.findById(statusId);
        if (!status) {
            return response(res, 404, "Status not found");
        }
        if (status.user.toString() !== userId) {
            return response(res, 403, "You are not authorized to delete this status");
        }
        await Status.deleteOne();


        //emit socket event 
        if (req.io && req.socketUserMap) {

            for (const [connectedUserId, socketId] of req.socketUserMap) {
                if (connectedUserId !== userId) {
                    req.io.to(socketId).emit('status_deleted', statusId);
                }
            }

        }







        return response(res, 200, "Status deleted successfully");
    } catch (error) {
        console.error("Error deleting status:", error);
        return response(res, 500, "Internal server error");

    }

}