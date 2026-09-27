const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 owner:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,unique:true,index:true},
 topics:{type:[String],default:[]},preferredSources:{type:[String],default:[]},
 language:{type:String,default:"fr"},tone:{type:String,default:"accessible et informatif"}
},{timestamps:true});
module.exports=mongoose.model("AssistantProfile",schema);
