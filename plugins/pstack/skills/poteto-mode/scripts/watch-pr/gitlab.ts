// GitLab reader: shells to `glab` and queries GitLab's GraphQL API
// (`glab api graphql`). Implements the same T.GitHubReader contract as
// github.ts's GhGitHubReader — the interface keeps its historical name
// (renaming it would ripple through cli.ts/policy.ts for no behavior
// change), but nothing in it is GitHub-specific.
//
// GitLab's `detailedMergeStatus` is a single enum that already states
// *why* a merge request can't merge (CONFLICT, CI_MUST_PASS, NOT_APPROVED,
// DRAFT_STATUS, ...), unlike GitHub's `mergeStateStatus: BLOCKED`, which is
// ambiguous on its own and needs policy.ts's assessGitHubMerge to
// cross-check the commit rollup before deciding whether it's a real
// blocker. GitLab doesn't have that ambiguity, so this reader never
// produces `mergeStateStatus: "BLOCKED"` — every GitLab-specific reason is
// resolved directly into the conflict/review/draft/CI signals policy.ts
// already understands. A `detailedMergeStatus` value with no equivalent in
// this codebase's model (locked paths, Jira association, merge trains, ...)
// throws rather than silently reporting the merge request ready.
import type * as T from "./types.ts";
import { nonEmpty, parsePrNumber } from "./types.ts";
import {
  at,
  enumValue,
  list,
  missing,
  optionalString,
  record,
  run,
  runJson,
  string,
} from "./reader-utils.ts";
import { WatcherQueryError } from "./reader-utils.ts";

const MR_FACTS_QUERY =
  "query MrFacts($fullPath: ID!, $iid: String!) {\n  project(fullPath: $fullPath) {\n    mergeRequest(iid: $iid) {\n      state\n      draft\n      conflicts\n      approved\n      detailedMergeStatus\n      diffHeadSha\n      sourceBranch\n      targetBranch\n      mergedAt\n    }\n  }\n}\n";
const MR_PIPELINE_JOBS_QUERY =
  "query MrPipelineJobs($fullPath: ID!, $iid: String!, $after: String) {\n  project(fullPath: $fullPath) {\n    mergeRequest(iid: $iid) {\n      headPipeline {\n        jobs(after: $after) {\n          pageInfo { hasNextPage endCursor }\n          nodes {\n            name\n            status\n            allowFailure\n            webPath\n            stage { name }\n            detailedStatus { label detailsPath }\n          }\n        }\n      }\n    }\n  }\n}\n";
const MR_DISCUSSIONS_QUERY =
  "query MrDiscussions($fullPath: ID!, $iid: String!) {\n  project(fullPath: $fullPath) {\n    mergeRequest(iid: $iid) {\n      discussions(first: 100) {\n        nodes {\n          id\n          resolvable\n          resolved\n          notes(first: 1) {\n            nodes {\n              body\n              createdAt\n              author { username }\n              position { newPath newLine oldPath oldLine }\n            }\n          }\n        }\n      }\n    }\n  }\n}\n";
const MR_PIPELINES_QUERY =
  "query MrPipelines($fullPath: ID!, $iid: String!) {\n  project(fullPath: $fullPath) {\n    mergeRequest(iid: $iid) {\n      pipelines(first: 50) {\n        nodes { sha status }\n      }\n    }\n  }\n}\n";
const OPEN_MRS_QUERY =
  "query OpenMrs($fullPath: ID!) {\n  project(fullPath: $fullPath) {\n    mergeRequests(state: opened, first: 100) {\n      nodes { iid sourceBranch targetBranch }\n    }\n  }\n}\n";

