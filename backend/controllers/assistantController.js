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
  const key=process.env.GEMINI_API_KEY?.trim();
  if(!key)return res.status(503).json({message:"Ajoutez GEMINI_API_KEY aux variables d’environnement du serveur pour activer la recherche IA."});
  const p=await getOrCreate(req.user.userId);
  if(!p.topics.length)return res.status(400).json({message:"Ajoutez au moins un centre d’intérêt avant de lancer la recherche."});
  const sources=p.preferredSources.length?`Privilégie ces domaines : ${p.preferredSources.join(", ")}.`:"Utilise des sources d’information fiables et variées.";
  const prompt=[`Crée 3 propositions de publications originales, en ${p.language}.`,`Centres d’intérêt : ${p.topics.join(", ")}.`,`Ton : ${p.tone}. ${sources}`,
   "Utilise des informations récentes recherchées sur le web. N’invente rien et reformule sans copier. Chaque texte doit être concis, autonome et naturel.",
   'Réponds uniquement par un tableau JSON valide [{"title":"Titre court","content":"Texte de publication"}]. Les sources seront affichées séparément.'].join("\n");
  const model=(process.env.GEMINI_MODEL||"gemini-3.8-flash").trim().replace(/^models\//,"");
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"x-goog-api-key":key,"Content-Type":"application/json"},
   body:JSON.stringify({contents:[{role:"user",parts:[{text:`${prompt}\n\nRéponds strictement avec un tableau JSON valide, sans bloc Markdown.`}]}],
    systemInstruction:{parts:[{text:"Crée des brouillons originaux basés sur des informations récentes. N'invente aucune source. Respecte strictement le format JSON demandé."}]},
    tools:[{google_search:{}}],generationConfig:{temperature:0.5}}),
   signal:AbortSignal.timeout(60000)});
  if(!r.ok){
   const googleError=await r.json().catch(()=>({}));
   const detail=String(googleError.error?.message||"").slice(0,240);
   console.error("Gemini assistant API error",r.status,googleError.error?.status,detail);
   const message=r.status===401||r.status===403
    ? "Google refuse la clé : vérifiez dans Render GEMINI_API_KEY, les restrictions de la clé et l’activation de la Gemini API."
    : r.status===404
     ? "Le modèle Gemini est introuvable ou indisponible pour cette clé. Dans Render, définissez GEMINI_MODEL à gemini-3.8-flash, sans préfixe models/ ni espaces."
     : r.status===429
      ? "Le quota Gemini est atteint ou la facturation Google n’est pas activée. Vérifiez les limites du projet Google AI Studio."
      : r.status===400
       ? "Gemini a rejeté la requête. Le message technique a été enregistré côté serveur; vérifiez les journaux Render."
       : "Le service Gemini est temporairement indisponible. Réessayez plus tard.";
   return res.status(502).json({message});
  }
  const data=await r.json();
  const candidate=data.candidates?.[0];
  const answer=candidate?.content?.parts?.map((part)=>part.text||"").join("\n");
  if(typeof answer!=="string")throw Error("Réponse Gemini vide");
  const generated=parse(answer);if(!generated.length)throw Error("Aucun brouillon reçu");
  const chunks=candidate?.groundingMetadata?.groundingChunks||[];
  const refs=[...new Map(chunks.map(({web})=>web&&web.uri? [web.uri,{url:web.uri,title:(web.title||web.uri).slice(0,300),snippet:"",date:""}] : null).filter(Boolean)).values()].slice(0,12);
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
