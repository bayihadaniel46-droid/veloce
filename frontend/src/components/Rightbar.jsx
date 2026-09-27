import {
  useEffect,
  useState
} from "react";

import { useAuth } from "../context/authContext";
import { API_BASE_URL } from "../config";

import {
  searchUsers,
  getSuggestions,
  toggleFollow
} from "../services/userService";


function Rightbar() {
  const { token } =
    useAuth();


  const [
    search,
    setSearch
  ] = useState("");

  const [
    searchResults,
    setSearchResults
  ] = useState([]);

  const [
    suggestions,
    setSuggestions
  ] = useState([]);

  const [
    trends,
    setTrends
  ] = useState([]);


  /* ==========================================================
     SUGGESTIONS
  ========================================================== */

  const loadSuggestions =
    async () => {
      try {
        const data =
          await getSuggestions(
            token
          );

        setSuggestions(data);

      } catch (error) {
        console.error(
          "Suggestions :",
          error
        );
      }
    };


  /* ==========================================================
     TENDANCES
  ========================================================== */

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
        console.error(
          "Tendances :",
          error
        );
      }
    };


  useEffect(() => {
    loadSuggestions();
    loadTrends();
  }, [token]);


  /* ==========================================================
     RECHERCHE
  ========================================================== */

  const handleSearch =
    async (event) => {
      const value =
        event.target.value;

      setSearch(value);

      if (!value.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        const data =
          await searchUsers({
            q: value,
            token
          });

        setSearchResults(data);

      } catch (error) {
        console.error(
          "Recherche :",
          error
        );
      }
    };


  /* ==========================================================
     FOLLOW
  ========================================================== */

  const handleFollow =
    async (person) => {
      try {
        const data =
          await toggleFollow({
            userId:
              person.id,
            token
          });

        if (data.following) {
          setSuggestions(
            previous =>
              previous.filter(
                item =>
                  item.id !==
                  person.id
              )
          );
        }

      } catch (error) {
        console.error(
          "Follow :",
          error
        );
      }
    };


  return (
    <aside className="rightbar">


      {/* =====================================================
          RECHERCHE
      ===================================================== */}

      <div className="rightbar-card">

        <div className="rightbar-title">
          Recherche
        </div>


        <div className="rightbar-search">

          <span>
            🔎
          </span>

          <input
            value={search}
            onChange={handleSearch}
            placeholder="Rechercher..."
          />

        </div>


        {searchResults.length > 0 && (

          <div className="rightbar-search-results">

            {searchResults
              .slice(0, 5)
              .map(person => (

                <div
                  key={person.id}
                  className="rightbar-search-person"
                >

                  <div className="rightbar-small-avatar">

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


                  <div className="rightbar-person-info">

                    <strong>
                      {person.username}
                    </strong>

                    <span>
                      {person.bio ||
                        "Utilisateur Veloce"}
                    </span>

                  </div>

                </div>

              ))}

          </div>

        )}

      </div>


      {/* =====================================================
          TENDANCES
      ===================================================== */}

      <div className="rightbar-card">

        <div className="rightbar-title">
          Tendances populaires
        </div>


        {trends.length === 0 ? (

          <div className="rightbar-empty">

            Les tendances apparaîtront
            lorsque les utilisateurs
            publieront des hashtags.

          </div>

        ) : (

          <div className="rightbar-trends">

            {trends
              .slice(0, 5)
              .map(
                (trend, index) => (

                  <div
                    key={trend.name}
                    className="rightbar-trend"
                  >

                    <span>
                      #{index + 1}
                    </span>

                    <div>

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

                  </div>

                )
              )}

          </div>

        )}

      </div>


      {/* =====================================================
          PERSONNES À SUIVRE
      ===================================================== */}

      <div className="rightbar-card">

        <div className="rightbar-title">
          Personnes à suivre
        </div>


        {suggestions.length === 0 ? (

          <div className="rightbar-empty">

            Aucune nouvelle suggestion
            pour le moment.

          </div>

        ) : (

          <div className="rightbar-suggestions">

            {suggestions.map(
              person => (

                <div
                  key={person.id}
                  className="rightbar-suggestion"
                >

                  <div className="rightbar-small-avatar">

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


                  <div className="rightbar-person-info">

                    <strong>
                      {person.username}
                    </strong>

                    <span>
                      {person.bio ||
                        "Utilisateur Veloce"}
                    </span>

                  </div>


                  <button
                    onClick={() =>
                      handleFollow(
                        person
                      )
                    }
                  >
                    Suivre
                  </button>

                </div>

              )
            )}

          </div>

        )}

      </div>


    </aside>
  );
}


export default Rightbar;
