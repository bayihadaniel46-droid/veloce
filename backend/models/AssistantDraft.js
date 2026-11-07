const mongoose=require("mongoose");
const source=new mongoose.Schema({title:{type:String,default:""},url:{type:String,required:true},snippet:{type:String,default:""},date:{type:String,default:""},clanId:{type:mongoose.Schema.Types.ObjectId,ref:"Clan",default:null},documentId:{type:mongoose.Schema.Types.ObjectId,ref:"ClanKnowledgeDocument",default:null},assistantKnowledgeId:{type:mongoose.Schema.Types.ObjectId,ref:"ClanAssistantKnowledge",default:null}},{_id:false});
const schema=new mongoose.Schema({
 owner:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
 research:{type:mongoose.Schema.Types.ObjectId,ref:"AssistantResearch",default:undefined},researchIndex:{type:Number,default:undefined},
 title:{type:String,required:true,trim:true,maxlength:160},content:{type:String,required:true,trim:true,maxlength:3000},
 sources:{type:[source],default:[]},status:{type:String,enum:["pending","published","dismissed"],default:"pending",index:true},
 publishedPost:{type:mongoose.Schema.Types.ObjectId,ref:"Post",default:null}
},{timestamps:true});
schema.index({owner:1,status:1,createdAt:-1});
schema.index({research:1,researchIndex:1},{unique:true,partialFilterExpression:{research:{$type:"objectId"}}});
module.exports=mongoose.model("AssistantDraft",schema);
