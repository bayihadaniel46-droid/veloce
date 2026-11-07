import "./Games.css";

function Games({ onBack }) {
  return (
    <section className="games-page">
      <button type="button" className="games-back" onClick={onBack}>← Retour à Explorer</button>

      <header className="games-hero">
        <span className="games-hero-icon" aria-hidden="true">🎮</span>
        <div>
          <span className="games-eyebrow">L’ESPACE LUDIQUE DE VELOCE</span>
          <h1>Jeux</h1>
          <p>Retrouve ici les jeux Veloce, joue et compare tes scores avec tes amis.</p>
        </div>
      </header>

      <section className="games-library" aria-labelledby="games-library-title">
        <div className="games-section-heading">
          <div><span>TA BIBLIOTHÈQUE</span><h2 id="games-library-title">Jeux disponibles</h2></div>
          <span className="games-count">0 jeu</span>
        </div>
        <div className="games-empty-state">
          <span aria-hidden="true">🕹️</span>
          <h3>La salle de jeux est prête</h3>
          <p>Les jeux apparaîtront dans cette bibliothèque. Tu pourras les ouvrir ici et y jouer sans quitter Veloce.</p>
        </div>
      </section>

      <section className="games-future-grid" aria-label="Fonctions de l’espace jeux">
        <article><span aria-hidden="true">🏆</span><div><strong>Scores entre amis</strong><small>Les meilleurs scores seront regroupés ici.</small></div><b>À venir</b></article>
        <article><span aria-hidden="true">🤝</span><div><strong>Défis</strong><small>Invite tes amis à battre ton record.</small></div><b>À venir</b></article>
      </section>
    </section>
  );
}

export default Games;
