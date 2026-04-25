interface Props {
  boardId: string;
  role: string;
}

export function BoardCanvas({ boardId, role }: Props) {
  return <canvas style={{ width: "100%", height: "100%" }} />;
}