function fullPath(repository: T.Repository): string {
  return `${repository.owner}/${repository.repo}`;
}
function graphqlArgs(
  query: string,
  variables: Record<string, string | null>
): [string, ...string[]] {
  const argv: string[] = ["glab", "api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables))
    if (value !== null) argv.push("-f", `${key}=${value}`);
  return argv as [string, ...string[]];
}
function project(value: unknown): unknown {
  return at(value, ["data", "project"]);
}
function mergeRequestNode(value: unknown): Record<string, unknown> {
  return record(at(project(value), ["mergeRequest"]), "project.mergeRequest");
}

// GitLab web URLs are https://<host>/<group[/subgroup...]>/<project>/-/merge_requests/<iid>.
// The `/-/` marker separates the project's full path from everything after it,
// which is how nested groups are told apart from the fixed URL suffix.
function parseMrUrl(value: string): T.PrContext {
  const marker = "/-/merge_requests/";
  const markerIndex = value.indexOf(marker);
  try {
    const url = new URL(value);
    if (markerIndex === -1) throw new Error("no /-/merge_requests/ segment");
    const pathAndRest = url.pathname;
    const cut = pathAndRest.indexOf(marker);
    const projectPath = pathAndRest.slice(1, cut);
    const parts = projectPath.split("/").filter(Boolean);
    const numberPart = pathAndRest
      .slice(cut + marker.length)
      .split("/")
      .filter(Boolean)[0];
    if (parts.length < 2 || numberPart === undefined)
      throw new Error("could not split project path and MR number");
    return {
      owner: parts.slice(0, -1).join("/"),
      repo: parts[parts.length - 1],
      number: parsePrNumber(Number(numberPart)),
    };
  } catch (error) {
    throw new WatcherQueryError({
      kind: "invalid-context-url",
      retryable: false,
      rawValue: value,
      detail: `could not infer group/project from MR URL: ${value} (${error instanceof Error ? error.message : String(error)})`,
    });
  }
}
function parseRemote(value: string): T.Repository | null {
  let normalized = value.trim();
  const sshMatch = /^(?:ssh:\/\/)?git@([^:/]+)[:/](.+)$/.exec(normalized);
  if (sshMatch) normalized = `https://${sshMatch[1]}/${sshMatch[2]}`;
  try {
    const url = new URL(normalized);
    const parts = url.pathname
      .replace(/\.git$/, "")
      .split("/")
      .filter(Boolean);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      parts.length < 2
    )
      return null;
    return { owner: parts.slice(0, -1).join("/"), repo: parts[parts.length - 1] };
  } catch {
    return null;
  }
}

const MERGE_REQUEST_STATES = ["opened", "closed", "merged", "locked"] as const;
// GitLab's GraphQL DetailedMergeStatus enum is UPPER_SNAKE_CASE — distinct
// from the REST API's lowercase detailed_merge_status strings (e.g.
// "not_approved" vs NOT_APPROVED). This reader queries GraphQL, so these
// must match the GraphQL schema, not the REST docs' examples.
const DETAILED_MERGE_STATUSES = [
  "APPROVALS_SYNCING",
  "BLOCKED_STATUS",
  "CHECKING",
  "CI_MUST_PASS",
  "CI_STILL_RUNNING",
  "COMMITS_STATUS",
  "CONFLICT",
  "DISCUSSIONS_NOT_RESOLVED",
  "DRAFT_STATUS",
  "EXTERNAL_STATUS_CHECKS",
  "JIRA_ASSOCIATION",
  "LOCKED_LFS_FILES",
  "LOCKED_PATHS",
  "MERGEABLE",
  "MERGE_TIME",
  "NEED_REBASE",
  "NOT_APPROVED",
  "NOT_OPEN",
  "PREPARING",
  "REQUESTED_CHANGES",
  "SECURITY_POLICIES_VIOLATIONS",
  "SECURITY_POLICY_PIPELINE_CHECK",
  "TITLE_NOT_MATCHING",
  "UNCHECKED",
] as const;
const JOB_STATUSES = [
  "CANCELED",
  "CANCELING",
  "CREATED",
  "FAILED",
  "MANUAL",
  "PENDING",
  "PREPARING",
  "RUNNING",
  "SCHEDULED",
  "SKIPPED",
  "SUCCESS",
  "WAITING_FOR_CALLBACK",
  "WAITING_FOR_RESOURCE",
] as const;
const PIPELINE_STATUSES = [
  "CREATED",
  "WAITING_FOR_RESOURCE",
  "PREPARING",
  "WAITING_FOR_CALLBACK",
  "PENDING",
  "RUNNING",
  "FAILED",
  "SUCCESS",
  "CANCELED",
  "CANCELING",
  "SKIPPED",
  "MANUAL",
  "SCHEDULED",
] as const;

