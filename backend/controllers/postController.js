const mongoose = require("mongoose");

const Post = require("../models/Post");
const Like = require("../models/Like");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Comment = require("../models/comment");
const Follow = require("../models/Follow");


// ============================================
// GRIDFS
// ============================================

const getBucket = () => {
  const db = mongoose.connection.db;

  return new mongoose.mongo.GridFSBucket(
    db,
    {
      bucketName: "veloceFiles"
    }
  );
};


// ============================================
// RÉCUPÉRER LES PUBLICATIONS
// ============================================

const getPosts = async (req, res) => {
  try {

    const currentUserId = req.user.userId;
    const follows = await Follow.find({
      follower: currentUserId
    }).select("following");
    const visibleAuthors = [
      currentUserId,
      ...follows.map((follow) => follow.following)
    ];

    const posts = await Post
      .find({
        author: { $in: visibleAuthors }
      })
      .sort({
        createdAt: -1
      })
      .populate(
        "author",
        "username avatar"
      );

    const likedPosts = await Like.find({
      userId: currentUserId,
      postId: { $in: posts.map((post) => post._id) }
    }).select("postId");
    const likedPostIds = new Set(
      likedPosts.map((like) => like.postId.toString())
    );

    res.json(posts.map((post) => ({
      ...post.toObject(),
      likedByCurrentUser: likedPostIds.has(post._id.toString())
    })));

  } catch (error) {

    console.error(
      "Erreur GET posts :",
      error
    );

    res.status(500).json({
      message:
        "Erreur lors du chargement des publications."
    });
  }
};


// ============================================
// CRÉER UNE PUBLICATION
// ============================================

const createPost = async (req, res) => {
  try {

    const content =
      typeof req.body.content === "string"
        ? req.body.content.trim()
        : "";

    const files =
      Array.isArray(req.files)
        ? req.files
        : [];

    if (
      !content &&
      files.length === 0
    ) {
      return res.status(400).json({
        message:
          "Ajoute du texte, une photo ou un fichier."
      });
    }

    const user = await User
      .findById(req.user.userId)
      .select("-password");

    if (!user) {
      return res.status(404).json({
        message:
          "Utilisateur introuvable."
      });
    }

    const attachments = [];

    const bucket = getBucket();

    for (const file of files) {

      const uploadStream =
        bucket.openUploadStream(
          file.originalname,
          {
            contentType:
              file.mimetype,

            metadata: {
              uploadedBy:
                user._id.toString()
            }
          }
        );

      await new Promise(
        (resolve, reject) => {

          uploadStream.on(
            "finish",
            resolve
          );

          uploadStream.on(
            "error",
            reject
          );

          uploadStream.end(
            file.buffer
          );
        }
      );

      attachments.push({
        fileId:
          uploadStream.id,

        originalName:
          file.originalname,

        filename:
          file.originalname,

        mimetype:
          file.mimetype,

        size:
          file.size,

        url:
          `/api/posts/files/${uploadStream.id}`
      });
    }

    const post = await Post.create({
      author:
        user._id,

      username:
        user.username,

      content,

      attachments
    });

    const populatedPost =
      await Post
        .findById(post._id)
        .populate(
          "author",
          "username avatar"
        );

    res.status(201).json(
      populatedPost
    );

  } catch (error) {

    console.error(
      "Erreur création post :",
      error
    );

    res.status(500).json({
      message:
        "Erreur lors de la création du post."
    });
  }
};


// ============================================
// SERVIR UN FICHIER
// ============================================

const getFile = async (req, res) => {
  try {

    const fileId =
      new mongoose.Types.ObjectId(
        req.params.id
      );

    const bucket = getBucket();

    const files =
      await bucket
        .find({
          _id: fileId
        })
        .toArray();

    if (
      !files ||
      files.length === 0
    ) {
      return res.status(404).json({
        message:
          "Fichier introuvable."
      });
    }

    const file = files[0];

    res.set(
      "Content-Type",
      file.contentType ||
      "application/octet-stream"
    );

    res.set(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(
        file.filename
      )}"`
    );

    const downloadStream =
      bucket.openDownloadStream(
        fileId
      );

    downloadStream.on(
      "error",
      (error) => {

        console.error(
          "Erreur lecture fichier :",
          error
        );

        if (!res.headersSent) {
          res.status(500).end();
        }
      }
    );

    downloadStream.pipe(res);

  } catch (error) {

    console.error(
      "Erreur fichier :",
      error
    );

    res.status(400).json({
      message:
        "Identifiant de fichier invalide."
    });
  }
};


// ============================================
// LIKE / UNLIKE
// ============================================

