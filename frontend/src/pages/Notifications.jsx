import { useEffect, useRef, useState } from "react";

import { useAuth } from "../context/authContext";

import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  deleteNotification,
  markNotificationAsUnread
} from "../services/notificationService";


function Notifications({ onUnreadCountChange }) {
  const { token } = useAuth();

  const [
    notifications,
    setNotifications
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [actionsFor, setActionsFor] = useState("");
  const holdTimer = useRef(null);
  const suppressClick = useRef(false);


  const loadNotifications =
    async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await getNotifications(
            token
          );

        setNotifications(data);
        onUnreadCountChange?.(data.filter((item) => !item.read).length);

      } catch (error) {
        console.error(error);

        setError(
          error.message
        );

      } finally {
        setLoading(false);
      }
    };


  useEffect(() => {
    loadNotifications();
  }, [token, onUnreadCountChange]);


  const markAllRead =
    async () => {
      try {
        await markAllNotificationsAsRead(
          token
        );

        setNotifications(
          previous =>
            previous.map(
              notification => ({
                ...notification,
                read: true
              })
            )
        );
        onUnreadCountChange?.(0);

      } catch (error) {
        console.error(error);
      }
    };


  const openNotification =
    async (notification) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      if (
        !notification.read
      ) {
        try {
          await markNotificationAsRead({
            id: notification._id,
            token
          });

          setNotifications(
            previous =>
              previous.map(
                item =>
                  item._id ===
                  notification._id
                    ? {
                        ...item,
                        read: true
                      }
                    : item
              )
          );
          onUnreadCountChange?.((count) => Math.max(0, count - 1));
          window.dispatchEvent(new Event("veloce:notifications-updated"));

        } catch (error) {
          console.error(error);
        }
      }
    };

  const removeNotification = async (event, notificationId) => {
    event.stopPropagation();
    if (!window.confirm("Supprimer cette notification ?")) return;
    try {
      setDeletingId(notificationId);
      setDeleteError("");
      await deleteNotification({ id: notificationId, token });
      const removed = notifications.find((item) => item._id === notificationId);
      setNotifications((current) => current.filter((item) => item._id !== notificationId));
      if (removed && !removed.read) onUnreadCountChange?.((count) => Math.max(0, count - 1));
      setActionsFor("");
      window.dispatchEvent(new Event("veloce:notifications-updated"));
    } catch (deleteRequestError) {
      setDeleteError(deleteRequestError.message || "Impossible de supprimer cette notification.");
    } finally {
      setDeletingId("");
    }
  };

  const toggleReadState = async (notification) => {
    try {
      if (notification.read) await markNotificationAsUnread({ id: notification._id, token });
      else await markNotificationAsRead({ id: notification._id, token });
      setNotifications((items) => items.map((item) => item._id === notification._id ? { ...item, read: !notification.read } : item));
      onUnreadCountChange?.((count) => Math.max(0, count + (notification.read ? 1 : -1)));
      setActionsFor("");
      window.dispatchEvent(new Event("veloce:notifications-updated"));
    } catch (error) {
      setDeleteError(error.message || "Impossible de modifier cette notification.");
    }
  };

  const startHold = (notificationId) => {
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      setActionsFor(notificationId);
    }, 500);
  };
  const cancelHold = () => window.clearTimeout(holdTimer.current);


  if (loading) {
    return (
      <div className="empty-feed">
        Chargement des notifications...
      </div>
    );
  }


  if (error) {
    return (
      <div className="error-message">
        <h2>
          Notifications
        </h2>

        <p>
          {error}
        </p>
      </div>
    );
  }


  return (
    <section className="notifications-page">

      <div className="page-header">
        <div>
          <h1>
            Notifications
          </h1>

          <p>
            Les activités concernant ton compte.
          </p>
        </div>

        {notifications.some(
          item => !item.read
        ) && (
          <button
            className="page-action-button"
            onClick={markAllRead}
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {deleteError && <p className="notification-delete-error" role="alert">{deleteError}</p>}


      {notifications.length === 0 ? (
        <div className="empty-feed">
          <h2>
            Aucune notification
          </h2>

          <p>
            Tu verras ici les activités
            concernant ton compte.
          </p>
        </div>
      ) : (
        <div className="notification-list">

          {notifications.map(
            notification => (
              <div
                key={
                  notification._id
                }
                className={
                  `notification-card ${
                    notification.read
                      ? ""
                      : "notification-unread"
                  }`
                }
                onClick={() =>
                  openNotification(
                    notification
                  )
                }
                onContextMenu={(event) => { event.preventDefault(); setActionsFor(notification._id); }}
                onTouchStart={() => startHold(notification._id)}
                onTouchEnd={cancelHold}
                onTouchMove={cancelHold}
              >

                <div className="notification-avatar">
                  {notification.sender?.avatar ? (
                    <img
                      src={
                        notification.sender.avatar
                      }
                      alt=""
                    />
                  ) : (
                    notification.sender?.username
                      ?.charAt(0)
                      .toUpperCase()
                  )}
                </div>


                <div className="notification-content">

                  <strong>
                    {notification.sender?.username}
                  </strong>

                  <p>
                    {notification.message}
                  </p>

                  <span>
                    {new Date(
                      notification.createdAt
                    ).toLocaleString()}
                  </span>

                </div>

                {actionsFor === notification._id && <div className="notification-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => toggleReadState(notification)}>{notification.read ? "Marquer comme non lue" : "Marquer comme lue"}</button>
                  <button type="button" onClick={async () => {
                    try {
                      await navigator.clipboard?.writeText(`${notification.sender?.username || "Veloce"} : ${notification.message || "Notification"}`);
                      setActionsFor("");
                    } catch {
                      setDeleteError("Le presse-papiers n’est pas disponible dans ce navigateur.");
                    }
                  }}>Copier le texte</button>
                  <button type="button" className="notification-action-danger" disabled={deletingId === notification._id} onClick={(event) => removeNotification(event, notification._id)}>{deletingId === notification._id ? "Suppression…" : "Supprimer"}</button>
                </div>}

              </div>
            )
          )}

        </div>
      )}

    </section>
  );
}


export default Notifications;