// Everything policy.ts needs (conflict, review gate, draft, CI) is already
// carried by dedicated fields elsewhere in PullRequestFacts/Check, so most
// detailedMergeStatus values map to a neutral mergeStateStatus here — they
// exist for the reader's own bookkeeping, not to duplicate the decision.
// A value with no equivalent signal anywhere in the model throws instead
// of reporting a false "clean".
function mapMergeState(
  detailedMergeStatus: string
): T.MergeStateStatus {
  const status = enumValue(
    detailedMergeStatus,
    DETAILED_MERGE_STATUSES,
    "mergeRequest.detailedMergeStatus"
  );
  switch (status) {
    case "CONFLICT":
    case "NEED_REBASE":
      return "CONFLICTING";
    case "UNCHECKED":
    case "CHECKING":
    case "PREPARING":
    case "APPROVALS_SYNCING":
      return "UNKNOWN";
    case "MERGEABLE":
    case "DRAFT_STATUS":
    case "NOT_APPROVED":
    case "REQUESTED_CHANGES":
    case "DISCUSSIONS_NOT_RESOLVED":
    case "CI_MUST_PASS":
    case "CI_STILL_RUNNING":
    case "COMMITS_STATUS":
    case "NOT_OPEN":
      return "CLEAN";
    default:
      throw new WatcherQueryError({
        kind: "unsupported-merge-status",
        retryable: false,
        rawValue: status,
        detail: `GitLab detailedMergeStatus "${status}" has no equivalent in this watcher's merge-gate model; extend gitlab.ts before trusting this merge request's readiness`,
      });
  }
}
function mapReviewDecision(
  detailedMergeStatus: string,
  approved: boolean
): T.ReviewDecision {
  if (detailedMergeStatus === "REQUESTED_CHANGES") return "CHANGES_REQUESTED";
  if (detailedMergeStatus === "NOT_APPROVED") return "REVIEW_REQUIRED";
  return approved ? "APPROVED" : "REVIEW_REQUIRED";
}
export function parsePullRequest(
  value: unknown,
  context: T.PrContext
): T.PullRequestFacts {
  const node = record(value, "mergeRequest");
  if (typeof node.draft !== "boolean") missing("mergeRequest.draft", node.draft);
  if (typeof node.conflicts !== "boolean")
    missing("mergeRequest.conflicts", node.conflicts);
  if (typeof node.approved !== "boolean")
    missing("mergeRequest.approved", node.approved);
  const detailedMergeStatus = string(
    node.detailedMergeStatus,
    "mergeRequest.detailedMergeStatus"
  );
  const state = enumValue(node.state, MERGE_REQUEST_STATES, "mergeRequest.state");
  return {
    context,
    mergeable: node.conflicts ? "CONFLICTING" : "MERGEABLE",
    mergeStateStatus: mapMergeState(detailedMergeStatus),
    reviewDecision: mapReviewDecision(detailedMergeStatus, node.approved),
    headRefOid: optionalString(node.diffHeadSha, "mergeRequest.diffHeadSha"),
    headRefName: string(node.sourceBranch, "mergeRequest.sourceBranch"),
    baseRefName: string(node.targetBranch, "mergeRequest.targetBranch"),
    state: state === "merged" ? "MERGED" : state === "closed" ? "CLOSED" : "OPEN",
    mergedAt: optionalString(node.mergedAt, "mergeRequest.mergedAt"),
    isDraft: node.draft,
  };
}
function jobCheck(value: unknown): T.Check {
  const object = record(value, "job");
  const status = enumValue(object.status, JOB_STATUSES, "job.status");
  const allowFailure =
    typeof object.allowFailure === "boolean" ? object.allowFailure : false;
  const detailedStatus = isRecordValue(object.detailedStatus)
    ? object.detailedStatus
    : {};
  const details = {
    name: string(object.name, "job.name"),
    description:
      typeof detailedStatus.label === "string" ? detailedStatus.label : "",
    link:
      typeof detailedStatus.detailsPath === "string"
        ? detailedStatus.detailsPath
        : typeof object.webPath === "string"
          ? object.webPath
          : "",
    workflow:
      isRecordValue(object.stage) && typeof object.stage.name === "string"
        ? object.stage.name
        : "",
  };
  if (status === "SUCCESS")
    return { ...details, kind: "passed", reportedState: status };
  if (status === "SKIPPED")
    return { ...details, kind: "skipped", reportedState: status };
  if (status === "FAILED")
    return allowFailure
      ? { ...details, kind: "skipped", reportedState: status }
      : { ...details, kind: "failed", reportedState: status };
  if (status === "CANCELED" || status === "CANCELING")
    return { ...details, kind: "failed", reportedState: status };
  return { ...details, kind: "pending", reportedState: status };
}
function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseReviewThreads(value: unknown): readonly T.ReviewThread[] {
  const nodes = list(
    at(mergeRequestNode(value), ["discussions", "nodes"]),
    "mergeRequest.discussions.nodes"
  );
  const threads: {
    readonly id: string;
    readonly firstComment: T.ReviewComment | null;
    readonly resolved: boolean;
  }[] = [];
  for (const raw of nodes) {
    const discussion = record(raw, "discussion");
    if (discussion.resolvable !== true) continue;
    if (typeof discussion.resolved !== "boolean")
      missing("discussion.resolved", discussion.resolved);
    const noteNodes = list(
      at(discussion, ["notes", "nodes"]),
      "discussion.notes.nodes"
    );
    const firstComment =
      noteNodes.length === 0 ? null : parseNote(noteNodes[0]);
    threads.push({
      id: string(discussion.id, "discussion.id"),
      firstComment,
      resolved: discussion.resolved,
    });
  }
  const keys = new Set<string>();
  let keyless = false;
  for (const thread of threads) {
    if (!isBugbot(thread.firstComment)) continue;
    const key = passKey(thread.firstComment);
    if (key === null) keyless = true;
    else keys.add(key);
  }
  const passes = keys.size > 0 ? keys.size : keyless ? 1 : 0;
  return threads
    .filter((thread) => !thread.resolved)
    .map(({ id, firstComment }) => ({
      id,
      firstComment,
      isBugbot: isBugbot(firstComment),
      bugbotReviewPasses: passes,
    }));
}
function parseNote(value: unknown): T.ReviewComment {
  const object = record(value, "note");
  const author = isRecordValue(object.author) ? object.author : null;
  const position = isRecordValue(object.position) ? object.position : null;
  const path =
    position === null
      ? null
      : typeof position.newPath === "string"
        ? position.newPath
        : typeof position.oldPath === "string"
          ? position.oldPath
          : null;
  const line =
    position === null
      ? null
      : typeof position.newLine === "number"
        ? position.newLine
        : typeof position.oldLine === "number"
          ? position.oldLine
          : null;
  return {
    authorLogin:
      author !== null && typeof author.username === "string"
        ? author.username
        : null,
    body: string(object.body, "note.body"),
    path,
    line,
    createdAt: string(object.createdAt, "note.createdAt"),
  };
}
// Same detection convention as github.ts's isBugbot/passKey: content-based,
// not by a fixed account name, so it works with whatever automated
// reviewer a GitLab project uses.
function isBugbot(comment: T.ReviewComment | null): boolean {
  if (comment === null) return false;
  const author = (comment.authorLogin ?? "").toLowerCase();
  const body = comment.body.toLowerCase();
  return (
    author.includes("bugbot") ||
    ["bugbot", "agentic security review", "description start", "severity"].some(
      (token) => body.includes(token)
    )
  );
}
function passKey(comment: T.ReviewComment | null): string | null {
  if (comment === null) return null;
  const match = /RUN_ID:\s*([a-zA-Z0-9_.:-]+)/.exec(comment.body);
  return match?.[1] ?? null;
}
export function parseRollupPage(value: unknown): T.RollupPage {
  const pipeline = at(mergeRequestNode(value), ["headPipeline"]);
  if (pipeline === null) return { checks: [], endCursor: null };
  const jobs = record(at(pipeline, ["jobs"]), "headPipeline.jobs");
  const checks = list(jobs.nodes, "headPipeline.jobs.nodes").map(jobCheck);
  const pageInfo = record(jobs.pageInfo, "headPipeline.jobs.pageInfo");
  if (typeof pageInfo.hasNextPage !== "boolean")
    missing("headPipeline.jobs.pageInfo.hasNextPage", pageInfo.hasNextPage);
  const cursor = optionalString(
    pageInfo.endCursor,
    "headPipeline.jobs.pageInfo.endCursor"
  );
  return { checks, endCursor: pageInfo.hasNextPage && cursor ? cursor : null };
}
export function parseCommitRollups(value: unknown): readonly T.CommitRollup[] {
  const nodes = list(
    at(mergeRequestNode(value), ["pipelines", "nodes"]),
    "mergeRequest.pipelines.nodes"
  );
  return nodes.map((item, index) => {
    const object = record(item, `pipelines[${index}]`);
    const status = enumValue(
      object.status,
      PIPELINE_STATUSES,
      `pipelines[${index}].status`
    );
    const state: T.RollupState =
      status === "SUCCESS"
        ? "SUCCESS"
        : status === "FAILED" || status === "CANCELED"
          ? "FAILURE"
          : status === "SKIPPED"
            ? null
            : "PENDING";
    return { oid: string(object.sha, `pipelines[${index}].sha`), state };
  });
}
export function parseOpenMergeRequests(
  value: unknown
): readonly T.OpenPullRequest[] {
  const nodes = list(
    at(project(value), ["mergeRequests", "nodes"]),
    "project.mergeRequests.nodes"
  );
  return nodes.map((item, index) => {
    const object = record(item, `mergeRequests[${index}]`);
    return {
      number: parsePrNumber(
        Number(string(object.iid, `mergeRequests[${index}].iid`)),
        `mergeRequests[${index}].iid`
      ),
      headRefName: string(
        object.sourceBranch,
        `mergeRequests[${index}].sourceBranch`
      ),
      baseRefName: string(
        object.targetBranch,
        `mergeRequests[${index}].targetBranch`
      ),
    };
  });
}

