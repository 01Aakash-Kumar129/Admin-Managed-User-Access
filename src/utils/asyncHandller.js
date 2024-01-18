const asyncHandller=(requestHandller)=>{
    return (req,res,next)=>{
        Promise
        .resolve(requestHandller(req,res,next))
        .catch((error)=>next(error))
    }
}


export {asyncHandller}


/*
const asyncHandller=(fun)=>async()=>{}

const asyncHandller=(fun)=>async( req,res,next)=>{
    try{
        await fun(req,res,next)
    } catch(error){
        res.status(error.code || 500).json({
            sucess: false,
            message: error.message
        })
    }

}
*/
