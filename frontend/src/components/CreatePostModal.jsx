import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { createPost } from "../services/postService";

function CreatePostModal({
  isOpen,
  onClose,
  onAddPost
}) {
  const { token, user } = useAuth();

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Nettoyage des URLs d'aperçu
  useEffect(() => {
    return () => {
      selectedFiles.forEach((item) => {
        if (item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [selectedFiles]);

  if (!isOpen) {
    return null;
  }

  // ========================================
  // FICHIERS
  // ========================================

  const addFiles = (files) => {
    const newFiles = Array.from(files);

    if (newFiles.length === 0) {
      return;
    }

    const preparedFiles = newFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null
    }));

    setSelectedFiles((previous) => [
      ...previous,
      ...preparedFiles
    ]);

    setError("");
  };

  // ========================================
  // PHOTOS
  // ========================================

  const handleImages = (event) => {
    addFiles(event.target.files);

    event.target.value = "";
  };

  // ========================================
  // FICHIERS
  // ========================================

  const handleFiles = (event) => {
    addFiles(event.target.files);

    event.target.value = "";
  };

  // ========================================
  // SUPPRIMER UN FICHIER
  // ========================================

  const removeFile = (id) => {
    setSelectedFiles((previous) => {
      const fileToRemove =
        previous.find(
          (item) => item.id === id
        );

      if (
        fileToRemove?.preview
      ) {
        URL.revokeObjectURL(
          fileToRemove.preview
        );
      }

      return previous.filter(
        (item) => item.id !== id
      );
    });
  };

  // ========================================
  // PUBLICATION
  // ========================================

  const publishPost = async () => {
    if (
      !content.trim() &&
      selectedFiles.length === 0
    ) {
      setError(
        "Ajoute du texte, une photo ou un fichier."
      );

      return;
    }

    if (!token || !user) {
      setError(
        "Tu dois être connecté pour publier."
      );

      return;
    }

    try {
      setLoading(true);
      setError("");

      /*
       * Pour l'instant, notre backend actuel
       * accepte seulement "content".
       *
       * Les fichiers sont donc sélectionnés
       * et prévisualisés côté interface.
       *
       * L'étape suivante sera l'upload réel
       * vers le serveur.
       */

      const createdPost =
        await createPost({
          content: content.trim(),

          files:
            selectedFiles.map(
              (item) => item.file
            ),


          token
        });

      onAddPost(createdPost);

      setContent("");

      selectedFiles.forEach((item) => {
        if (item.preview) {
          URL.revokeObjectURL(
            item.preview
          );
        }
      });

      setSelectedFiles([]);

      onClose();

    } catch (error) {
      console.error(
        "Erreur publication :",
        error
      );

      setError(
        error.message ||
        "Impossible de publier."
      );

    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // FERMER
  // ========================================

  const handleClose = () => {
    if (loading) {
      return;
    }

    selectedFiles.forEach((item) => {
      if (item.preview) {
        URL.revokeObjectURL(
          item.preview
        );
      }
    });

    setContent("");
    setSelectedFiles([]);
    setError("");

    onClose();
  };

  // ========================================
  // ENTRÉE
  // ========================================

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey)
    ) {
      publishPost();
    }
  };

  // ========================================
  // FORMAT TAILLE
  // ========================================

  const formatFileSize = (bytes) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  };

  return (
    <div
      className="create-modal-overlay"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          handleClose();
        }
      }}
    >

      <div className="create-modal">

        {/* ================================= */}
        {/* HEADER */}
        {/* ================================= */}

        <div className="create-modal-header">

          <div>
            <h2>
              Nouvelle publication
            </h2>

            <p>
              Partagez quelque chose avec
              la communauté.
            </p>
          </div>

          <button
            type="button"
            className="create-modal-close"
            onClick={handleClose}
            disabled={loading}
          >
            ×
          </button>

        </div>


        {/* ================================= */}
        {/* UTILISATEUR */}
        {/* ================================= */}

        <div className="create-modal-user">

          <div className="create-modal-avatar">

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

          <div>

            <strong>
              {user?.username}
            </strong>

            <span>
              Publication publique
            </span>

          </div>

        </div>


        {/* ================================= */}
        {/* TEXTE */}
        {/* ================================= */}

        <textarea
          className="create-modal-textarea"
          placeholder="Qu'avez-vous envie de partager ?"
          value={content}
          onChange={(event) =>
            setContent(
              event.target.value
            )
          }
          onKeyDown={handleKeyDown}
          disabled={loading}
          autoFocus
        />


        {/* ================================= */}
        {/* OUTILS */}
        {/* ================================= */}

        <div className="create-tools">

          <button
            type="button"
            className="create-tool"
            onClick={() =>
              imageInputRef.current?.click()
            }
            disabled={loading}
          >
            <span className="tool-icon">
              🖼️
            </span>

            <span>
              Photo
            </span>
          </button>


          <button
            type="button"
            className="create-tool"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={loading}
          >
            <span className="tool-icon">
              📎
            </span>

            <span>
              Fichier
            </span>
          </button>

        </div>


        {/* INPUT PHOTO */}

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleImages}
        />


        {/* INPUT FICHIER */}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={handleFiles}
        />


        {/* ================================= */}
        {/* APERÇU */}
        {/* ================================= */}

        {selectedFiles.length > 0 && (

          <div className="selected-files">

            <div className="selected-files-header">

              <span>
                Fichiers sélectionnés
              </span>

              <span>
                {selectedFiles.length}
              </span>

            </div>


            <div className="selected-files-grid">

              {selectedFiles.map((item) => (

                <div
                  className="selected-file"
                  key={item.id}
                >

                  {item.preview ? (

                    <img
                      src={item.preview}
                      alt={item.file.name}
                    />

                  ) : (

                    <div className="file-preview">

                      <span>
                        📄
                      </span>

                      <small>
                        {item.file.name}
                      </small>

                    </div>

                  )}


                  <div className="selected-file-info">

                    <span>
                      {item.file.name}
                    </span>

                    <small>
                      {formatFileSize(
                        item.file.size
                      )}
                    </small>

                  </div>


                  <button
                    type="button"
                    className="remove-file"
                    onClick={() =>
                      removeFile(item.id)
                    }
                    disabled={loading}
                  >
                    ×
                  </button>

                </div>

              ))}

            </div>

          </div>

        )}


        {/* ================================= */}
        {/* ERREUR */}
        {/* ================================= */}

        {error && (

          <div className="create-modal-error">
            {error}
          </div>

        )}


        {/* ================================= */}
        {/* FOOTER */}
        {/* ================================= */}

        <div className="create-modal-footer">

          <div className="create-modal-hint">
            Ctrl + Entrée pour publier
          </div>

          <button
            type="button"
            className="create-publish-button"
            onClick={publishPost}
            disabled={
              loading ||
              (
                !content.trim() &&
                selectedFiles.length === 0
              )
            }
          >
            {loading
              ? "Publication..."
              : "Publier"}
          </button>

        </div>

      </div>

    </div>
  );
}

export default CreatePostModal;