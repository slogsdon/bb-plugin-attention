// bb-plugin-runtime-shim:react
var runtime = globalThis.__bbPluginRuntime;
if (runtime == null || runtime.react == null) {
  throw new Error('Cannot load "react": this bundle must be loaded by the BB app, which provides the shared plugin runtime (globalThis.__bbPluginRuntime).');
}
var mod = runtime.react;
var {
  Activity,
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  act,
  cache,
  cacheSignal,
  captureOwnerStack,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  unstable_useCacheRefresh,
  use,
  useActionState,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version
} = mod;

// bb-plugin-runtime-shim:@get-bb/plugin-sdk/app
var runtime2 = globalThis.__bbPluginRuntime;
if (runtime2 == null || runtime2.pluginSdkApp == null) {
  throw new Error('Cannot load "@get-bb/plugin-sdk/app": this bundle must be loaded by the BB app, which provides the shared plugin runtime (globalThis.__bbPluginRuntime).');
}
var mod2 = runtime2.pluginSdkApp;
var {
  Markdown,
  ThreadChat,
  definePluginApp,
  experimental_NewThreadComposer,
  experimental_useSidebarThreadActions,
  experimental_useSidebarThreadPullRequest,
  experimental_useSidebarThreadSplit,
  experimental_useSidebarThreads,
  useBbContext,
  useBbNavigate,
  useComposer,
  useComposerView,
  useRealtime,
  useRealtimeConnectionState,
  useRpc,
  useSettings
} = mod2;

// bb-plugin-runtime-shim:react/jsx-runtime
var runtime3 = globalThis.__bbPluginRuntime;
if (runtime3 == null || runtime3.jsxRuntime == null) {
  throw new Error('Cannot load "react/jsx-runtime": this bundle must be loaded by the BB app, which provides the shared plugin runtime (globalThis.__bbPluginRuntime).');
}
var mod3 = runtime3.jsxRuntime;
var {
  Fragment: Fragment2,
  jsx,
  jsxs
} = mod3;

// app.tsx
function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1e3));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
var KIND_LABEL = {
  error: "Error",
  interaction: "Needs input",
  unread: "Unread"
};
function AttentionRow({
  item,
  onOpen
}) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      className: "attention-row",
      onClick: () => onOpen(item.threadId),
      children: [
        /* @__PURE__ */ jsx("span", { className: `attention-badge attention-badge-${item.kind}`, children: KIND_LABEL[item.kind] }),
        /* @__PURE__ */ jsxs("span", { className: "attention-row-body", children: [
          /* @__PURE__ */ jsx("span", { className: "attention-row-title", children: item.title }),
          item.detail ? /* @__PURE__ */ jsx("span", { className: "attention-row-detail", children: item.detail }) : null
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "attention-row-meta", title: item.label, children: [
          /* @__PURE__ */ jsx("span", { className: "attention-row-label", children: item.label }),
          /* @__PURE__ */ jsx("span", { className: "attention-row-time", children: relativeTime(item.attentionAt) })
        ] })
      ]
    }
  );
}
function AttentionHome({ projectId }) {
  const rpc = useRpc();
  const navigate = useBbNavigate();
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const refresh = useCallback(() => {
    setError(null);
    void rpc.call("attention", { projectId }).then((value) => {
      setItems(value.items);
      setTotal(value.total);
    }).catch(() => setError("Could not load attention threads"));
  }, [rpc, projectId]);
  useEffect(refresh, [refresh]);
  useRealtime("attention-changed", refresh);
  const open = useCallback(
    (threadId) => navigate.toThread(threadId),
    [navigate]
  );
  const shownTotal = items === null ? 0 : total;
  const footer = useMemo(() => {
    if (items === null || items.length === 0) return null;
    return shownTotal > items.length ? `Showing top ${items.length} of ${shownTotal} threads` : null;
  }, [items, shownTotal]);
  return /* @__PURE__ */ jsxs("div", { className: "attention-wrap", children: [
    error ? /* @__PURE__ */ jsx("p", { className: "attention-error", children: error }) : null,
    items === null ? null : items.length === 0 ? /* @__PURE__ */ jsx("p", { className: "attention-empty", children: "Nothing needs your attention right now." }) : /* @__PURE__ */ jsx("div", { className: "attention-list", children: items.map((item) => /* @__PURE__ */ jsx(AttentionRow, { item, onOpen: open }, item.threadId)) }),
    footer ? /* @__PURE__ */ jsx("p", { className: "attention-footer", children: footer }) : null
  ] });
}
var app_default = definePluginApp((app) => {
  app.slots.homepageSection({
    id: "attention",
    title: "Needs attention",
    component: AttentionHome
  });
});
export {
  app_default as default
};
