// bb-plugin-attention — "Needs attention" homepage section.
//
// Renders a glanceable list of the top threads wanting the user (errors first,
// then pending interactions, then unread finished turns). Clicking a row opens
// the thread. Refreshes on mount and whenever the backend publishes an
// attention-changed realtime signal (thread.idle / thread.failed).
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  definePluginApp,
  useBbNavigate,
  useRealtime,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import "./app.css";

type Contract = typeof rpcContract;
type AttentionItem = {
  threadId: string;
  projectId: string;
  title: string;
  kind: "error" | "interaction" | "unread";
  label: string;
  detail?: string;
  attentionAt: number;
  updatedAt: number;
};

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const KIND_LABEL: Record<AttentionItem["kind"], string> = {
  error: "Error",
  interaction: "Needs input",
  unread: "Unread",
};

function AttentionRow({
  item,
  onOpen,
}: {
  item: AttentionItem;
  onOpen: (threadId: string) => void;
}) {
  return (
    <button
      type="button"
      className="attention-row"
      onClick={() => onOpen(item.threadId)}
    >
      <span className={`attention-badge attention-badge-${item.kind}`}>
        {KIND_LABEL[item.kind]}
      </span>
      <span className="attention-row-body">
        <span className="attention-row-title">{item.title}</span>
        {item.detail ? (
          <span className="attention-row-detail">{item.detail}</span>
        ) : null}
      </span>
      <span className="attention-row-meta" title={item.label}>
        <span className="attention-row-label">{item.label}</span>
        <span className="attention-row-time">
          {relativeTime(item.attentionAt)}
        </span>
      </span>
    </button>
  );
}

function AttentionHome({ projectId }: { projectId: string | null }) {
  const rpc = useRpc<Contract>();
  const navigate = useBbNavigate();
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setBusy(true);
    setError(null);
    void rpc
      .call("attention", { projectId })
      .then((value) => {
        setItems(value.items as AttentionItem[]);
        setTotal(value.total);
      })
      .catch(() => setError("Could not load attention threads"))
      .finally(() => setBusy(false));
  }, [rpc, projectId]);

  useEffect(refresh, [refresh]);
  useRealtime("attention-changed", refresh);

  const open = useCallback(
    (threadId: string) => navigate.toThread(threadId),
    [navigate],
  );

  const shownTotal = items === null ? 0 : total;
  const footer = useMemo(() => {
    if (items === null || items.length === 0) return null;
    return shownTotal > items.length
      ? `Showing top ${items.length} of ${shownTotal} threads`
      : null;
  }, [items, shownTotal]);

  return (
    <div className="attention-wrap">
      <div className="attention-toolbar">
        <div>
          <h1>Needs attention</h1>
          <p>
            {items === null
              ? "Scanning threads…"
              : items.length === 0
                ? "Everything is quiet."
                : "Threads waiting on you."}
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error ? <p className="attention-error">{error}</p> : null}
      {items === null ? null : items.length === 0 ? (
        <p className="attention-empty">Nothing needs your attention right now.</p>
      ) : (
        <div className="attention-list">
          {items.map((item) => (
            <AttentionRow key={item.threadId} item={item} onOpen={open} />
          ))}
        </div>
      )}
      {footer ? <p className="attention-footer">{footer}</p> : null}
    </div>
  );
}

// Section id "attention" sorts before "daily-ops", so this renders above the
// daily ops homepage section (the client renders sections in plugin-id order).
export default definePluginApp((app) => {
  app.slots.homepageSection({
    id: "attention",
    title: "Needs attention",
    component: AttentionHome,
  });
});