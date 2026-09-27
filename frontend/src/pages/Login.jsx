import { useState } from "react";

import { useAuth } from "../context/AuthContext";


function Login({
  onGoToRegister
}) {

  const {
    login
  } = useAuth();


  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");


  // ==========================================================
  // CONNEXION
  // ==========================================================

  const handleSubmit = async (event) => {

    event.preventDefault();

    setError("");


    try {

      setLoading(true);


      await login({
        email,
        password
      });


    } catch (error) {

      console.error(
        "Erreur connexion :",
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
          Bon retour sur Veloce
        </h1>


        <p className="auth-subtitle">
          Connecte-toi pour continuer.
        </p>


        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}


        <form onSubmit={handleSubmit}>

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
              placeholder="Ton mot de passe"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
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
              ? "Connexion..."
              : "Se connecter"
            }

          </button>

        </form>


        <div className="auth-footer">

          <span>
            Tu n'as pas encore de compte ?
          </span>

          <button
            type="button"
            className="auth-link"
            onClick={onGoToRegister}
          >
            Créer un compte
          </button>

        </div>

      </div>

    </div>
  );
}


export default Login;
