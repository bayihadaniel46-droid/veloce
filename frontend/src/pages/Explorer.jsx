import {
  useEffect,
  useState
} from "react";

import { useAuth } from "../context/authContext";
import { API_BASE_URL } from "../config";

import {
  searchUsers,
  toggleFollow,
  getSuggestions
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

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [followingId, setFollowingId] = useState("");

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

  useEffect(() => {
    let active = true;
    getSuggestions(token)
      .then((data) => { if (active) setSuggestions(Array.isArray(data) ? data : []); })
      .catch((error) => { if (active) setSuggestionsError(error.message || "Impossible de charger les suggestions."); })
      .finally(() => { if (active) setSuggestionsLoading(false); });
    return () => { active = false; };
  }, [token]);


  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setUsers([]);
      setSearchError("");
      setSearchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      try {
        const data = await searchUsers({ q: query, token, signal: controller.signal });
        setUsers(data);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(error);
          setSearchError("La recherche n’a pas abouti. Vérifie ta connexion puis réessaie.");
        }
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [search, token]);


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

  const followSuggestion = async (person) => {
    const id = person.id || person._id;
    try {
      setFollowingId(id);
      await toggleFollow({ userId: id, token });
      setSuggestions((current) => current.filter((item) => (item.id || item._id) !== id));
    } catch (error) {
      setSuggestionsError(error.message || "Impossible de suivre ce compte.");
    } finally {
      setFollowingId("");
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
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un utilisateur..."
        />

      </div>

      {!search.trim() && <div className="explorer-section suggestion-section">
        <div className="suggestion-heading"><div><h2>Comptes à découvrir</h2><p>Choisis qui tu souhaites suivre. Tu peux ignorer une suggestion.</p></div><span>Pour toi</span></div>
        {suggestionsLoading ? <p className="explorer-empty">Préparation de tes suggestions…</p> : suggestionsError ? <p className="explorer-empty" role="alert">{suggestionsError}</p> : suggestions.length === 0 ? <p className="explorer-empty-card">Tu suis déjà les comptes proposés. Reviens bientôt pour découvrir d’autres membres.</p> : <div className="suggestion-grid">{suggestions.map((person) => {
          const id = person.id || person._id;
          return <article className="suggestion-card" key={id}>
            <button type="button" className="suggestion-profile" onClick={() => window.dispatchEvent(new CustomEvent("veloce:open-user-profile", { detail: { userId: id } }))}>
              <div className="explorer-avatar">{person.avatar ? <img src={person.avatar} alt="" /> : person.username?.charAt(0).toUpperCase()}</div>
              <strong>{person.username}</strong>
              <span>{person.bio || "Découvre ce membre de Veloce."}</span>
            </button>
            <div className="suggestion-actions">
              <button type="button" onClick={() => followSuggestion(person)} disabled={followingId === id}>{followingId === id ? "Suivi…" : "Suivre"}</button>
              <button type="button" onClick={() => setSuggestions((current) => current.filter((item) => (item.id || item._id) !== id))}>Ignorer</button>
            </div>
          </article>;
        })}</div>}
      </div>}


      {search && (
        <div className="explorer-section">

          <h2>
            Utilisateurs
          </h2>

          {searchLoading ? (
            <p className="explorer-empty">Recherche en cours…</p>
          ) : searchError ? (
            <p className="explorer-empty" role="alert">{searchError}</p>
          ) : users.length === 0 ? (
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
