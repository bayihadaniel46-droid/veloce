const mongoose=require("mongoose");
const source=new mongoose.Schema({title:{type:String,default:""},url:{type:String,required:true},snippet:{type:String,default:""},date:{type:String,default:""}},{_id:false});
const schema=new mongoose.Schema({
 owner:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
 title:{type:String,required:true,trim:true,maxlength:160},content:{type:String,required:true,trim:true,maxlength:3000},
 sources:{type:[source],default:[]},status:{type:String,enum:["pending","published","dismissed"],default:"pending",index:true},
 publishedPost:{type:mongoose.Schema.Types.ObjectId,ref:"Post",default:null}
},{timestamps:true});
schema.index({owner:1,status:1,createdAt:-1});
module.exports=mongoose.model("AssistantDraft",schema);
