import { useState } from "react";

import { useAuth } from "../context/authContext";


function Register({
  onGoToLogin
}) {

  const {
    register
  } = useAuth();


  const [username, setUsername] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [referralCode] = useState(() => new URLSearchParams(window.location.search).get("ref") || "");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");


  // ==========================================================
  // INSCRIPTION
  // ==========================================================

  const handleSubmit = async (event) => {

    event.preventDefault();

    setError("");


    if (password !== confirmPassword) {

      setError(
        "Les mots de passe ne correspondent pas."
      );

      return;

    }


    if (password.length < 6) {

      setError(
        "Le mot de passe doit contenir au moins 6 caractères."
      );

      return;

    }


    try {

      setLoading(true);


      await register({
        username,
        email,
        password
        , referralCode
      });


      // AuthContext s'occupe automatiquement
      // de la session et de la redirection.


    } catch (error) {

      console.error(
        "Erreur inscription :",
        error
      );

      setError(
        error.message
      );

    } finally {

      setLoading(false);

    }

  };


  return (
    <div className="auth-page">

      <div className="auth-card">

        <div className="auth-logo"><img src="/veloce-mark.svg" alt="Logo Veloce" /></div>


        <h1>
          Rejoins Veloce
        </h1>


        <p className="auth-subtitle">
          Crée ton compte et commence à partager.
        </p>


        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}


        <form onSubmit={handleSubmit}>

          <div className="auth-field">

            <label>
              Nom d'utilisateur
            </label>

            <input
              type="text"
              placeholder="Ex : Daniel"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value)
              }
              minLength={3}
              maxLength={30}
              required
              disabled={loading}
            />

          </div>


          <div className="auth-field">

            <label>
              Adresse email
            </label>

            <input
              type="email"
              placeholder="exemple@email.com"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
              disabled={loading}
            />

          </div>


          <div className="auth-field">

            <label>
              Mot de passe
            </label>

            <input
              type="password"
              placeholder="Minimum 6 caractères"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              minLength={6}
              required
              disabled={loading}
            />

          </div>


          <div className="auth-field">

            <label>
              Confirmer le mot de passe
            </label>

            <input
              type="password"
              placeholder="Retape ton mot de passe"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              required
              disabled={loading}
            />

          </div>


          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >

            {loading
              ? "Création du compte..."
              : "Créer mon compte"
            }

          </button>

        </form>


        <div className="auth-footer">

          <span>
            Tu as déjà un compte ?
          </span>

          <button
            type="button"
            className="auth-link"
            onClick={onGoToLogin}
          >
            Se connecter
          </button>

        </div>

      </div>

    </div>
  );
}


export default Register;
