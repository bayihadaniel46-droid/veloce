import { useState } from "react";

import {
  getComments,
  createComment,
  verifyPost
} from "../services/postService";

import { useAuth } from "../context/authContext";
import { API_ORIGIN } from "../config";


function PostCard({
  post,
  onLike
}) {

  const [verification, setVerification] =
    useState(
      post.verification || null
    );

  const [verifying, setVerifying] =
    useState(false);

  const [verificationError, setVerificationError] =
    useState("");

  const {
    token,
    user
  } = useAuth();


  const [showComments, setShowComments] =
    useState(false);

  const [comments, setComments] =
    useState([]);

  const [commentText, setCommentText] =
    useState("");

  const [loadingComments, setLoadingComments] =
    useState(false);

  const [sendingComment, setSendingComment] =
    useState(false);

  const [commentError, setCommentError] =
    useState("");

  const [postActionMessage, setPostActionMessage] = useState("");
  const [postActionBusy, setPostActionBusy] = useState(false);

  // ==========================================
  // TEMPS ÉCOULÉ
  // ==========================================

  const getTimeAgo = (date) => {

    if (!date) {
      return "";
    }

    const created =
      new Date(date);

    const now =
      new Date();

    const difference =
      Math.floor(
        (now - created) / 1000
      );


    if (difference < 60) {
      return "à l'instant";
    }


    const minutes =
      Math.floor(
        difference / 60
      );

    if (minutes < 60) {

      return `il y a ${minutes} min`;

    }


    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {

      return `il y a ${hours} h`;

    }


    const days =
      Math.floor(
        hours / 24
      );

    if (days < 7) {

      return `il y a ${days} j`;

    }


    const weeks =
      Math.floor(
        days / 7
      );

    if (weeks < 5) {

      return `il y a ${weeks} sem.`;

    }


    return created.toLocaleDateString(
      "fr-FR",
      {
        day: "numeric",
        month: "short",
        year:
          created.getFullYear() !==
          now.getFullYear()
            ? "numeric"
            : undefined
      }
    );
  };


  // ==========================================
  // VÉRIFIER L'AUTEUR
  // ==========================================

  const authorId =
    post.author?._id ||
    post.author;


  const currentUserId =
    user?.id ||
    user?._id;


  const isOwnPost =
    authorId &&
    currentUserId &&
    authorId.toString() ===
      currentUserId.toString();


  // ==========================================
  // COMMENTAIRES
  // ==========================================

  const handleComments = async () => {

    if (showComments) {

      setShowComments(false);

      return;
    }


    try {

      setLoadingComments(true);
      setCommentError("");


      const data =
        await getComments({
          postId: post._id
        });


      setComments(
        Array.isArray(data)
          ? data
          : []
      );


      setShowComments(true);

    } catch (error) {

      console.error(
        "Erreur commentaires :",
        error
      );


      setCommentError(
        error.message ||
        "Impossible de charger les commentaires."
      );

    } finally {

      setLoadingComments(false);

    }
  };


  // ==========================================
  // AJOUTER COMMENTAIRE
  // ==========================================

  const handleCreateComment =
    async () => {

      if (!commentText.trim()) {
        return;
      }


      if (!token || !user) {

        setCommentError(
          "Tu dois être connecté pour commenter."
        );

        return;
      }


      try {

        setSendingComment(true);
        setCommentError("");


        const data =
          await createComment({
            postId: post._id,
            content:
              commentText.trim(),
            token
          });


        setComments(
          (previousComments) => [
            data.comment,
            ...previousComments
          ]
        );


        setCommentText("");

      } catch (error) {

        console.error(
          "Erreur création commentaire :",
          error
        );


        setCommentError(
          error.message ||
          "Impossible d'ajouter le commentaire."
        );

      } finally {

        setSendingComment(false);

      }
    };


  // ==========================================
  // ENTRÉE COMMENTAIRE
  // ==========================================

  const handleCommentKeyDown =
    (event) => {

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {

        event.preventDefault();

        handleCreateComment();
      }
    };


  // ==========================================
  // LIKE
  // ==========================================

  const handleLike = () => {

    if (!onLike) {
      return;
    }

    onLike(post._id);
  };


  // ==========================================
  // FACT-CHECKING
  // ==========================================
  const handleVerifyPost = async () => {
    if (verifying) {
      return;
    }

    if (!token) {
      setVerificationError(
        "Tu dois être connecté pour vérifier une publication."
      );
      return;
    }

    try {
      setVerifying(true);
      setVerificationError("");

      setVerification({
        status: "checking",
        summary: "Vérification en cours..."
      });

      const data = await verifyPost({
        postId: post._id,
        token
      });

      setVerification(
        data.verification || null
      );

      // Le résultat reste affiché pendant 1 minute.
      setTimeout(() => {
        setVerification(null);
        setVerificationError("");
        setVerifying(false);
      }, 60000);

    } catch (error) {
      console.error(
        "Erreur vérification :",
        error
      );

      setVerification(null);

      setVerificationError(
        error.message ||
        "Impossible de vérifier cette publication."
      );

      // Après 1 minute, le bouton redevient normal.
      setTimeout(() => {
        setVerificationError("");
        setVerifying(false);
      }, 60000);
    }
  };

  const getVerificationClass = () => {

    if (verifying) {
      return "checking";
    }

    if (
      verification?.status === "true"
    ) {
      return "verified-true";
    }

    if (
      verification?.status === "false"
    ) {
      return "verified-false";
    }

    if (
      verification?.status === "unverified"
    ) {
      return "verified-unknown";
    }

    return "";
  };


  const getVerificationIcon = () => {

    if (verifying) {
      return "";
    }

    if (
      verification?.status === "true"
    ) {
      return "✓";
    }

    if (
      verification?.status === "false"
    ) {
      return "✕";
    }

    if (
      verification?.status === "unverified"
    ) {
      return "?";
    }

    return "";
  };

  // ==========================================
  // FICHIERS
  // ==========================================

  const attachments =
    Array.isArray(
      post.attachments
    )
      ? post.attachments
      : [];


  const imageAttachments =
    attachments.filter(
      (file) =>
        file.mimetype?.startsWith(
          "image/"
        )
    );


  const otherAttachments =
    attachments.filter(
      (file) =>
        !file.mimetype?.startsWith(
          "image/"
        )
    );


  // ==========================================
  // URL FICHIER
  // ==========================================

  const getFileUrl = (url) => {

    if (!url) {
      return "";
    }


    if (
      url.startsWith("http://") ||
      url.startsWith("https://")
    ) {
      return url;
    }


    return `${API_ORIGIN}${url}`;
  };

  const downloadPost = async () => {
    if (postActionBusy) return;
    setPostActionBusy(true);
    setPostActionMessage("");

    try {
      if (attachments.length === 0) {
        const content = [
          `Publication de @${post.username || "Veloce"}`,
          post.createdAt ? new Date(post.createdAt).toLocaleString("fr-FR") : "",
          "",
          post.content || ""
        ].filter(Boolean).join("\n");
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `veloce-publication-${post._id || "post"}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        setPostActionMessage("Publication téléchargée.");
        return;
      }

      for (const [index, file] of attachments.entries()) {
        const response = await fetch(getFileUrl(file.url));
        if (!response.ok) throw new Error("Un fichier n’a pas pu être téléchargé.");
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = file.originalName || `fichier-${index + 1}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }
      setPostActionMessage(`${attachments.length} fichier(s) téléchargé(s).`);
    } catch (error) {
      setPostActionMessage(error.message || "Le téléchargement a échoué.");
    } finally {
      setPostActionBusy(false);
    }
  };

  const sharePost = async () => {
    const shareText = `${post.username ? `Publication de @${post.username}` : "Publication Veloce"}${post.content ? `\n\n${post.content}` : ""}`;
    const shareData = { title: "Publication Veloce", text: shareText, url: window.location.href };
    setPostActionMessage("");

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n\n${window.location.href}`);
        setPostActionMessage("Lien et texte copiés dans le presse-papiers.");
      } else {
        const field = document.createElement("textarea");
        field.value = `${shareText}\n\n${window.location.href}`;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Copie impossible dans ce navigateur.");
        setPostActionMessage("Lien et texte copiés dans le presse-papiers.");
      }
    } catch (error) {
      if (error.name !== "AbortError") setPostActionMessage(error.message || "Le partage a échoué.");
    }
  };


  return (

    <article className="post-card">

      {/* ==================================== */}
      {/* EN-TÊTE */}
      {/* ==================================== */}

      <div className="post-header">

        <div className="avatar">

          {post.author?.avatar ? (

            <img
              src={
                post.author.avatar
              }
              alt={
                post.username
              }
            />

          ) : (

            post.username
              ?.charAt(0)
              .toUpperCase()

          )}

        </div>


        <div className="post-user">

          <div className="post-user-top">

            <span className="username">
              {post.username}
            </span>


            <span className="handle">
              @{post.username?.toLowerCase()}
            </span>


            <span className="time">
              • {getTimeAgo(
                post.createdAt
              )}
            </span>

          </div>

        </div>


        {/* ================================= */}
        {/* CERCLE POUR LES POSTS DES AUTRES */}
        {/* ================================= */}
        {!isOwnPost && (

          <button
            type="button"
            className={`post-more-circle ${getVerificationClass()}`}
            aria-label="Vérifier cette publication"
            title={
              verifying
                ? "Vérification en cours..."
                : verification?.status === "true"
                  ? "Information confirmée"
                  : verification?.status === "false"
                    ? "Information contredite"
                    : verification?.status === "unverified"
                      ? "Information non vérifiable"
                      : "Vérifier cette publication"
            }
            onClick={handleVerifyPost}
          >

            {verifying ? (
              <span className="verification-spinner" />
            ) : (
              getVerificationIcon()
            )}

          </button>

        )}

      </div>
      {/* ==================================== */}
      {/* RÉSULTAT FACT-CHECKING */}
      {/* ==================================== */}

      {(verification || verificationError) && (

        <div className="verification-result">

          {verification?.status === "true" && (
            <div className="verification-message verification-message-true">
              <strong>✓ Information confirmée</strong>
              <span>
                {verification.summary}
              </span>
            </div>
          )}

          {verification?.status === "false" && (
            <div className="verification-message verification-message-false">
              <strong>✕ Information contredite</strong>
              <span>
                {verification.summary}
              </span>
            </div>
          )}

          {verification?.status === "unverified" && (
            <div className="verification-message verification-message-unknown">
              <strong>? Information non vérifiable</strong>
              <span>
                {verification.summary}
              </span>
              {verification.sources?.length > 0 && (
                <ul className="verification-sources">
                  {verification.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.title || source.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {verificationError && (
            <div className="verification-message verification-message-error">
              {verificationError}
            </div>
          )}

        </div>

      )}

      {/* ==================================== */}
      {/* TEXTE */}
      {/* ==================================== */}

      {post.content && (

        <div className="post-content">
          {post.content}
        </div>

      )}


      {/* ==================================== */}
      {/* GALERIE PHOTOS */}
      {/* ==================================== */}

      {imageAttachments.length > 0 && (

        <div
          className={
            `post-images post-images-${Math.min(
              imageAttachments.length,
              4
            )}`
          }
        >

          {imageAttachments.map(
            (file) => (

              <div
                className="post-image-container"
                key={
                  file.fileId ||
                  file.url
                }
              >

                <img
                  src={getFileUrl(
                    file.url
                  )}
                  alt={
                    file.originalName ||
                    "Image"
                  }
                  className="post-image"
                  loading="lazy"
                />

              </div>

            )
          )}

        </div>

      )}


      {/* ==================================== */}
      {/* AUTRES FICHIERS */}
      {/* ==================================== */}

      {otherAttachments.length > 0 && (

        <div className="post-files">

          {otherAttachments.map(
            (file) => (

              <a
                key={
                  file.fileId ||
                  file.url
                }
                className="post-file"
                href={
                  getFileUrl(
                    file.url
                  )
                }
                target="_blank"
                rel="noreferrer"
              >

                <div className="post-file-icon">
                  📄
                </div>


                <div className="post-file-info">

                  <strong>
                    {file.originalName}
                  </strong>

                  <span>
                    {file.mimetype ||
                      "Fichier"}
                  </span>

                </div>


                <span className="post-file-arrow">
                  ↗
                </span>

              </a>

            )
          )}

        </div>

      )}


      {/* ==================================== */}
      {/* ACTIONS */}
      {/* ==================================== */}

      <div className="post-actions">

        <button
          type="button"
          onClick={handleLike}
          className={post.likedByCurrentUser ? "is-liked" : ""}
          aria-pressed={Boolean(post.likedByCurrentUser)}
        >
          ❤️ {post.likes || 0}
        </button>


        <button
          type="button"
          onClick={handleComments}
        >
          💬 {post.comments || 0}
        </button>


        <button
          type="button"
          onClick={downloadPost}
          disabled={postActionBusy}
          aria-label={attachments.length ? "Télécharger les fichiers de la publication" : "Télécharger le texte de la publication"}
          title={attachments.length ? "Télécharger les fichiers" : "Télécharger la publication en texte"}
        >
          {postActionBusy ? "…" : "⬇️"}
        </button>


        <button
          type="button"
          onClick={sharePost}
          aria-label="Partager cette publication"
          title="Partager la publication"
        >
          📤
        </button>

      </div>

      {postActionMessage && <p className="post-action-feedback" role="status">{postActionMessage}</p>}


      {/* ==================================== */}
      {/* COMMENTAIRES */}
      {/* ==================================== */}

      {showComments && (

        <div className="comments-section">
          <div className="comments-heading"><strong>Commentaires</strong><span>{comments.length}</span></div>

          {loadingComments && (

            <p>
              Chargement des commentaires...
            </p>

          )}


          {commentError && (

            <p className="modal-error">
              {commentError}
            </p>

          )}


          {!loadingComments &&
            comments.map(
              (comment) => (

                <div
                  className="comment-row"
                  key={
                    comment._id
                  }
                >

                  <div className="comment-avatar">

                    {comment.userId?.avatar ? (

                      <img
                        src={
                          comment.userId.avatar
                        }
                        alt={
                          comment.userId.username
                        }
                      />

                    ) : (

                      comment.userId?.username
                        ?.charAt(0)
                        .toUpperCase()

                    )}

                  </div>


                  <div className="comment-bubble">

                    <strong>
                      {
                        comment.userId
                          ?.username
                      }
                    </strong>
                    <time>{comment.createdAt ? new Date(comment.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</time>
                    <p>
                      {
                        comment.content
                      }
                    </p>

                  </div>

                </div>

              )
            )}


          {!loadingComments &&
            comments.length === 0 &&
            !commentError && (

              <p>
                Aucun commentaire pour le moment.
              </p>

            )}


          {/* ================================= */}
          {/* CHAMP COMMENTAIRE */}
          {/* ================================= */}

          <div className="comment-composer">

            <div className="comment-avatar">

              {user?.avatar ? (

                <img
                  src={user.avatar}
                  alt={user.username}
                />

              ) : (

                user?.username
                  ?.charAt(0)
                  .toUpperCase()

              )}

            </div>


            <textarea
              className="comment-text-input"
              rows={1}
              placeholder="Ajouter un commentaire…"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={handleCommentKeyDown}
              disabled={sendingComment}
            />


            <button
              type="button"
              onClick={
                handleCreateComment
              }
              disabled={
                sendingComment ||
                !commentText.trim()
              }
            >
              {sendingComment
                ? "..."
                : "➤"}
            </button>

          </div>

        </div>

      )}

    </article>
  );
}


export default PostCard;