const likePost = async (req, res) => {
  try {

    const postId =
      req.params.id;

    const userId =
      req.user.userId;

    const post =
      await Post.findById(
        postId
      );

    if (!post) {
      return res.status(404).json({
        message:
          "Publication introuvable."
      });
    }

    const user =
      await User.findById(
        userId
      );

    if (!user) {
      return res.status(404).json({
        message:
          "Utilisateur introuvable."
      });
    }

    const existingLike =
      await Like.findOne({
        userId,
        postId
      });

    if (existingLike) {

      await Like.deleteOne({
        _id:
          existingLike._id
      });

      post.likes =
        Math.max(
          0,
          post.likes - 1
        );

      await post.save();

      return res.json({
        post,
        liked: false
      });
    }

    try {

      await Like.create({
        userId,
        postId
      });

    } catch (likeError) {

      if (
        likeError.code === 11000
      ) {

        const currentLike =
          await Like.findOne({
            userId,
            postId
          });

        return res.json({
          post,
          liked:
            Boolean(currentLike)
        });
      }

      throw likeError;
    }

    post.likes += 1;

    await post.save();

    let authorId = null;

    if (post.author) {
      authorId =
        post.author.toString();
    }

    if (!authorId) {

      const postOwner =
        await User.findOne({
          username:
            post.username
        });

      if (postOwner) {
        authorId =
          postOwner._id.toString();
      }
    }

    if (
      authorId &&
      authorId !== userId.toString()
    ) {

      await Notification.create({
        recipient:
          authorId,

        sender:
          userId,

        type:
          "like",

        post:
          post._id,

        message:
          `${user.username} a aimé ta publication.`
      });
    }

    return res.json({
      post,
      liked: true
    });

  } catch (error) {

    console.error(
      "Erreur like :",
      error
    );

    res.status(500).json({
      message:
        "Erreur lors du like.",

      error:
        error.message
    });
  }
};


// ============================================
// EXPLORER
// ============================================

const explorePosts = async (req, res) => {
  try {

    const query =
      (req.query.q || "").trim();

    if (!query) {

      const posts =
        await Post
          .find()
          .sort({
            createdAt: -1
          })
          .limit(20)
          .populate(
            "author",
            "username avatar"
          );

      return res.json(posts);
    }

    const escapedQuery =
      query.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const regex =
      new RegExp(
        escapedQuery,
        "i"
      );

    const posts =
      await Post
        .find({
          $or: [
            {
              content:
                regex
            },

            {
              username:
                regex
            }
          ]
        })
        .sort({
          createdAt: -1
        })
        .limit(30)
        .populate(
          "author",
          "username avatar"
        );

    res.json(posts);

  } catch (error) {

    console.error(
      "Erreur Explorer :",
      error
    );

    res.status(500).json({
      message:
        "Erreur lors de la recherche."
    });
  }
};


// ============================================
// TENDANCES
// ============================================

