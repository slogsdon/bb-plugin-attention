// bb-plugin-attention — "Needs attention" homepage section.
//
// Snapshot of every visible thread that wants the user: an error state, a
// pending interaction (approval / question / plugin form), or a finished
// turn bb itself considers unread (latestAttentionAt > lastReadAt). Ranked
// error > interaction > unread, most recently attended first, capped at ten.
//
// The section id "attention" sorts before "daily-ops", so this renders above
// the daily ops homepage section (client renders sections in plugin-id order).
import { defineRpcContract, type BbPluginApi, type PluginThreadEventPayloads } from "@get-bb/plugin-sdk";
import { z } from "zod";

const attentionItem = z.object({
  threadId: z.string(),
  projectId: z.string(),
  title: z.string(),
  kind: z.enum(["error", "interaction", "unread"]),
  label: z.string(),
  detail: z.string().optional(),
  attentionAt: z.number(),
  updatedAt: z.number(),
});

export const rpcContract = defineRpcContract({
  attention: {
    input: z.object({ projectId: z.string().nullable() }).strict(),
    output: z.object({
      items: z.array(attentionItem),
      total: z.number().int(),
      generatedAt: z.number(),
    }),
  },
});

type ThreadDto = Awaited<ReturnType<BbPluginApi["sdk"]["threads"]["list"]>>[number];
type Interaction = Awaited<
  ReturnType<BbPluginApi["sdk"]["threads"]["interactions"]["list"]>
>[number];
type AttentionItem = z.output<typeof attentionItem>;

const MAX_ITEMS = 10;
const RANK = { error: 0, interaction: 1, unread: 2 } as const;
type Kind = keyof typeof RANK;

function threadTitle(thread: ThreadDto): string {
  return thread.title ?? thread.titleFallback ?? "Untitled thread";
}

function interactionMeta(interaction: Interaction): {
  label: string;
  detail?: string;
} {
  const payload = interaction.payload;
  if (payload.kind === "user_question") {
    const prompt = payload.questions[0]?.prompt ?? "Answer a question in bb";
    return { label: "Question for you", detail: prompt };
  }
  if (payload.kind === "plugin") {
    return { label: "Awaiting your input", detail: payload.title };
  }
  // provider approval
  const subject = payload.subject;
  if (subject.kind === "plan") {
    return {
      label: "Plan ready for review",
      detail: subject.planFilePath ?? "Approve or revise the plan.",
    };
  }
  if (subject.kind === "command") {
    return { label: "Needs approval", detail: subject.command };
  }
  if (subject.kind === "file_change") {
    return { label: "Needs approval", detail: subject.writeScope ?? "Edit files" };
  }
  return {
    label: "Needs approval",
    detail: subject.toolName ?? undefined,
  };
}

async function buildSnapshot(
  bb: BbPluginApi,
  projectId: string | null,
): Promise<z.output<(typeof rpcContract)["attention"]["output"]>> {
  const threads = await bb.sdk.threads.list({
    projectId: projectId ?? undefined,
    archived: false,
    limit: 500,
  });

  const items: AttentionItem[] = [];
  for (const thread of threads) {
    if (thread.visibility !== "visible") continue; // background workers stay hidden
    if (thread.archivedAt !== null || thread.deletedAt !== null) continue;

    let kind: Kind | null = null;
    let label = "";
    let detail: string | undefined;

    if (thread.status === "error" || thread.runtime.displayStatus === "error") {
      kind = "error";
      label = "Failed";
    } else if (thread.hasPendingInteraction) {
      try {
        const pending = (await bb.sdk.threads.interactions.list({
          threadId: thread.id,
        })).find((item) => item.status === "pending");
        if (pending) {
          kind = "interaction";
          const meta = interactionMeta(pending);
          label = meta.label;
          detail = meta.detail;
        }
      } catch (error) {
        bb.log.warn(
          `interactions lookup failed for ${thread.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else if (
      thread.status === "idle" &&
      thread.latestAttentionAt > (thread.lastReadAt ?? 0)
    ) {
      kind = "unread";
      label = "Turn finished — reply needed";
    }

    if (kind === null) continue;

    items.push({
      threadId: thread.id,
      projectId: thread.projectId,
      title: threadTitle(thread),
      kind,
      label,
      ...(detail ? { detail } : {}),
      attentionAt: thread.latestAttentionAt,
      updatedAt: thread.updatedAt,
    });
  }

  items.sort(
    (a, b) =>
      RANK[a.kind] - RANK[b.kind] || b.attentionAt - a.attentionAt,
  );

  return {
    items: items.slice(0, MAX_ITEMS),
    total: items.length,
    generatedAt: Date.now(),
  };
}

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("loaded");

  bb.rpc.register(rpcContract, {
    attention: ({ projectId }) => buildSnapshot(bb, projectId),
  });

  // Tell open homepages to refetch when a thread finishes or fails, so the
  // section updates live while the user sits on the new-thread screen.
  const changed = (
    payload:
      | PluginThreadEventPayloads["thread.idle"]
      | PluginThreadEventPayloads["thread.failed"],
  ) => {
    bb.realtime.publish("attention-changed", {
      threadId: payload.thread.id,
      status: payload.thread.status,
    });
  };
  bb.events.on("thread.idle", changed);
  bb.events.on("thread.failed", changed);

  bb.cli.register({
    name: "attention",
    summary: "List threads that need your attention (errors, pending input, unread turns)",
    commands: [
      {
        name: "list",
        summary: "Show the top attention threads",
        usage: "bb attention list [--project <projectId>]",
      },
    ],
    async run(argv) {
      const projectFlag = argv.find((arg) => arg.startsWith("--project"));
      const projectId = projectFlag
        ? projectFlag.replace(/^--project=?(\s*)/, "") || null
        : null;
      const snapshot = await buildSnapshot(bb, projectId);

      if (snapshot.items.length === 0) {
        return { exitCode: 0, stdout: "Nothing needs your attention." };
      }
      const lines = snapshot.items.map((item, index) => {
        const when = new Date(item.attentionAt).toLocaleString();
        const badge = item.kind.toUpperCase().padEnd(11);
        return `${index + 1}. [${badge}] ${item.title} (${when})${
          item.detail ? ` — ${item.detail}` : ""
        }`;
      });
      lines.push(
        `\n${snapshot.total} thread${snapshot.total === 1 ? "" : "s"} needing attention; showing top ${snapshot.items.length}.`,
      );
      return { exitCode: 0, stdout: lines.join("\n") };
    },
  });
}