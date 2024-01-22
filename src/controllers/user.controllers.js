import { asyncHandller } from "../utils/asyncHandller.js";
import { apiError}  from "../utils/apiError.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"

//access token and refresh token generate method

const generateAccessAndRefreshTokens= async(userId)=>{
    try {
        const user =await User.findById(userId)
        const accessToken= user.generateAccessToken()
        const refreshToken= user.generateRefreshToken()

        user.refreshToken= refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new apiError(500, "Something went to wrong while generating refresh and access Token")
    }
}


//Register User Controller below

const registerUser= asyncHandller( async(req,res)=>{

    //testing
    /*
    res.status(200).json({
        message: "ok"
    })

    */
    //1.get user detail from frontend
    //2.validation - not empty
    //3.check if user already exist : username, email
    //4.check for images, check for avatar
    //5.upload them in cloudinary, avatar
    //6.create user object - create entry in db
    //7.remove password and refresh token field from respose
    //8.check user creation
    //9.return res
    
    //1.
    const {fullname, email, username, password} = req.body
    //console.log("email:  ",email);
    
    //This is checking indiviadul so if you want to check all the element in once you have to go with"some" in below
    // if(fullname===""){
    //     throw new apiError(400, "Name is reqiured")
    // }    

    //2.
    if(
        [fullname, email, username, password].some((field)=>
        field?.trim()==="")
    ){
        throw new apiError(400, "All fields are required")
    }

    //3.
    const existingUser= await User.findOne({
        $or: [{ username },{ email }]
    })
    if(existingUser){
        throw new apiError(409, "User with email or username already exists")
    }

    //4.
    const avatarLocalPath =req.files?.avatar[0]?.path;
    //const coverImageLocalPath= req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath=req.files.coverImage[0].path
    }


    if(!avatarLocalPath){
        throw new apiError(400, "Avatar file is required")
    }

    //5.
    const avatar= await uploadOnCloudinary(avatarLocalPath)
    const coverImage= await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new apiError(400, "Avatar file is required")
    }

    //6.
    const user= await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    //7.
    const createUser= await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //8.
    if(!createUser){
        throw new apiError(500, "Something went to wrong while registering the user")
    }

    //9.
    return res.status(201).json(
        new apiResponse(200, createUser, "User register Successfully")
    )

})

//Login User Controller below

const loginUser= asyncHandller(async(req,res)=>{
    //1.req body->data
    //2.username or email
    //3.find the user present or not
    //4.password check vaild or not
    //5.access and refresh token
    //6.send cookie
    //7. respond

    //1.
    const {email,username,password}= req.body

    //2.
    if(!(username || email)){
        throw new apiError(400, "username or email is required")
    }

    //3.
    const user= await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new apiError(404, "User does not exist")
    }

    //4.
    const isPasswordvalid= await user.ispasswordCorrect(password)

    if(!isPasswordvalid){
        throw new apiError(401, "Invalid user credentials")
    }

    //5.
    const {accessToken,refreshToken}= await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")

    //6.
    const options= {
        httpOnly:true,
        secure:true
    }

    //7.
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new apiResponse(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "User logged In Successfully"
        )
    )

})

//Logout User Controller below

const logoutUser= asyncHandller(async(req, res)=>{
    //1. clear refresh Token so we have to add auth middleware
    //2. clear cookies

     //1.
     await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200,{},"User logged Out"))
})

//refreshAccessToken endpoint

const refreshAccessToken= asyncHandller(async(req, res)=>{
    const incomingRefreshToken= req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new apiError(401, "Unautorized request")
    }

    try {
        const decodedToken=jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user= await User.findById(decodedToken?._id)
    
        if(!user){
            throw new apiError(401, "Invalid refresh Token")
    
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new apiError(401, "Refresh token is expired or used")
        }
    
        const options={
            httpOnly:true,
            secure:true
        }
    
         const { accessToken, newRefreshToken} =await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken,options)
        .cookie("refreshToken", newRefreshToken,options)
        .json(
            new apiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token" )
    }
})

//change Current Password

const changeCurrentPassword= asyncHandller(async(req, res)=>{
    const {oldPassword, newPassword}= req.body

    const user=await User.findById(req.user?._id)

    const ispasswordCorrect= await user.ispasswordCorrect(oldPassword)

    if(!ispasswordCorrect){
        throw new apiError(400, "Invalid old Password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(
        new apiResponse(200,{},"Password changed Successfully")
    )
})

//get current User

const getCurrentUser= asyncHandller(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user, "Current user fetched Successfully")
})

// update account details

const updateAccountDetails= asyncHandller(async(req, res)=>{
    const {fullname, email}=req.body

    if(!fullname || !email){
        throw new apiError(400, "All fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200, user, "Account details updated Successfully")
    )

})

//update user avatar

const updateUserAvatar= asyncHandller(async(req,res)=>{
    const avatarLocalPath= req.file?.path

    if(!avatarLocalPath){
        throw new apiError(400, "Avatar file is missing")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new apiError(400,"Error while uploading on avatar")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            avatar: avatar.url
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200, user, "Avatar updated successfully")
    )
})

//update user coverImage

const updateUserCoverImage= asyncHandller(async(req,res)=>{
    const coverImageLocalPath= req.file?.path

    if(!coverImageLocalPath){
        throw new apiError(400, "Cover Image file is missing")
    }

    const coverImage= await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new apiError(400,"Error while uploading on cover Image")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            coverImage: coverImage.url
        },
        {new:true}
    ).select("-password")


    return res
    .status(200)
    .json(
        new apiResponse(200, user, "Cover Image updated successfully")
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage

}