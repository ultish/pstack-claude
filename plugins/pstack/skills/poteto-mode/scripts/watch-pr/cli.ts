import { setTimeout as delay } from "node:timers/promises";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option,
} from "commander";
import {
  GhGitHubReader,
  WatcherQueryError,
  discoverStack,
  resolveContext,
} from "./github.ts";
import { GlabGitLabReader } from "./gitlab.ts";
import {
  runQueued,
  runSimple,
  statusQueryVerdict,
  verdictFactory,
  type WatchClock,
} from "./policy.ts";
import { run } from "./reader-utils.ts";
import { renderJson, renderPretty } from "./render.ts";
import type * as T from "./types.ts";
import { nonEmpty, parsePrNumber } from "./types.ts";
const githubPrUrl = (context: T.PrContext): string =>
  `https://github.com/${context.owner}/${context.repo}/pull/${context.number}`;
// Same ssh/https normalization as gitlab.ts's parseRemote, kept separate
// because this only needs the origin (protocol+host) for building MR
// links, not a parsed {owner, repo}.
function gitlabOrigin(remoteUrl: string): string {
  const sshMatch = /^(?:ssh:\/\/)?git@([^:/]+)[:/].+$/.exec(remoteUrl.trim());
  if (sshMatch) return `https://${sshMatch[1]}`;
  try {
    const url = new URL(remoteUrl.trim());
    return `${url.protocol}//${url.host}`;
  } catch {
    return "https://gitlab.com";
  }
}
async function commandExists(name: string): Promise<boolean> {
  try {
    await run([name, "--version"]);
    return true;
  } catch {
    return false;
  }
}
export interface HostSelection {
  readonly reader: T.GitHubReader;
  readonly prUrl: (context: T.PrContext) => string;
}
// Mirrors plugins/pstack/scripts/git-host.sh's detection order exactly
// (github.com in the remote → gh; otherwise glab if present; otherwise gh
// if present; otherwise stop rather than guess), reimplemented in TS so
// the watcher doesn't need to shell out to a bash script from within a
// bun-run tool to pick its reader.
export async function detectHost(): Promise<HostSelection> {
  const remote = await run(["git", "remote", "get-url", "origin"]);
  const remoteUrl = remote.code === 0 ? remote.stdout.trim() : "";
  if (remoteUrl.includes("github.com"))
    return { reader: new GhGitHubReader(), prUrl: githubPrUrl };
  if (await commandExists("glab")) {
    const origin = gitlabOrigin(remoteUrl);
    return {
      reader: new GlabGitLabReader(),
      prUrl: (context) =>
        `${origin}/${context.owner}/${context.repo}/-/merge_requests/${context.number}`,
    };
  }
  if (await commandExists("gh"))
    return { reader: new GhGitHubReader(), prUrl: githubPrUrl };
  throw new Error(
    `Could not detect a PR/MR host CLI. Remote: ${remoteUrl || "<none>"}. Neither gh nor glab is on PATH.`
  );
}
export interface CliOptions {
  readonly owner: string | null;
  readonly repo: string | null;
  readonly pr: T.PrNumber | null;
  readonly mode: T.WatchMode;
  readonly stackPrs: readonly T.PrNumber[];
  readonly statusOnly: boolean;
  readonly pretty: boolean;
  readonly polling: T.PollingOptions;
}
function positiveNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new InvalidArgumentError("must be greater than zero");
  return parsed;
}
function nonNegativeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new InvalidArgumentError("must be zero or greater");
  return parsed;
}
function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new InvalidArgumentError("must be a positive integer");
  return parsed;
}
function prNumber(value: string): T.PrNumber {
  try {
    return parsePrNumber(Number(value.replace(/^#/, "")));
  } catch {
    throw new InvalidArgumentError("must be a positive integer");
  }
}
function stackPrList(value: string): T.NonEmpty<T.PrNumber> {
  const numbers = value.split(",").map((part) => prNumber(part.trim()));
  if (new Set(numbers).size !== numbers.length)
    throw new InvalidArgumentError("contains a duplicate PR");
  const parsed = nonEmpty(numbers);
  if (parsed === null) throw new InvalidArgumentError("cannot be empty");
  return parsed;
}
interface RawOptions {
  readonly owner?: string;
  readonly repo?: string;
  readonly pr?: T.PrNumber;
  readonly stack: boolean;
  readonly queuedStack: boolean;
  readonly stackPrs?: T.NonEmpty<T.PrNumber>;
  readonly interval: number;
  readonly sweepInterval: number;
  readonly timeout: number;
  readonly maxQueryErrors: number;
  readonly statusOnly: boolean;
  readonly allowDraft: boolean;
  readonly pretty: boolean;
}
export function parseArgs(
  argv: readonly string[],
  io: Pick<CliRuntime, "stdout" | "stderr">
): CliOptions {
  const program = new Command("watch-pr")
    .description(
      "Watch one pull request, a connected stack, or an immutable queued stack.\nJSON (NDJSON while polling) is the default; --pretty renders human text."
    )
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
    .exitOverride()
    .option("--owner <owner>", "GitHub repository owner")
    .option("--repo <repo>", "GitHub repository name")
    .option("--pr <number>", "pull request number", prNumber)
    .addOption(
      new Option("--stack", "watch the connected open stack")
        .default(false)
        .conflicts("queuedStack")
    )
    .option(
      "--queued-stack",
      "watch the captured stack until all PRs merge",
      false
    )
    .option(
      "--stack-prs <n,...>",
      "frozen bottom-to-top queue (queued mode only)",
      stackPrList
    )
    .option("--interval <seconds>", "poll interval", positiveNumber, 60)
    .option(
      "--sweep-interval <seconds>",
      "whole-stack sweep interval",
      positiveNumber,
      300
    )
    .option(
      "--timeout <seconds>",
      "deadline; 0 disables it",
      nonNegativeNumber,
      0
    )
    .option(
      "--max-query-errors <count>",
      "consecutive query-error budget",
      positiveInteger,
      5
    )
    .option("--status-only", "print one status table and exit 0", false)
    .option("--allow-draft", "do not treat a draft as a merge gate", false)
    .option("--pretty", "render human text instead of JSON", false);
  program.parse(argv, { from: "user" });
  const raw = program.opts<RawOptions>();
  if (raw.stackPrs !== undefined && !raw.queuedStack)
    program.error("error: --stack-prs requires --queued-stack");
  return {
    owner: raw.owner ?? null,
    repo: raw.repo ?? null,
    pr: raw.pr ?? null,
    mode: raw.queuedStack ? "queued-stack" : raw.stack ? "stack" : "single",
    stackPrs: raw.stackPrs ?? [],
    statusOnly: raw.statusOnly,
    pretty: raw.pretty,
    polling: {
      interval: raw.interval,
      sweepInterval: raw.sweepInterval,
      timeout: raw.timeout,
      maxQueryErrors: raw.maxQueryErrors,
      allowDraft: raw.allowDraft,
    },
  };
}
export interface CliRuntime {
  readonly reader: T.GitHubReader;
  readonly prUrl: (context: T.PrContext) => string;
  readonly clock: WatchClock;
  readonly stdout: (value: string) => void;
  readonly stderr: (value: string) => void;
}
async function realRuntime(): Promise<CliRuntime> {
  const host = await detectHost();
  return {
    reader: host.reader,
    prUrl: host.prUrl,
    clock: {
      now: () => performance.now() / 1_000,
      observedAt: () => new Date().toISOString(),
      sleep: async (seconds) => {
        await delay(seconds * 1_000);
      },
    },
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  };
}
export async function main(
  argv: readonly string[],
  explicitRuntime?: CliRuntime
): Promise<number> {
  const runtime = explicitRuntime ?? (await realRuntime());
  let options: CliOptions;
  try {
    options = parseArgs(argv, runtime);
  } catch (error) {
    if (!(error instanceof CommanderError)) throw error;
    return error.exitCode === 0 ? 0 : 64;
  }
  const render = options.pretty ? renderPretty : renderJson;
  const emit = (verdict: T.ProgressVerdict): void =>
    runtime.stdout(render(verdict, runtime.prUrl));
  let contexts: T.NonEmpty<T.PrContext>;
  try {
    const seed = await resolveContext({
      reader: runtime.reader,
      owner: options.owner,
      repo: options.repo,
      pr: options.pr ?? options.stackPrs[0] ?? null,
    });
    contexts =
      nonEmpty(options.stackPrs.map((number) => ({ ...seed, number }))) ??
      (options.mode === "single"
        ? [seed]
        : await discoverStack(runtime.reader, seed));
  } catch (error) {
    if (!(error instanceof WatcherQueryError)) throw error;
    const verdict = statusQueryVerdict(
      verdictFactory(runtime.clock, options.mode),
      1,
      error.failure
    );
    runtime.stdout(render(verdict, runtime.prUrl));
    return verdict.exitCode;
  }
  const dependencies = { reader: runtime.reader, clock: runtime.clock, emit };
  const verdict =
    options.mode === "queued-stack" && !options.statusOnly
      ? await runQueued({ dependencies, contexts, options: options.polling })
      : await runSimple({
          dependencies,
          contexts,
          mode: options.mode,
          statusOnly: options.statusOnly,
          options: options.polling,
        });
  runtime.stdout(render(verdict, runtime.prUrl));
  return verdict.exitCode;
}
