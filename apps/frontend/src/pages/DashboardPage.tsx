import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeams, createTeam } from "../api/teams";
import { getBoards, createBoard } from "../api/boards";
import { logout } from "../api/auth";
import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newBoardName, setNewBoardName] = useState("");
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [showNewBoard, setShowNewBoard] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: getTeams,
  });

  const activeTeam =
    teams.find((t) => t.team.id === activeTeamId)?.team ??
    teams[0]?.team ??
    null;

  const { data: boards = [] } = useQuery({
    queryKey: ["boards", activeTeam?.id],
    queryFn: () => getBoards(activeTeam!.id),
    enabled: !!activeTeam,
  });

  const createTeamMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setActiveTeamId(team.id);
      setNewTeamName("");
      setShowNewTeam(false);
    },
  });

  const createBoardMutation = useMutation({
    mutationFn: createBoard,
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["boards", activeTeam?.id] });
      setNewBoardName("");
      setShowNewBoard(false);
      navigate(`/board/${board.id}`);
    },
  });

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.logo}>murmur</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>

        <div className={styles.sectionLabel}>Teams</div>

        <nav className={styles.teamList}>
          {teams.map(({ team }) => (
            <button
              key={team.id}
              className={`${styles.teamItem} ${
                activeTeam?.id === team.id ? styles.teamItemActive : ""
              }`}
              onClick={() => setActiveTeamId(team.id)}
            >
              <span className={styles.teamAvatar}>
                {team.name[0]?.toUpperCase()}
              </span>
              <span className={styles.teamName}>{team.name}</span>
            </button>
          ))}

          {showNewTeam ? (
            <form
              className={styles.inlineForm}
              onSubmit={(e) => {
                e.preventDefault();
                if (newTeamName.trim()) {
                  createTeamMutation.mutate({ name: newTeamName.trim() });
                }
              }}
            >
              <input
                autoFocus
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team name"
                className={styles.inlineInput}
              />
              <button type="submit" className={styles.inlineSubmit}>
                Add
              </button>
              <button
                type="button"
                className={styles.inlineCancel}
                onClick={() => setShowNewTeam(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              className={styles.newTeamBtn}
              onClick={() => setShowNewTeam(true)}
            >
              + New team
            </button>
          )}
        </nav>
      </aside>

      <main className={styles.main}>
        <div className={styles.mainHeader}>
          <h1 className={styles.teamTitle}>
            {activeTeam?.name ?? "Select a team"}
          </h1>
          {activeTeam && (
            <button
              className={styles.newBoardBtn}
              onClick={() => setShowNewBoard(true)}
            >
              + New board
            </button>
          )}
        </div>

        {showNewBoard && activeTeam && (
          <form
            className={styles.newBoardForm}
            onSubmit={(e) => {
              e.preventDefault();
              createBoardMutation.mutate({
                teamId: activeTeam.id,
                name: newBoardName.trim() || "Untitled board",
              });
            }}
          >
            <input
              autoFocus
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Board name"
              className={styles.newBoardInput}
            />
            <button type="submit" className={styles.newBoardSubmit}>
              Create
            </button>
            <button
              type="button"
              className={styles.newBoardCancel}
              onClick={() => setShowNewBoard(false)}
            >
              Cancel
            </button>
          </form>
        )}

        <div className={styles.boardGrid}>
          {boards.map((board) => (
            <button
              key={board.id}
              className={styles.boardCard}
              onClick={() => navigate(`/board/${board.id}`)}
            >
              <div className={styles.boardPreview} />
              <div className={styles.boardInfo}>
                <span className={styles.boardName}>{board.name}</span>
                <span className={styles.boardDate}>
                  {new Date(board.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))}

          {boards.length === 0 && activeTeam && (
            <div className={styles.empty}>
              No boards yet — create one to get started
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
