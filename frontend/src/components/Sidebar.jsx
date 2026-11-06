import ProfileCard from "./ProfileCard";
import HomeIcon from "./HomeIcon";

function Sidebar({
  setCurrentPage,
  unreadMessages = 0,
  unreadNotifications = 0
}) {

  return (
    <aside className="sidebar">

      <h2 className="brand-wordmark">
        <img src="/veloce-mark.svg" alt="" />
        <span>Veloce</span>
      </h2>


      <nav>

        <ul>

          <li
            className="sidebar-home-item"
            onClick={() =>
              setCurrentPage("home")
            }
          >
            <HomeIcon className="sidebar-home-icon" />
            <span>Accueil</span>
          </li>


          <li
            onClick={() =>
              setCurrentPage("explorer")
            }
          >
            🔍 Explorer
            {unreadNotifications > 0 && <span className="nav-badge">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
          </li>


          <li
            onClick={() =>
              setCurrentPage("messages")
            }
          >
            💬 Messages
            {unreadMessages > 0 && <span className="nav-badge">{unreadMessages > 99 ? "99+" : unreadMessages}</span>}
          </li>


          <li
            onClick={() =>
              setCurrentPage("assistant")
            }
          >
            ✨ Mon assistant IA
          </li>

          <li
            onClick={() =>
              setCurrentPage("profile")
            }
          >
            👤 Profil
          </li>

        </ul>

      </nav>


      <ProfileCard />

    </aside>
  );
}

export default Sidebar;
