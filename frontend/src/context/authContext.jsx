import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import {
  loginUser,
  registerUser
} from "../services/authService";
import { API_BASE_URL } from "../config";


// ============================================================
// CONTEXTE
// ============================================================

const AuthContext =
  createContext(null);


// ============================================================
// URL API
// ============================================================

const API_URL = `${API_BASE_URL}/auth`;


// ============================================================
// PROVIDER
// ============================================================

export function AuthProvider({
  children
}) {

  const [
    user,
    setUser
  ] = useState(null);

  const [
    token,
    setToken
  ] = useState(
    () =>
      localStorage.getItem(
        "veloce_token"
      )
  );

  const [
    loading,
    setLoading
  ] = useState(true);


  // ==========================================================
  // RÉCUPÉRER L'UTILISATEUR
  // ==========================================================

  const fetchCurrentUser =
    async (currentToken) => {

      try {

        const response =
          await fetch(
            `${API_URL}/me`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${currentToken}`
              }
            }
          );

        if (!response.ok) {
          throw new Error(
            "Session invalide."
          );
        }

        const data =
          await response.json();

        setUser(
          data.user
        );

        localStorage.setItem(
          "veloce_user",
          JSON.stringify(
            data.user
          )
        );

        return data.user;

      } catch (error) {

        console.error(
          "Session invalide :",
          error
        );

        localStorage.removeItem(
          "veloce_token"
        );

        localStorage.removeItem(
          "veloce_user"
        );

        setToken(null);
        setUser(null);

        return null;
      }
    };


  // ==========================================================
  // VÉRIFIER LA SESSION
  // ==========================================================

  useEffect(() => {

    const initializeAuth =
      async () => {

        const savedToken =
          localStorage.getItem(
            "veloce_token"
          );

        if (!savedToken) {

          setLoading(false);

          return;
        }

        await fetchCurrentUser(
          savedToken
        );

        setLoading(false);
      };

    initializeAuth();

  }, []);


  // ==========================================================
  // INSCRIPTION
  // ==========================================================

  const register =
    async (credentials) => {

      const data =
        await registerUser(
          credentials
        );

      localStorage.setItem(
        "veloce_token",
        data.token
      );

      localStorage.setItem(
        "veloce_user",
        JSON.stringify(
          data.user
        )
      );

      setToken(
        data.token
      );

      setUser(
        data.user
      );

      return data;
    };


  // ==========================================================
  // CONNEXION
  // ==========================================================

  const login =
    async (credentials) => {

      const data =
        await loginUser(
          credentials
        );

      localStorage.setItem(
        "veloce_token",
        data.token
      );

      localStorage.setItem(
        "veloce_user",
        JSON.stringify(
          data.user
        )
      );

      setToken(
        data.token
      );

      setUser(
        data.user
      );

      return data;
    };


  // ==========================================================
  // ACTUALISER L'UTILISATEUR
  // ==========================================================

  const updateUser =
    (updatedUser) => {

      setUser(
        updatedUser
      );

      localStorage.setItem(
        "veloce_user",
        JSON.stringify(
          updatedUser
        )
      );
    };


  // ==========================================================
  // DÉCONNEXION
  // ==========================================================

  const logout = () => {

    localStorage.removeItem(
      "veloce_token"
    );

    localStorage.removeItem(
      "veloce_user"
    );

    setToken(null);
    setUser(null);
  };


  // ==========================================================
  // CONTEXTE
  // ==========================================================

  const value = {

    user,

    token,

    loading,

    isAuthenticated:
      Boolean(
        token &&
        user
      ),

    login,

    register,

    logout,

    updateUser,

    refreshUser:
      () =>
        fetchCurrentUser(
          token
        )
  };


  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}


// ============================================================
// HOOK useAuth
// ============================================================

export function useAuth() {

  const context =
    useContext(
      AuthContext
    );

  if (!context) {

    throw new Error(
      "useAuth doit être utilisé à l'intérieur de AuthProvider."
    );
  }

  return context;
}
