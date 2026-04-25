import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { acceptInvite } from "../api/invites";
import { isAuthenticated } from "../api/auth";
import styles from "./InvitePage.module.css";

type State = "loading" | "success" | "error" | "unauthenticated";

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorMessage("Invalid invite link");
      setState("error");
      return;
    }

    if (!isAuthenticated()) {
      setState("unauthenticated");
      return;
    }

    let cancelled = false;

    acceptInvite(token)
      .then((result) => {
        if (cancelled) return;
        setTeamId(result.teamId);
        setState("success");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to accept invite";
        setErrorMessage(message);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.logo}>murmur</div>

        {state === "loading" && (
          <div className={styles.content}>
            <div className={styles.spinner} />
            <p>Accepting invite...</p>
          </div>
        )}

        {state === "success" && (
          <div className={styles.content}>
            <div className={styles.icon}>✓</div>
            <h1 className={styles.title}>You're in!</h1>
            <p className={styles.subtitle}>
              You've successfully joined the team.
            </p>
            <button className={styles.btn} onClick={() => navigate("/")}>
              Go to dashboard
            </button>
          </div>
        )}

        {state === "error" && (
          <div className={styles.content}>
            <div className={styles.iconError}>✕</div>
            <h1 className={styles.title}>Invite failed</h1>
            <p className={styles.subtitle}>{errorMessage}</p>
            <button className={styles.btn} onClick={() => navigate("/")}>
              Go to dashboard
            </button>
          </div>
        )}

        {state === "unauthenticated" && (
          <div className={styles.content}>
            <h1 className={styles.title}>Sign in first</h1>
            <p className={styles.subtitle}>
              You need to be signed in to accept this invite.
            </p>
            <button
              className={styles.btn}
              onClick={() => navigate(`/login?redirect=/invite/${token}`)}
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
