export interface LinearIssue {
  identifier: string;
  title: string;
  state: { name: string };
  assignee?: { displayName: string; isMe: boolean } | null;
  url?: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LbranchConfig {
  teamId: string;
  teamKey: string;
}

export type Mode =
  | { type: "interactive" }
  | { type: "direct"; issueId: string }
  | { type: "search"; query: string }
  | { type: "create"; title?: string }
  | { type: "auto"; arg?: string };
