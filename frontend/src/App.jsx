import React from "react";
import "./App.css";

import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";

import {
  AuthProvider,
  useAuth
} from "./context/authContext";


// ============================================================
// APPLICATION
// ============================================================

function AppContent() {

  const {
    isAuthenticated,
    loading
  } = useAuth();

  // Referral links deliberately open the registration screen even in a
  // browser that currently has another Veloce account signed in. This lets
  // the invitee create their own credentials without inheriting that session.
  const inviteRegistration = new URLSearchParams(window.location.search).get("join") === "1";


  // ==========================================================
  // CHARGEMENT DE LA SESSION
  // ==========================================================

  if (loading) {

    return (
      <div className="auth-page">

        <div className="auth-card">

          <div className="auth-logo"><img src="/veloce-mark.svg" alt="Logo Veloce" /></div>

          <h1>
            Veloce
          </h1>

          <p className="auth-subtitle">
            Chargement de votre session...
          </p>

        </div>

      </div>
    );

  }

  if (inviteRegistration) {
    return <AuthPages />;
  }


  // ==========================================================
  // UTILISATEUR CONNECTÉ
  // ==========================================================

  if (isAuthenticated) {

    return <Home />;

  }


  // ==========================================================
  // UTILISATEUR NON CONNECTÉ
  // ==========================================================

  return (
    <AuthPages />
  );

}


// ============================================================
// PAGES AUTHENTIFICATION
// ============================================================

function AuthPages() {

  const [page, setPage] = React.useState(() => new URLSearchParams(window.location.search).has("ref") ? "register" : "login");


  if (page === "register") {

    return (
      <Register
        onRegisterSuccess={() => {}}
        onGoToLogin={() =>
          setPage("login")
        }
      />
    );

  }


  return (
    <Login
      onLoginSuccess={() => {}}
      onGoToRegister={() =>
        setPage("register")
      }
    />
  );

}


// ============================================================
// PROVIDER
// ============================================================

function App() {

  return (
    <AuthProvider>

      <AppContent />

    </AuthProvider>
  );

}


export default App;
