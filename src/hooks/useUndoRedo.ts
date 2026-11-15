import { useCallback, useEffect, useRef, useState } from "react";

export type UndoEntry = { label: string; undo: () => Promise<void>; redo: () => Promise<void> };

function isTextTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Histórico de edições reversíveis da tela atual (apenas do próprio usuário, nesta sessão). */
export function useUndoRedo(limit = 50) {
  const [past, setPast] = useState<UndoEntry[]>([]);
  const [future, setFuture] = useState<UndoEntry[]>([]);
  const busy = useRef(false);
  const push = useCallback((e: UndoEntry) => { setPast((p) => [...p.slice(-limit + 1), e]); setFuture([]); }, [limit]);
  const undo = useCallback(async () => {
    const e = past[past.length - 1]; if (!e || busy.current) return;
    busy.current = true;
    try { await e.undo(); setPast((p) => p.slice(0, -1)); setFuture((f) => [...f, e]); } finally { busy.current = false; }
  }, [past]);
  const redo = useCallback(async () => {
    const e = future[future.length - 1]; if (!e || busy.current) return;
    busy.current = true;
    try { await e.redo(); setFuture((f) => f.slice(0, -1)); setPast((p) => [...p, e]); } finally { busy.current = false; }
  }, [future]);
  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      if (!(ev.ctrlKey || ev.metaKey) || isTextTarget(ev.target)) return; // preserva o Ctrl+Z nativo dos campos
      const k = ev.key.toLowerCase();
      if (k === "z" && !ev.shiftKey) { ev.preventDefault(); undo().catch(() => {}); }
      else if (k === "y" || (k === "z" && ev.shiftKey)) { ev.preventDefault(); redo().catch(() => {}); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);
  return { push, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0, nextUndo: past[past.length - 1]?.label, nextRedo: future[future.length - 1]?.label };
}
