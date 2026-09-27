import { useAuth } from "../context/authContext";

function ProfileCard() {

  const {
    user,
    logout
  } = useAuth();


  if (!user) {
    return null;
  }


  const initial =
    user.username
      ?.charAt(0)
      .toUpperCase() || "?";


  return (
    <div className="profile-card">

      <div className="profile-card-avatar">

        {user.avatar ? (

          <img
            src={user.avatar}
            alt={user.username}
          />

        ) : (

          initial

        )}

      </div>


      <div className="profile-card-info">

        <strong>
          {user.username}
        </strong>

        <span>
          @{user.username}
        </span>

      </div>


      <button
        className="profile-card-logout"
        onClick={logout}
        title="Se déconnecter"
      >
        ↪
      </button>

    </div>
  );
}

export default ProfileCard;