const getTrends = async (req, res) => {
  try {

    const posts =
      await Post
        .find({
          content: {
            $regex:
              /#[\p{L}\p{N}_]+/u
          }
        })
        .select("content")
        .limit(1000)
        .lean();

    const trendCounts = {};

    for (const post of posts) {

      const hashtags =
        post.content.match(
          /#[\p{L}\p{N}_]+/gu
        ) || [];

      for (
        const hashtag
        of hashtags
      ) {

        const tag =
          hashtag.toLowerCase();

        trendCounts[tag] =
          (
            trendCounts[tag] ||
            0
          ) + 1;
      }
    }

    const trends =
      Object.entries(
        trendCounts
      )
        .map(
          ([tag, count]) => ({
            tag,
            count
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        )
        .slice(0, 10);

    res.json(trends);

  } catch (error) {

    console.error(
      "Erreur tendances :",
      error
    );

    res.status(500).json({
      message:
        "Erreur lors du chargement des tendances."
    });
  }
};


// ============================================
// RÉCUPÉRER LES COMMENTAIRES
// ============================================

const getComments = async (req, res) => {
  try {

    const postId =
      req.params.id;

    const comments =
      await Comment
        .find({
          postId
        })
        .sort({
          createdAt: -1
        })
        .populate(
          "userId",
          "username avatar"
        );

    res.json(comments);

  } catch (error) {

    console.error(
      "Erreur récupération commentaires :",
      error
    );

    res.status(500).json({
      message:
        "Erreur lors du chargement des commentaires."
    });
  }
};


// ============================================
// CRÉER UN COMMENTAIRE
// ============================================

const createComment = async (req, res) => {
  try {

    const postId =
      req.params.id;

    const {
      content
    } = req.body;

    if (
      !content ||
      !content.trim()
    ) {
      return res.status(400).json({
        message:
          "Le commentaire ne peut pas être vide."
      });
    }

    const post =
      await Post.findById(
        postId
      );

    if (!post) {
      return res.status(404).json({
        message:
          "Publication introuvable."
      });
    }

    const user =
      await User.findById(
        req.user.userId
      );

    if (!user) {
      return res.status(404).json({
        message:
          "Utilisateur introuvable."
      });
    }

    const comment =
      await Comment.create({
        userId:
          user._id,

        postId,

        content:
          content.trim()
      });

    post.comments += 1;

    await post.save();

    const populatedComment =
      await Comment
        .findById(
          comment._id
        )
        .populate(
          "userId",
          "username avatar"
        );

    res.status(201).json({
      comment:
        populatedComment,

      commentsCount:
        post.comments
    });

  } catch (error) {

    console.error(
      "Erreur création commentaire :",
      error
    );

    res.status(500).json({
      message:
        "Erreur lors de la création du commentaire."
    });
  }
};

// ============================================
// FACT-CHECKING V4
// TAVILY + GEMINI
// ============================================

const verifyPost = async (req, res) => {
  try {

    // ----------------------------------------
    // RÉCUPÉRER LE POST
    // ----------------------------------------

    const postId = req.params.id;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        message: "Publication introuvable."
      });
    }


    // ----------------------------------------
    // VÉRIFIER LE TEXTE
    // ----------------------------------------

    if (!post.content || !post.content.trim()) {
      return res.status(400).json({
        message:
          "Cette publication ne contient pas suffisamment de texte à vérifier."
      });
    }


    // ----------------------------------------
    // CACHE
    // ------------------------------------
    // ----------------------------------------
    // CLÉS API
    // ----------------------------------------

    const tavilyApiKey =
      process.env.TAVILY_API_KEY?.trim();

    const geminiApiKey =
      process.env.GEMINI_API_KEY?.trim();


    if (!tavilyApiKey) {

      return res.status(500).json({
        message:
          "La clé TAVILY_API_KEY n’est pas configurée dans les variables d’environnement du serveur Render."
      });
    }


    if (!geminiApiKey) {

      return res.status(500).json({
        message:
          "La clé API Gemini est absente du serveur."
      });
    }


    // ----------------------------------------
    // AFFIRMATION
    // ----------------------------------------

    const claim =
      post.content
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 1500);


    console.log(
      "🔎 Vérification de :",
      claim
    );


    // ========================================
    // ÉTAPE 1 — TAVILY
    // ========================================

    const queries = [

      claim,

      `"${claim}" fact check`,

      `"${claim}" latest information official`,

      `${claim} news reliable sources`

    ];


    let allResults = [];

    let tavilyAnswers = [];


    // ----------------------------------------
    // LANCER LES RECHERCHES
    // ----------------------------------------

    for (
      const query
      of queries
    ) {

      try {

        const response =
          await fetch(
            "https://api.tavily.com/search",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({

                  api_key:
                    tavilyApiKey,

                  query,

                  search_depth:
                    "advanced",

                  max_results:
                    6,

                  include_answer:
                    true,

                  include_raw_content:
                    false,

                  topic:
                    "general"
                })
            }
          );


        if (!response.ok) {

          const errorText =
            await response.text();

          console.error(
            "Erreur Tavily :",
            errorText
          );

          continue;
        }


        const data =
          await response.json();


        if (
          data.answer &&
          typeof data.answer === "string"
        ) {

          tavilyAnswers.push(
            data.answer
          );
        }


        if (
          Array.isArray(
            data.results
          )
        ) {

          allResults.push(
            ...data.results
          );
        }


      } catch (error) {

        console.error(
          "Erreur recherche Tavily :",
          error
        );
      }
    }


    // ========================================
    // SUPPRIMER LES DOUBLONS
    // ========================================

    const uniqueResults = [];

    const seenUrls = new Set();


    for (
      const result
      of allResults
    ) {

      if (
        !result ||
        !result.url
      ) {
        continue;
      }


      if (
        seenUrls.has(
          result.url
        )
      ) {
        continue;
      }


      seenUrls.add(
        result.url
      );


      uniqueResults.push(
        result
      );
    }


    const results =
      uniqueResults.slice(
        0,
        12
      );


    // ========================================
    // AUCUNE SOURCE
    // ========================================

    if (
      results.length === 0
    ) {

      post.verification = {

        status:
          "unverified",

        confidence:
          0,

        summary:
          "Aucune source fiable n'a été trouvée pour vérifier cette information.",

        reasoning:
          "La recherche Internet n'a pas fourni suffisamment de sources pertinentes.",

        sources: [],

        checkedAt:
          new Date()
      };


      await post.save();


      return res.json({

        cached: false,

        verification:
          post.verification

      });
    }


    // ========================================
    // PRÉPARER LES SOURCES POUR GEMINI
    // ========================================

    const sourceText =
      results
        .slice(0, 10)
        .map(
          (result, index) => {

            return `
SOURCE ${index + 1}

Titre :
${result.title || "Sans titre"}

URL :
${result.url || "URL inconnue"}

Contenu :
${result.content || "Aucun contenu disponible"}

----------------------------------------
`;
          }
        )
        .join("\n");


    // ========================================
    // RÉPONSES DE TAVILY
    // ========================================

    const tavilyContext =
      tavilyAnswers
        .slice(0, 4)
        .join("\n\n");


    // ========================================
    // ÉTAPE 2 — GEMINI
    // ========================================

    const geminiPrompt = `

Tu es le moteur de fact-checking de Veloce.

Ta mission est de vérifier une affirmation publiée par un utilisateur.

IMPORTANT :

Tu ne dois PAS décider qu'une affirmation est vraie simplement
parce qu'une source contient les mots "vrai", "confirmé",
"official", "according to", etc.

Tu dois comprendre le SENS de l'affirmation.

Tu dois comparer précisément :

1. l'affirmation de l'utilisateur
2. les informations présentes dans les sources
3. la date et la fraîcheur des informations
4. la fiabilité des sources
5. les éventuelles contradictions entre les sources.

Une source peut parler du même sujet sans confirmer l'affirmation.

Une source qui affirme le contraire doit être considérée comme
une contradiction.

Exemple :

AFFIRMATION :
"Paul Biya n'est plus président du Cameroun."

SOURCE :
"Paul Biya is still the President of Cameroon."

Résultat attendu :
FALSE

Autre exemple :

AFFIRMATION :
"Paul Biya est président du Cameroun."

SOURCE :
"Paul Biya is still the President of Cameroon."

Résultat attendu :
TRUE

Autre exemple :

AFFIRMATION :
"Une nouvelle loi vient d'être adoptée au Cameroun."

Sources anciennes ou insuffisantes :
UNVERIFIED

----------------------------------------

AFFIRMATION À VÉRIFIER :

${claim}

----------------------------------------

RÉPONSES FOURNIES PAR TAVILY :

${tavilyContext}

----------------------------------------

SOURCES :

${sourceText}

----------------------------------------

RÈGLES DU VERDICT :

TRUE :
Les sources fournissent des éléments suffisamment solides
qui soutiennent réellement l'affirmation.

FALSE :
Les sources fiables fournissent des éléments qui contredisent
réellement l'affirmation.

UNVERIFIED :
Les sources sont insuffisantes, ambiguës, trop anciennes,
hors sujet ou contradictoires sans permettre de déterminer
un verdict suffisamment fiable.

Ne transforme jamais une information insuffisante en TRUE.

Ne transforme jamais une absence de preuve en FALSE.

Pour les informations temporelles, privilégie les sources
les plus récentes.

Pour une personne occupant actuellement une fonction,
vérifie particulièrement les informations récentes.

Donne une confiance entre 0 et 100.

La confiance doit représenter la solidité des preuves,
pas simplement la quantité de sources.

----------------------------------------

RÉPONSE JSON UNIQUEMENT :

{
  "status": "true",
  "confidence": 95,
  "summary": "Résumé court en français.",
  "reasoning": "Explication claire de la comparaison entre l'affirmation et les sources."
}

Le champ status doit être exactement :

true

false

ou

unverified

Ne mets aucun Markdown autour du JSON.
`;


    // ========================================
    // APPEL GEMINI
    // ========================================

    const geminiResponse =
      await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "x-goog-api-key":
              geminiApiKey

          },

          body:
            JSON.stringify({

              contents: [
                {
                  parts: [
                    {
                      text:
                        geminiPrompt
                    }
                  ]
                }
              ],

              generationConfig: {

                responseMimeType:
                  "application/json"

              }

            })
        }
      );


    // ========================================
    // ERREUR GEMINI
    // ========================================

    if (
      !geminiResponse.ok
    ) {

      const errorText =
        await geminiResponse.text();

      console.error(
        "Erreur Gemini :",
        errorText
      );

      return res.status(502).json({

        message:
          "La recherche a fonctionné, mais l'analyse IA Gemini a échoué."

      });
    }


    // ========================================
    // RÉPONSE GEMINI
    // ========================================

    const geminiData =
      await geminiResponse.json();


    const generatedText =
      geminiData
        ?.candidates?.[0]
        ?.content?.parts?.[0]
        ?.text;


    if (
      !generatedText
    ) {

      console.error(
        "Réponse Gemini vide :",
        geminiData
      );

      return res.status(502).json({

        message:
          "Gemini n'a pas retourné de résultat exploitable."

      });
    }


    // ========================================
    // PARSER LE JSON
    // ========================================

    let analysis;


    try {

      analysis =
        JSON.parse(
          generatedText
        );

    } catch (error) {

      console.error(
        "JSON Gemini invalide :",
        generatedText
      );

      /*
       * Petite tentative de récupération
       * si Gemini a ajouté accidentellement
       * du texte autour du JSON.
       */

      const jsonMatch =
        generatedText.match(
          /\{[\s\S]*\}/
        );


      if (!jsonMatch) {

        return res.status(502).json({

          message:
            "La réponse de Gemini n'a pas pu être interprétée."

        });
      }


      try {

        analysis =
          JSON.parse(
            jsonMatch[0]
          );

      } catch (secondError) {

        return res.status(502).json({

          message:
            "Impossible d'interpréter la réponse du moteur de vérification."

        });
      }
    }


    // ========================================
    // NORMALISER LE VERDICT
    // ========================================

    let status =
      String(
        analysis.status || ""
      )
        .toLowerCase()
        .trim();


    if (
      ![
        "true",
        "false",
        "unverified"
      ].includes(status)
    ) {

      status =
        "unverified";
    }


    // ========================================
    // CONFIANCE
    // ========================================

    let confidence =
      Number(
        analysis.confidence
      );


    if (
      Number.isNaN(
        confidence
      )
    ) {

      confidence = 0;
    }


    confidence =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(
            confidence
          )
        )
      );


    // ========================================
    // RÉSUMÉ
    // ========================================

    let summary =
      typeof analysis.summary === "string"
        ? analysis.summary.trim()
        : "";


    let reasoning =
      typeof analysis.reasoning === "string"
        ? analysis.reasoning.trim()
        : "";


    if (!summary) {

      if (
        status === "true"
      ) {

        summary =
          "Les sources disponibles soutiennent cette information.";

      } else if (
        status === "false"
      ) {

        summary =
          "Les sources disponibles contredisent cette information.";

      } else {

        summary =
          "Les sources disponibles ne permettent pas d'établir un verdict suffisamment fiable.";
      }
    }


    if (!reasoning) {

      reasoning =
        summary;
    }


    // ========================================
    // SOURCES POUR MONGODB
    // ========================================

    const sources =
      results
        .slice(0, 8)
        .map(
          (result) => ({

            title:
              result.title ||
              "Source",

            url:
              result.url ||
              "",

            snippet:
              result.content ||
              ""

          })
        )
        .filter(
          (source) =>
            source.url
        );


    // ========================================
    // SAUVEGARDE
    // ========================================

    post.verification = {

      status,

      confidence,

      summary,

      reasoning,

      sources,

      checkedAt:
        new Date()

    };


    await post.save();


    // ========================================
    // LOG SERVEUR
    // ========================================

    console.log(
      "✅ Fact-check terminé :",
      {
        claim,
        status,
        confidence
      }
    );


    // ========================================
    // RÉPONSE
    // ========================================

    return res.json({

      cached: false,

      verification:
        post.verification

    });


  } catch (error) {

    console.error(
      "Erreur fact-checking V4 :",
      error
    );


    return res.status(500).json({

      message:
        "Une erreur est survenue pendant la vérification."

    });

  }
};

// ============================================
// PUBLICATIONS D'UN UTILISATEUR
// ============================================

const getUserPosts = async (req, res) => {
  try {

    const userId =
      req.params.userId;

    const user =
      await User.findById(
        userId
      ).select(
        "username avatar bio"
      );

    if (!user) {
      return res.status(404).json({
        message:
          "Utilisateur introuvable."
      });
    }

    const posts =
      await Post
        .find({
          author: userId
        })
        .sort({
          createdAt: -1
        })
        .populate(
          "author",
          "username avatar"
        );

    return res.json({
      user,
      posts,
      postsCount: posts.length
    });

  } catch (error) {

    console.error(
      "Erreur publications utilisateur :",
      error
    );

    return res.status(500).json({
      message:
        "Erreur lors du chargement du profil."
    });
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  getPosts,
  createPost,
  getFile,
  likePost,
  explorePosts,
  getTrends,
  getComments,
  createComment,
  verifyPost,
  getUserPosts
};
