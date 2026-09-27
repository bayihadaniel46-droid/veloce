const AssistantProfile=require("../models/AssistantProfile");
const AssistantDraft=require("../models/AssistantDraft");
const Post=require("../models/Post");
const User=require("../models/User");

const getOrCreate=(owner)=>AssistantProfile.findOneAndUpdate({owner},{$setOnInsert:{owner}},{new:true,upsert:true,setDefaultsOnInsert:true});
const getProfile=async(req,res)=>{
 try{return res.json({profile:await getOrCreate(req.user.userId)});}
 catch(e){console.error(e);return res.status(500).json({message:"Impossible de charger l’espace IA."});}
};
const updateProfile=async(req,res)=>{
 try{
  const clean=(v,n,l)=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==="string").map(x=>x.trim().slice(0,l)).filter(Boolean))].slice(0,n):undefined;
  const u={}; const topics=clean(req.body.topics,12,80); const preferredSources=clean(req.body.preferredSources,10,120);
  if(topics!==undefined)u.topics=topics;if(preferredSources!==undefined)u.preferredSources=preferredSources;
  if(typeof req.body.language==="string")u.language=req.body.language.trim().slice(0,12)||"fr";
  if(typeof req.body.tone==="string")u.tone=req.body.tone.trim().slice(0,80)||"accessible et informatif";
  const profile=await AssistantProfile.findOneAndUpdate({owner:req.user.userId},{$set:u,$setOnInsert:{owner:req.user.userId}},{new:true,upsert:true,runValidators:true,setDefaultsOnInsert:true});
  return res.json({message:"Préférences enregistrées.",profile});
 }catch(e){console.error(e);return res.status(500).json({message:"Impossible d’enregistrer les préférences."});}
};
const parse=(s)=>{
 const clean=s.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
 const a=clean.indexOf("[");const b=clean.lastIndexOf("]");
 if(a<0||b<a)throw Error("Format IA invalide");
 return JSON.parse(clean.slice(a,b+1)).filter(x=>x&&typeof x.title==="string"&&typeof x.content==="string").slice(0,5)
  .map(x=>({title:x.title.trim().slice(0,160),content:x.content.trim().slice(0,3000)})).filter(x=>x.title&&x.content);
};
const generate=async(req,res)=>{
 try{
  const key=process.env.PERPLEXITY_API_KEY;
  if(!key)return res.status(503).json({message:"Ajoutez PERPLEXITY_API_KEY au fichier .env du serveur pour activer la recherche IA."});
  const p=await getOrCreate(req.user.userId);
  if(!p.topics.length)return res.status(400).json({message:"Ajoutez au moins un centre d’intérêt avant de lancer la recherche."});
  const sources=p.preferredSources.length?`Privilégie ces domaines : ${p.preferredSources.join(", ")}.`:"Utilise des sources d’information fiables et variées.";
  const prompt=[`Crée 3 propositions de publications originales, en ${p.language}.`,`Centres d’intérêt : ${p.topics.join(", ")}.`,`Ton : ${p.tone}. ${sources}`,
   "Utilise des informations récentes recherchées sur le web. N’invente rien et reformule sans copier. Chaque texte doit être concis, autonome et naturel.",
   'Réponds uniquement par un tableau JSON valide [{"title":"Titre court","content":"Texte de publication"}]. Les sources seront affichées séparément.'].join("\n");
  const r=await fetch("https://api.perplexity.ai/v1/sonar",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
   body:JSON.stringify({model:process.env.PERPLEXITY_MODEL||"sonar-pro",messages:[
    {role:"system",content:"Crée des brouillons originaux fondés sur une recherche web. Respecte strictement le format JSON."},{role:"user",content:prompt}]}),
   signal:AbortSignal.timeout(60000)});
  if(!r.ok){console.error("Perplexity API error",r.status,(await r.text()).slice(0,400));return res.status(502).json({message:"La recherche Perplexity a échoué. Vérifiez la clé API et réessayez."});}
  const data=await r.json();const answer=data.choices?.[0]?.message?.content;
  if(typeof answer!=="string")throw Error("Réponse Perplexity vide");
  const generated=parse(answer);if(!generated.length)throw Error("Aucun brouillon reçu");
  const results=Array.isArray(data.search_results)?data.search_results:[];const byUrl=new Map(results.map(x=>[x.url,x]));
  const urls=[...new Set([...results.map(x=>x.url),...(Array.isArray(data.citations)?data.citations:[])])].filter(x=>typeof x==="string").slice(0,12);
  const refs=urls.map(url=>{const x=byUrl.get(url)||{};return{url,title:typeof x.title==="string"?x.title.slice(0,300):url,snippet:typeof x.snippet==="string"?x.snippet.slice(0,800):"",date:typeof x.date==="string"?x.date:""};});
  const drafts=await AssistantDraft.insertMany(generated.map(x=>({owner:req.user.userId,...x,sources:refs})));
  return res.status(201).json({message:"Nouveaux brouillons prêts à consulter.",drafts});
 }catch(e){console.error("Génération assistant",e);return res.status(502).json({message:e.name==="TimeoutError"?"La recherche a pris trop de temps. Réessayez.":"Impossible de générer des brouillons. Réessayez."});}
};
const getDrafts=async(req,res)=>{
 try{return res.json({drafts:await AssistantDraft.find({owner:req.user.userId,status:"pending"}).sort({createdAt:-1})});}
 catch(e){console.error(e);return res.status(500).json({message:"Impossible de charger les brouillons."});}
};
const publish=async(req,res)=>{
 try{
  const d=await AssistantDraft.findOne({_id:req.params.id,owner:req.user.userId,status:"pending"});
  if(!d)return res.status(404).json({message:"Brouillon introuvable ou déjà traité."});
  const u=await User.findById(req.user.userId).select("username");if(!u)return res.status(404).json({message:"Utilisateur introuvable."});
  const post=await Post.create({author:u._id,username:u.username,content:d.content,verification:{status:"unverified",
   summary:"Brouillon préparé par l’assistant IA. Consultez les sources avant partage.",sources:d.sources.map(({title,url,snippet})=>({title,url,snippet})),checkedAt:new Date()}});
  d.status="published";d.publishedPost=post._id;await d.save();await post.populate("author","username avatar");
  return res.status(201).json({message:"Publication publiée sur votre profil.",post});
 }catch(e){console.error(e);return res.status(500).json({message:"Impossible de publier ce brouillon."});}
};
const dismiss=async(req,res)=>{
 try{const d=await AssistantDraft.findOneAndUpdate({_id:req.params.id,owner:req.user.userId,status:"pending"},{$set:{status:"dismissed"}},{new:true});
  if(!d)return res.status(404).json({message:"Brouillon introuvable ou déjà traité."});return res.json({message:"Brouillon écarté."});
 }catch(e){console.error(e);return res.status(500).json({message:"Impossible d’écarter ce brouillon."});}
};
module.exports={getProfile,updateProfile,generate,getDrafts,publish,dismiss};
