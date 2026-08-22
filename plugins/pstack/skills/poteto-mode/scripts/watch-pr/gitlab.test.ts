import { describe, expect, it } from "bun:test";
import {
  parseCommitRollups,
  parseOpenMergeRequests,
  parsePullRequest,
  parseReviewThreads,
  parseRollupPage,
} from "./gitlab.ts";
import { WatcherQueryError } from "./reader-utils.ts";
import { parsePrNumber } from "./types.ts";

const context = {
  owner: "group/subgroup",
  repo: "repo",
  number: parsePrNumber(42),
};

const rawMergeRequest = {
  state: "opened",
  draft: false,
  conflicts: false,
  approved: true,
  detailedMergeStatus: "MERGEABLE",
  diffHeadSha: "head",
  sourceBranch: "feature",
  targetBranch: "main",
  mergedAt: null,
};

describe("merge status mapping", () => {
  it("maps a clean, approved MR to CLEAN/APPROVED", () => {
    const facts = parsePullRequest(rawMergeRequest, context);
    expect(facts.mergeStateStatus).toBe("CLEAN");
    expect(facts.reviewDecision).toBe("APPROVED");
    expect(facts.mergeable).toBe("MERGEABLE");
  });

  it("maps conflicts to CONFLICTING mergeable and mergeStateStatus", () => {
    const facts = parsePullRequest(
      { ...rawMergeRequest, conflicts: true, detailedMergeStatus: "CONFLICT" },
      context
    );
    expect(facts.mergeable).toBe("CONFLICTING");
    expect(facts.mergeStateStatus).toBe("CONFLICTING");
  });

  it("maps NEED_REBASE to CONFLICTING like an unresolvable conflict", () => {
    expect(
      parsePullRequest(
        { ...rawMergeRequest, detailedMergeStatus: "NEED_REBASE" },
        context
      ).mergeStateStatus
    ).toBe("CONFLICTING");
  });

  it("maps NOT_APPROVED to REVIEW_REQUIRED, matching GitHub's non-blocking treatment", () => {
    const facts = parsePullRequest(
      {
        ...rawMergeRequest,
        approved: false,
        detailedMergeStatus: "NOT_APPROVED",
      },
      context
    );
    expect(facts.reviewDecision).toBe("REVIEW_REQUIRED");
    expect(facts.mergeStateStatus).toBe("CLEAN");
  });

  it("maps REQUESTED_CHANGES to CHANGES_REQUESTED, which policy.ts gates on", () => {
    expect(
      parsePullRequest(
        {
          ...rawMergeRequest,
          approved: false,
          detailedMergeStatus: "REQUESTED_CHANGES",
        },
        context
      ).reviewDecision
    ).toBe("CHANGES_REQUESTED");
  });

  it("maps transient statuses to UNKNOWN rather than a false CLEAN", () => {
    for (const status of ["UNCHECKED", "CHECKING", "PREPARING", "APPROVALS_SYNCING"])
      expect(
        parsePullRequest(
          { ...rawMergeRequest, detailedMergeStatus: status },
          context
        ).mergeStateStatus
      ).toBe("UNKNOWN");
  });

  it("fails closed on a detailedMergeStatus with no modeled equivalent", () => {
    try {
      parsePullRequest(
        { ...rawMergeRequest, detailedMergeStatus: "JIRA_ASSOCIATION" },
        context
      );
      throw new Error("expected parsePullRequest to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WatcherQueryError);
      if (!(error instanceof WatcherQueryError)) throw error;
      expect(error.failure).toMatchObject({
        kind: "unsupported-merge-status",
        retryable: false,
        rawValue: "JIRA_ASSOCIATION",
      });
    }
  });

  it("maps merged/closed state distinctly from opened", () => {
    expect(
      parsePullRequest({ ...rawMergeRequest, state: "merged" }, context).state
    ).toBe("MERGED");
    expect(
      parsePullRequest({ ...rawMergeRequest, state: "closed" }, context).state
    ).toBe("CLOSED");
    expect(
      parsePullRequest({ ...rawMergeRequest, state: "locked" }, context).state
    ).toBe("OPEN");
  });
});

describe("pipeline job to Check mapping", () => {
  const jobsResponse = (jobs: readonly Record<string, unknown>[]) => ({
    data: {
      project: {
        mergeRequest: {
          headPipeline: {
            jobs: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: jobs,
            },
          },
        },
      },
    },
  });
  const job = (overrides: Record<string, unknown>) => ({
    name: "test",
    status: "SUCCESS",
    allowFailure: false,
    webPath: "/pipelines/1/jobs/1",
    stage: { name: "test" },
    detailedStatus: { label: "passed", detailsPath: "/jobs/1" },
    ...overrides,
  });

  it("maps SUCCESS to passed and FAILED to failed", () => {
    const page = parseRollupPage(
      jobsResponse([job({ status: "SUCCESS" }), job({ status: "FAILED" })])
    );
    expect(page.checks.map((c) => c.kind)).toEqual(["passed", "failed"]);
  });

  it("treats an allow_failure FAILED job as skipped, not failed", () => {
    const page = parseRollupPage(
      jobsResponse([job({ status: "FAILED", allowFailure: true })])
    );
    expect(page.checks[0].kind).toBe("skipped");
  });

  it("maps CANCELED to failed and non-terminal statuses to pending", () => {
    const page = parseRollupPage(
      jobsResponse([
        job({ status: "CANCELED" }),
        job({ status: "RUNNING" }),
        job({ status: "MANUAL" }),
      ])
    );
    expect(page.checks.map((c) => c.kind)).toEqual([
      "failed",
      "pending",
      "pending",
    ]);
  });

  it("returns an empty page when there is no head pipeline yet", () => {
    const page = parseRollupPage({
      data: { project: { mergeRequest: { headPipeline: null } } },
    });
    expect(page.checks).toEqual([]);
    expect(page.endCursor).toBeNull();
  });
});

