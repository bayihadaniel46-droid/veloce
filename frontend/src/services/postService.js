import { API_BASE_URL } from "../config";

const API_URL = `${API_BASE_URL}/posts`;


// ==========================================
// RÉCUPÉRER LES PUBLICATIONS
// ==========================================

export const getPosts = async () => {

  const response =
    await fetch(API_URL);

  const data =
    await response.json();

  if (!response.ok) {

    throw new Error(
      data.message ||
      "Impossible de charger les publications."
    );

  }

  return data;
};


// ==========================================
// CRÉER UNE PUBLICATION
// ==========================================

export const createPost = async ({
  content,
  files = [],
  token
}) => {

  const formData =
    new FormData();

  formData.append(
    "content",
    content || ""
  );

  files.forEach((file) => {

    formData.append(
      "files",
      file
    );

  });

  const response =
    await fetch(API_URL, {

      method: "POST",

      headers: {
        Authorization:
          `Bearer ${token}`
      },

      body: formData

    });


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.message ||
      "Impossible de créer la publication."
    );

  }

  return data;
};


// ==========================================
// LIKE
// ==========================================

export const toggleLike = async ({
  postId,
  token
}) => {

  const response =
    await fetch(
      `${API_URL}/${postId}/like`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`
        }
      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.message ||
      "Impossible de modifier le like."
    );

  }

  return data;
};


// ==========================================
// RÉCUPÉRER LES COMMENTAIRES
// ==========================================

export const getComments = async ({
  postId
}) => {

  const response =
    await fetch(
      `${API_URL}/${postId}/comments`
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.message ||
      "Impossible de charger les commentaires."
    );

  }

  return data;
};


// ==========================================
// CRÉER UN COMMENTAIRE
// ==========================================

export const createComment = async ({
  postId,
  content,
  token
}) => {

  const response =
    await fetch(
      `${API_URL}/${postId}/comments`,
      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`

        },

        body: JSON.stringify({
          content
        })

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.message ||
      "Impossible d'ajouter le commentaire."
    );

  }

  return data;
};


// ==========================================
// VÉRIFICATION D'UNE PUBLICATION
// ==========================================

export const verifyPost = async ({
  postId,
  token
}) => {

  const response =
    await fetch(
      `${API_URL}/${postId}/verify`,
      {

        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`
        }

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.message ||
      "Impossible de vérifier cette publication."
    );

  }

  return data;
};
