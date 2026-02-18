/** Linear GraphQL API calls */

import type { LinearIssue, LinearTeam } from "./types.js";

let apiKey = "";

export function setApiKey(key: string): void {
  apiKey = key;
}

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}

async function linearQuery<T extends { data?: unknown; errors?: Array<{ message: string }> } = GraphQLResponse>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const body: Record<string, unknown> = { query };
  if (variables) {
    body.variables = variables;
  }

  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as T;

  if (json.errors?.length) {
    throw new Error(`Linear GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data) {
    throw new Error("Linear API returned no data");
  }

  return json;
}

export async function getTeams(): Promise<LinearTeam[]> {
  const result = await linearQuery<{
    data: { teams: { nodes: LinearTeam[] } };
  }>("{ teams { nodes { id name key } } }");
  return result.data.teams.nodes;
}

export async function getIssueById(id: string): Promise<LinearIssue | null> {
  const result = await linearQuery<{
    data: { issue: LinearIssue | null };
  }>(
    "query ($id: String!) { issue(id: $id) { identifier title state { name } assignee { displayName isMe } } }",
    { id },
  );
  return result.data.issue;
}

export async function searchIssues(query: string): Promise<LinearIssue[]> {
  const result = await linearQuery<{
    data: { searchIssues: { nodes: LinearIssue[] } };
  }>(
    "query ($q: String!) { searchIssues(term: $q, first: 10) { nodes { identifier title state { name } assignee { displayName isMe } } } }",
    { q: query },
  );
  return result.data.searchIssues.nodes;
}

export async function createIssue(
  title: string,
  teamId: string,
): Promise<{ identifier: string; title: string }> {
  const result = await linearQuery<{
    data: {
      issueCreate: {
        success: boolean;
        issue: { identifier: string; title: string };
      };
    };
  }>(
    "mutation ($title: String!, $teamId: String!) { issueCreate(input: { title: $title, teamId: $teamId }) { success issue { identifier title } } }",
    { title, teamId },
  );

  const issue = result.data.issueCreate.issue;
  if (!issue?.identifier) {
    throw new Error("Failed to create issue");
  }
  return issue;
}

export async function getViewerId(): Promise<string> {
  const result = await linearQuery<{
    data: { viewer: { id: string } };
  }>("{ viewer { id } }");
  return result.data.viewer.id;
}

export async function getInProgressStateId(issueId: string): Promise<string | null> {
  const result = await linearQuery<{
    data: {
      issue: {
        team: {
          states: {
            nodes: Array<{ id: string; name: string; type: string }>;
          };
        };
      };
    };
  }>(
    "query ($id: String!) { issue(id: $id) { team { states { nodes { id name type } } } } }",
    { id: issueId },
  );

  const states = result.data.issue.team.states.nodes;
  // Find "In Progress" by name first, then fall back to any started state with "progress" in the name
  const inProgress =
    states.find((s) => s.name === "In Progress") ??
    states.find((s) => s.type === "started" && /progress/i.test(s.name));
  return inProgress?.id ?? null;
}

export async function updateIssue(
  id: string,
  updates: { assigneeId?: string; stateId?: string },
): Promise<void> {
  await linearQuery(
    "mutation ($id: String!, $assigneeId: String, $stateId: String) { issueUpdate(id: $id, input: { assigneeId: $assigneeId, stateId: $stateId }) { success } }",
    { id, ...updates },
  );
}

export async function getIssueUrl(id: string): Promise<string | null> {
  const result = await linearQuery<{
    data: { issue: { url: string } | null };
  }>("query ($id: String!) { issue(id: $id) { url } }", { id });
  return result.data.issue?.url ?? null;
}

export async function getAssignedTodos(first: number): Promise<LinearIssue[]> {
  const result = await linearQuery<{
    data: {
      viewer: { assignedIssues: { nodes: LinearIssue[] } };
    };
  }>(
    `{ viewer { assignedIssues(first: ${first}, filter: { state: { type: { eq: "unstarted" } } }, orderBy: updatedAt) { nodes { identifier title state { name } } } } }`,
  );
  return result.data.viewer.assignedIssues.nodes;
}

export async function getRecentUnassigned(first: number): Promise<LinearIssue[]> {
  const result = await linearQuery<{
    data: { issues: { nodes: LinearIssue[] } };
  }>(
    `{ issues(first: ${first}, filter: { assignee: { null: true }, state: { type: { nin: ["completed", "canceled"] } } }, orderBy: createdAt) { nodes { identifier title state { name } } } }`,
  );
  return result.data.issues.nodes;
}

export async function getAllAssignedOpen(first: number): Promise<LinearIssue[]> {
  const result = await linearQuery<{
    data: {
      viewer: { assignedIssues: { nodes: LinearIssue[] } };
    };
  }>(
    `{ viewer { assignedIssues(first: ${first}, filter: { state: { type: { nin: ["completed", "canceled"] } } }) { nodes { identifier title state { name } } } } }`,
  );
  return result.data.viewer.assignedIssues.nodes;
}
