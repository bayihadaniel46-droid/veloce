import { useEffect, useState } from "react";

const pages = [
  { id: "profile", label: "Profil", icon: "👤" },
  { id: "assistant", label: "Mon assistant IA", icon: "✦" },
  { id: "notifications", label: "Notifications", icon: "🔔", badge: "notifications" },
  { id: "messages", label: "Messages", icon: "💬", badge: "messages" },
  { id: "explorer", label: "Explorer", icon: "🔎" },
  { id: "home", label: "Accueil", icon: "🏠" }
];

function MobileNavigation({
  currentPage,
  setCurrentPage,
  unreadMessages = 0,
  unreadNotifications = 0,
  onCreatePost
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const navigate = (page) => {
    setCurrentPage(page);
    setOpen(false);
  };

  return (
    <div className="mobile-navigation">
      {open && (
        <div className="mobile-navigation-actions" aria-label="Navigation">
          {pages.map((page) => {
            const count = page.badge === "messages"
              ? unreadMessages
              : page.badge === "notifications"
                ? unreadNotifications
                : 0;
            return (
              <div className="mobile-navigation-item" key={page.id}>
                <span className="mobile-navigation-label">{page.label}</span>
                <button
                  type="button"
                  className={`mobile-navigation-circle ${currentPage === page.id ? "is-active" : ""}`}
                  onClick={() => navigate(page.id)}
                  aria-label={count ? `${page.label}, ${count} non lus` : page.label}
                >
                  <span aria-hidden="true">{page.icon}</span>
                  {count > 0 && <b className="mobile-navigation-badge">{count > 99 ? "99+" : count}</b>}
                </button>
              </div>
            );
          })}
          <div className="mobile-navigation-item">
            <span className="mobile-navigation-label">Créer un post</span>
            <button
              type="button"
              className="mobile-navigation-circle mobile-navigation-create"
              onClick={() => { setOpen(false); onCreatePost(); }}
              aria-label="Créer une publication"
            >
              <span aria-hidden="true">＋</span>
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className={`mobile-navigation-toggle ${open ? "is-open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Fermer la navigation" : "Ouvrir la navigation"}
        aria-expanded={open}
      >
        {open ? "×" : "☰"}
      </button>
    </div>
  );
}

export default MobileNavigation;
