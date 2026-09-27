import {
  useEffect,
  useState
} from "react";

import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";

import {
  searchUsers,
  toggleFollow
} from "../services/userService";


function Explorer() {
  const { token } =
    useAuth();

  const [
    search,
    setSearch
  ] = useState("");

  const [
    users,
    setUsers
  ] = useState([]);

  const [
    trends,
    setTrends
  ] = useState([]);


  const loadTrends =
    async () => {
      try {
        const response =
          await fetch(
            `${API_BASE_URL}/posts/trends`
          );

        const data =
          await response.json();

        if (response.ok) {
          setTrends(data);
        }

      } catch (error) {
        console.error(error);
      }
    };


  useEffect(() => {
    loadTrends();
  }, []);


  const handleSearch =
    async (event) => {
      const value =
        event.target.value;

      setSearch(value);

      if (!value.trim()) {
        setUsers([]);
        return;
      }

      try {
        const data =
          await searchUsers({
            q: value,
            token
          });

        setUsers(data);

      } catch (error) {
        console.error(error);
      }
    };


  const follow =
    async (person) => {
      try {
        const data =
          await toggleFollow({
            userId:
              person.id,
            token
          });

        setUsers(
          previous =>
            previous.map(
              item =>
                item.id ===
                person.id
                  ? {
                      ...item,
                      isFollowing:
                        data.following
                    }
                  : item
            )
        );

      } catch (error) {
        console.error(error);
      }
    };


  return (
    <section className="explorer-page">

      <div className="page-header">

        <div>
          <h1>
            Explorer
          </h1>

          <p>
            Découvre les utilisateurs
            et les tendances de Veloce.
          </p>
        </div>

      </div>


      <div className="explorer-search-card">

        <input
          value={search}
          onChange={handleSearch}
          placeholder="Rechercher un utilisateur..."
        />

      </div>


      {search && (
        <div className="explorer-section">

          <h2>
            Utilisateurs
          </h2>

          {users.length === 0 ? (
            <p className="explorer-empty">
              Aucun utilisateur trouvé.
            </p>
          ) : (

            <div className="explorer-user-list">

              {users.map(
                person => (
                  <div
                    key={person.id}
                    className="explorer-user-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => window.dispatchEvent(new CustomEvent("veloce:open-user-profile", { detail: { userId: person.id } }))}
                    onKeyDown={(event) => { if (event.key === "Enter") window.dispatchEvent(new CustomEvent("veloce:open-user-profile", { detail: { userId: person.id } })); }}
                  >

                    <div className="explorer-avatar">

                      {person.avatar ? (
                        <img
                          src={
                            person.avatar
                          }
                          alt=""
                        />
                      ) : (
                        person.username
                          ?.charAt(0)
                          .toUpperCase()
                      )}

                    </div>


                    <div className="explorer-user-info">

                      <strong>
                        {person.username}
                      </strong>

                      <span>
                        {person.bio ||
                          "Aucune biographie."}
                      </span>

                    </div>


                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        follow(person);
                      }}
                    >
                      {person.isFollowing
                        ? "Suivi"
                        : "Suivre"}
                    </button>

                  </div>
                )
              )}

            </div>

          )}

        </div>
      )}


      <div className="explorer-section">

        <h2>
          Tendances
        </h2>

        {trends.length === 0 ? (
          <div className="explorer-empty-card">

            <h3>
              Pas encore de tendance
            </h3>

            <p>
              Les tendances apparaîtront
              automatiquement lorsque
              les utilisateurs publieront
              avec des hashtags.
            </p>

          </div>
        ) : (

          <div className="trend-grid">

            {trends.map(
              trend => (
                <div
                  key={trend.name}
                  className="trend-card"
                >

                  <span>
                    Tendance
                  </span>

                  <strong>
                    {trend.name}
                  </strong>

                  <small>
                    {trend.count} publication
                    {trend.count > 1
                      ? "s"
                      : ""}
                  </small>

                </div>
              )
            )}

          </div>

        )}

      </div>

    </section>
  );
}


export default Explorer;
