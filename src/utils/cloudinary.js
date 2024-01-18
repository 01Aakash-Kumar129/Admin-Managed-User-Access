import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async(localFilePath)=>{
    try {
        if(!localFilePath) return null
        //upload in cloudinary

        const response= await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        //print fill uploaded successfull
        console.log("file is uploaded on cloudinary", response.url);
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) //remove from my path which was uploaded in temporary file
        return null
    }
}