describe("commit rollups from MR pipeline history", () => {
  it("maps pipeline statuses to RollupState", () => {
    const rollups = parseCommitRollups({
      data: {
        project: {
          mergeRequest: {
            pipelines: {
              nodes: [
                { sha: "a", status: "SUCCESS" },
                { sha: "b", status: "FAILED" },
                { sha: "c", status: "SKIPPED" },
                { sha: "d", status: "RUNNING" },
              ],
            },
          },
        },
      },
    });
    expect(rollups).toEqual([
      { oid: "a", state: "SUCCESS" },
      { oid: "b", state: "FAILURE" },
      { oid: "c", state: null },
      { oid: "d", state: "PENDING" },
    ]);
  });
});

describe("discussions to review threads", () => {
  const discussionsResponse = (nodes: readonly Record<string, unknown>[]) => ({
    data: { project: { mergeRequest: { discussions: { nodes } } } },
  });
  const note = (overrides: Record<string, unknown>) => ({
    body: "a comment",
    createdAt: "now",
    author: { username: "reviewer" },
    position: null,
    ...overrides,
  });

  it("excludes non-resolvable discussions and unresolved-filters the rest", () => {
    const threads = parseReviewThreads(
      discussionsResponse([
        {
          id: "general-note",
          resolvable: false,
          resolved: false,
          notes: { nodes: [note({})] },
        },
        {
          id: "open-thread",
          resolvable: true,
          resolved: false,
          notes: { nodes: [note({})] },
        },
        {
          id: "resolved-thread",
          resolvable: true,
          resolved: true,
          notes: { nodes: [note({})] },
        },
      ])
    );
    expect(threads.map((t) => t.id)).toEqual(["open-thread"]);
  });

  it("counts distinct bugbot RUN_IDs across resolved and unresolved threads", () => {
    const threads = parseReviewThreads(
      discussionsResponse([
        {
          id: "one",
          resolvable: true,
          resolved: false,
          notes: {
            nodes: [note({ body: "RUN_ID: run-1", author: { username: "bugbot" } })],
          },
        },
        {
          id: "two",
          resolvable: true,
          resolved: true,
          notes: {
            nodes: [note({ body: "RUN_ID: run-2 severity high" })],
          },
        },
      ])
    );
    expect(threads).toHaveLength(1);
    expect(threads[0].isBugbot).toBe(true);
    expect(threads[0].bugbotReviewPasses).toBe(2);
  });

  it("reads diff position path and line, falling back to the old side", () => {
    const threads = parseReviewThreads(
      discussionsResponse([
        {
          id: "diff-note",
          resolvable: true,
          resolved: false,
          notes: {
            nodes: [
              note({
                position: {
                  newPath: "a.ts",
                  newLine: 10,
                  oldPath: null,
                  oldLine: null,
                },
              }),
            ],
          },
        },
      ])
    );
    expect(threads[0].firstComment).toMatchObject({ path: "a.ts", line: 10 });
  });
});

describe("open merge requests", () => {
  it("parses iid as a number from GraphQL's String iid field", () => {
    const open = parseOpenMergeRequests({
      data: {
        project: {
          mergeRequests: {
            nodes: [
              { iid: "7", sourceBranch: "feature", targetBranch: "main" },
            ],
          },
        },
      },
    });
    expect(open).toEqual([
      { number: parsePrNumber(7), headRefName: "feature", baseRefName: "main" },
    ]);
  });
});
