const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFileToCloudinary = async (file) => {
    const options = {
        resource_type: file.mimetype.startsWith('video') ? 'video': 'image', // Automatically detect the resource type

    }

    return new Promise((resolve, reject) => {
        const uploader = file.mimetype.startsWith('video') ? cloudinary.uploader.upload_large : cloudinary.uploader.upload;
        uploader(file.path, options ,(error, result) =>{
            fs.unlinkSync(file.path , ()=>{
                
            }); // Delete the file after upload

            if (error) {
                console.error("Error uploading to Cloudinary:", error);
                return reject(error);
            }
            resolve(result);
        } )
            

    })

}

const multerMiddleware = multer({
    dest: 'uploads/',
}).single('media'); // 'file' is the field name in the form

module.exports = {
    uploadFileToCloudinary,
    multerMiddleware
}