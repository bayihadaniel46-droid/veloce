import {
  useEffect,
  useRef,
  useState
} from "react";

import { useAuth } from "../context/authContext";

import {
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage as deleteMessageRequest
} from "../services/messageService";

import {
  searchUsers
} from "../services/userService";


function Messages() {
  const { token, user } =
    useAuth();

  const [
    conversations,
    setConversations
  ] = useState([]);

  const [
    selectedUser,
    setSelectedUser
  ] = useState(null);
  const activeConversationId = useRef("");

  const [
    messages,
    setMessages
  ] = useState([]);

  const [
    content,
    setContent
  ] = useState("");

  const [
    search,
    setSearch
  ] = useState("");

  const [
    searchResults,
    setSearchResults
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [deletingMessageId, setDeletingMessageId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState("");


  const loadConversations =
    async () => {
      try {
        const data =
          await getConversations(
            token
          );

        setConversations(data);

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };


  useEffect(() => {
    loadConversations();
  }, [token]);


  const openConversation =
    async (person) => {
      const personId = person._id || person.id;
      activeConversationId.current = personId;
      setSelectedUser({ ...person, _id: personId });
      setMessages([]);
      setSendError("");
      try {
        const data =
          await getMessages({
            userId: personId,
            token
          });

        if (activeConversationId.current === personId) {
          setMessages(data);
        }

      } catch (error) {
        console.error(error);
      }
    };


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
        console.error(error);
      }
    };


  const handleSend =
    async () => {
      if (
        !content.trim() ||
        !selectedUser ||
        sendingMessage
      ) {
        return;
      }

      const messageContent = content.trim();
      const recipientId = selectedUser._id;
      const temporaryId = `pending-${Date.now()}`;
      const optimisticMessage = {
        _id: temporaryId,
        sender: { _id: user?.id || user?._id },
        recipient: { _id: recipientId },
        content: messageContent,
        createdAt: new Date().toISOString(),
        pending: true
      };

      setSendError("");
      setSendingMessage(true);
      setMessages((previous) => [...previous, optimisticMessage]);
      setContent("");

      try {
        const message =
          await sendMessage({
            userId: recipientId,
            content: messageContent,
            token
          });

        if (activeConversationId.current === recipientId) {
          setMessages((previous) => previous.map((item) =>
            item._id === temporaryId ? message : item
          ));
        }

        void loadConversations();

      } catch (error) {
        console.error(error);
        if (activeConversationId.current === recipientId) {
          setMessages((previous) => previous.filter((item) => item._id !== temporaryId));
          setContent((previous) => previous || messageContent);
          setSendError(error.message || "Impossible d'envoyer le message.");
        }
      } finally {
        setSendingMessage(false);
      }
    };

  const closeConversation = () => {
    activeConversationId.current = "";
    setSelectedUser(null);
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Supprimer ce message de votre boîte ?")) return;
    try {
      setDeletingMessageId(messageId);
      setDeleteError("");
      await deleteMessageRequest({ messageId, token });
      setMessages((current) => current.filter((message) => message._id !== messageId));
      await loadConversations();
    } catch (error) {
      setDeleteError(error.message || "Impossible de supprimer ce message.");
    } finally {
      setDeletingMessageId("");
    }
  };


  if (loading) {
    return (
      <div className="empty-feed">
        Chargement des messages...
      </div>
    );
  }


  return (
    <section className="messages-page">

      <div className={`messages-layout ${selectedUser ? "conversation-open" : ""}`}>

        {/* ==================================================
            LISTE DES CONVERSATIONS
        ================================================== */}

        <div className="messages-sidebar">

          <div className="messages-title">
            Messages
          </div>


          <input
            className="messages-search"
            value={search}
            onChange={handleSearch}
            placeholder="Rechercher une personne..."
          />


          {searchResults.length > 0 && (
            <div className="message-search-results">

              {searchResults.map(
                person => (
                  <button
                    key={person.id}
                    className="message-person"
                    onClick={() =>
                      openConversation(
                        person
                      )
                    }
                  >
                    <div className="message-avatar">
                      {person.avatar ? (
                        <img
                          src={person.avatar}
                          alt=""
                        />
                      ) : (
                        person.username
                          ?.charAt(0)
                          .toUpperCase()
                      )}
                    </div>

                    <strong>
                      {person.username}
                    </strong>
                  </button>
                )
              )}

            </div>
          )}


          <div className="conversation-list">

            {conversations.length === 0 ? (
              <p className="messages-empty">
                Aucune conversation.
              </p>
            ) : (
              conversations.map(
                conversation => (
                  <button
                    key={
                      conversation.user._id
                    }
                    className={
                      `conversation-card ${
                        selectedUser?._id ===
                        conversation.user._id
                          ? "conversation-active"
                          : ""
                      }`
                    }
                    onClick={() =>
                      openConversation(
                        conversation.user
                      )
                    }
                  >

                    <div className="message-avatar">
                      {conversation.user.avatar ? (
                        <img
                          src={
                            conversation.user.avatar
                          }
                          alt=""
                        />
                      ) : (
                        conversation.user.username
                          ?.charAt(0)
                          .toUpperCase()
                      )}
                    </div>

                    <div className="conversation-info">

                      <strong>
                        {
                          conversation.user
                            .username
                        }
                      </strong>

                      <span>
                        {
                          conversation.lastMessage
                        }
                      </span>

                    </div>

                    {conversation.unread > 0 && (
                      <b>
                        {conversation.unread}
                      </b>
                    )}

                  </button>
                )
              )
            )}

          </div>

        </div>


        {/* ==================================================
            CONVERSATION
        ================================================== */}

        <div className="messages-conversation">

          {!selectedUser ? (
            <div className="messages-placeholder">

              <h2>
                Tes messages
              </h2>

              <p>
                Sélectionne une conversation
                pour commencer à échanger.
              </p>

            </div>
          ) : (

            <>
              <div className="conversation-header">
                <button type="button" className="mobile-conversation-back" onClick={closeConversation} aria-label="Retour à la liste des messages">←</button>
                <div className="message-avatar">

                  {selectedUser.avatar ? (
                    <img
                      src={
                        selectedUser.avatar
                      }
                      alt=""
                    />
                  ) : (
                    selectedUser.username
                      ?.charAt(0)
                      .toUpperCase()
                  )}

                </div>

                <strong>
                  {selectedUser.username}
                </strong>

              </div>


              <div className="message-list">

                {deleteError && <p className="message-delete-error" role="alert">{deleteError}</p>}

                {messages.length === 0 && <p className="messages-empty">Aucun message dans cette conversation.</p>}

                {messages.map(
                  message => {

                    const mine =
                      String(message.sender?._id || message.sender) ===
                      String(user?.id || user?._id);

                    return (
                      <div
                        key={
                          message._id
                        }
                        className={
                          `message-bubble-row ${
                            mine
                              ? "message-mine"
                              : "message-theirs"
                          }`
                        }
                      >

                        <div className="message-bubble">
                          {message.content}
                          {message.pending && <small className="message-pending">Envoi…</small>}
                        </div>

                        <button
                          type="button"
                          className="message-delete-button"
                          title="Supprimer de ma boîte"
                          aria-label="Supprimer ce message de ma boîte"
                          disabled={message.pending || deletingMessageId === message._id}
                          onClick={() => handleDeleteMessage(message._id)}
                        >
                          {message.pending || deletingMessageId === message._id ? "…" : "🗑"}
                        </button>

                      </div>
                    );
                  }
                )}

              </div>


              {sendError && <p className="message-send-error" role="alert">{sendError}</p>}
              <div className="message-input-area">

                <textarea
                  value={content}
                  onChange={event =>
                    setContent(
                      event.target.value
                    )
                  }
                  onKeyDown={event => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Écrire un message..."
                />

                <button
                  onClick={handleSend}
                  disabled={
                    !content.trim() || sendingMessage
                  }
                >
                  {sendingMessage ? "Envoi…" : "Envoyer"}
                </button>

              </div>

            </>

          )}

        </div>

      </div>

    </section>
  );
}


export default Messages;