export class GlabGitLabReader implements T.GitHubReader {
  async originRepo(): Promise<T.Repository | null> {
    const result = await run(["git", "remote", "get-url", "origin"]);
    return result.code === 0 ? parseRemote(result.stdout) : null;
  }
  async currentPr(pr: T.PrNumber | null): Promise<T.PrContext> {
    const argv: [string, ...string[]] = ["glab", "mr", "view"];
    if (pr !== null) argv.push(String(pr));
    argv.push("--output", "json");
    const object = record(await runJson(argv), "current MR");
    const parsed = parseMrUrl(string(object.web_url, "current MR.web_url"));
    return {
      ...parsed,
      number: pr ?? parsePrNumber(Number(object.iid), "current MR.iid"),
    };
  }
  async pullRequest(context: T.PrContext): Promise<T.PullRequestFacts> {
    return parsePullRequest(
      mergeRequestNode(
        await runJson(
          graphqlArgs(MR_FACTS_QUERY, {
            fullPath: fullPath(context),
            iid: String(context.number),
          })
        )
      ),
      context
    );
  }
  async openPullRequests(
    repository: T.Repository
  ): Promise<readonly T.OpenPullRequest[]> {
    return parseOpenMergeRequests(
      await runJson(
        graphqlArgs(OPEN_MRS_QUERY, { fullPath: fullPath(repository) })
      )
    );
  }
  async checksFastPath(_context: T.PrContext): Promise<T.ChecksFastPath> {
    return {
      kind: "unusable",
      exitCode: -1,
      stderr:
        "GitLab reader has no CLI fast path for checks; always uses the GraphQL pipeline-jobs rollup",
    };
  }
  async checkRollupPage(
    context: T.PrContext,
    after: string | null
  ): Promise<T.RollupPage> {
    return parseRollupPage(
      await runJson(
        graphqlArgs(MR_PIPELINE_JOBS_QUERY, {
          fullPath: fullPath(context),
          iid: String(context.number),
          after,
        })
      )
    );
  }
  async reviewThreads(
    context: T.PrContext
  ): Promise<readonly T.ReviewThread[]> {
    return parseReviewThreads(
      await runJson(
        graphqlArgs(MR_DISCUSSIONS_QUERY, {
          fullPath: fullPath(context),
          iid: String(context.number),
        })
      )
    );
  }
  async commitRollups(
    context: T.PrContext
  ): Promise<readonly T.CommitRollup[]> {
    return parseCommitRollups(
      await runJson(
        graphqlArgs(MR_PIPELINES_QUERY, {
          fullPath: fullPath(context),
          iid: String(context.number),
        })
      )
    );
  }
}
