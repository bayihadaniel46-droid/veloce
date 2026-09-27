import {
  useEffect,
  useState
} from "react";

import { useAuth } from "../context/authContext";

import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  deleteNotification
} from "../services/notificationService";


function Notifications() {
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
  }, [token]);


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

      } catch (error) {
        console.error(error);
      }
    };


  const openNotification =
    async (notification) => {
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
      setNotifications((current) => current.filter((item) => item._id !== notificationId));
    } catch (deleteRequestError) {
      setDeleteError(deleteRequestError.message || "Impossible de supprimer cette notification.");
    } finally {
      setDeletingId("");
    }
  };


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

                <button
                  type="button"
                  className="notification-delete-button"
                  aria-label="Supprimer cette notification"
                  title="Supprimer cette notification"
                  disabled={deletingId === notification._id}
                  onClick={(event) => removeNotification(event, notification._id)}
                >
                  {deletingId === notification._id ? "…" : "🗑"}
                </button>

              </div>
            )
          )}

        </div>
      )}

    </section>
  );
}


export default Notifications;
