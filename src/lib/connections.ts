import { newArrow, type Arrow, type Snapshot } from "./model";

export type Connection = {
  sourceId: string;
  targetId: string;
  arrow: Arrow;
  back: Arrow | null;
  status: "complete" | "pending" | "hidden" | "invalid";
};
export type ConnectionFlow =
  | { step: "destination"; sourceId: string; targetId: string; marker: Arrow }
  | {
      step: "return" | "review";
      sourceId: string;
      targetId: string;
      arrowId: string;
      back: Arrow | null;
    }
  | {
      step: "done";
      sourceId: string;
      targetId: string;
      arrowId: string;
      backId: string;
    };

/** Read legacy reciprocal arrows without rewriting any existing coordinates. */
export function counterpart(
  snapshot: Snapshot,
  sourceId: string,
  arrowId: string,
): Arrow | null {
  const source = snapshot.scenes.find((s) => s.id === sourceId);
  const arrow = source?.links.find((a) => a.id === arrowId);
  const target = snapshot.scenes.find((s) => s.id === arrow?.to);
  if (!source || !arrow || !target || source.id === target.id) return null;
  const reverse = target.links.filter(
    (a) => a.to === sourceId && a.id !== arrowId,
  );
  const paired = reverse.filter(
    (a) => !!arrow.pairId && a.pairId === arrow.pairId,
  );
  if (paired.length === 1) return paired[0]!;
  // Never take an arrow belonging to a different connection. An unambiguous
  // legacy reverse can be paired only when the administrator confirms it.
  const unpaired = reverse.filter((a) => !a.pairId);
  return unpaired.length === 1 &&
    source.links.filter((a) => a.to === target.id).length === 1
    ? unpaired[0]!
    : null;
}

export function connections(snapshot: Snapshot): Connection[] {
  const visited = new Set<string>();
  const rows: Connection[] = [];
  for (const source of snapshot.scenes)
    for (const arrow of source.links) {
      if (visited.has(arrow.id)) continue;
      const target = snapshot.scenes.find((s) => s.id === arrow.to);
      const candidate = counterpart(snapshot, source.id, arrow.id);
      const back = candidate && !visited.has(candidate.id) ? candidate : null;
      visited.add(arrow.id);
      if (back) visited.add(back.id);
      rows.push({
        sourceId: source.id,
        targetId: arrow.to,
        arrow,
        back,
        status:
          !target || target.id === source.id
            ? "invalid"
            : back
              ? arrow.pairId !== back.pairId
                ? "pending"
                : arrow.visible && back.visible
                  ? "complete"
                  : "hidden"
              : "pending",
      });
    }
  return rows;
}

export function confirmDestination(
  snapshot: Snapshot,
  sourceId: string,
  targetId: string,
  marker: Arrow,
) {
  const source = snapshot.scenes.find((s) => s.id === sourceId);
  if (
    !source ||
    !snapshot.scenes.some((s) => s.id === targetId) ||
    sourceId === targetId
  )
    throw new Error("Escolha outro ambiente deste projeto.");
  // Reopening an existing path is editing, never an implicit duplicate.
  const existing =
    source.links.find((a) => a.to === targetId && a.visible) ??
    source.links.find((a) => a.to === targetId);
  if (existing) return { snapshot, arrow: existing, reused: true };
  const arrow = {
    ...marker,
    to: targetId,
    label: "",
    pairId: crypto.randomUUID(),
  };
  return {
    snapshot: {
      ...snapshot,
      scenes: snapshot.scenes.map((s) =>
        s.id === sourceId ? { ...s, links: [...s.links, arrow] } : s,
      ),
    },
    arrow,
    reused: false,
  };
}

export function positionReturn(
  snapshot: Snapshot,
  sourceId: string,
  arrowId: string,
  position: Pick<Arrow, "yaw" | "pitch">,
  newId?: string,
) {
  const source = snapshot.scenes.find((s) => s.id === sourceId);
  const outgoing = source?.links.find((a) => a.id === arrowId);
  const target = snapshot.scenes.find((s) => s.id === outgoing?.to);
  if (!outgoing || !target || target.id === sourceId)
    throw new Error("A conexão mudou. Selecione novamente a seta de ida.");
  if (
    !Number.isFinite(position.yaw) ||
    !Number.isFinite(position.pitch) ||
    position.yaw < -180 ||
    position.yaw > 180 ||
    position.pitch < -62 ||
    position.pitch > 80
  )
    throw new Error("Posicione a volta visualmente no panorama.");
  const existing = counterpart(snapshot, sourceId, arrowId);
  if (!existing && target.links.some((a) => a.to === sourceId))
    throw new Error(
      "Já existe uma volta que pertence a outra conexão ou está ambígua. Abra a seta correspondente para revisar; nenhuma duplicação foi criada.",
    );
  const pairId = outgoing.pairId || crypto.randomUUID();
  if (
    snapshot.scenes
      .flatMap((s) => s.links)
      .some(
        (a) => a.pairId === pairId && a.id !== arrowId && a.id !== existing?.id,
      )
  )
    throw new Error(
      "Este par tem setas inconsistentes. Revise as conexões antes de continuar.",
    );
  const back = { ...(existing ?? newArrow(sourceId)), ...position, pairId };
  if (!existing && newId) back.id = newId;
  return {
    back,
    snapshot: {
      ...snapshot,
      scenes: snapshot.scenes.map((s) =>
        s.id === sourceId
          ? {
              ...s,
              links: s.links.map((a) =>
                a.id === arrowId ? { ...a, pairId } : a,
              ),
            }
          : s.id === target.id
            ? {
                ...s,
                links: existing
                  ? s.links.map((a) => (a.id === existing.id ? back : a))
                  : [...s.links, back],
              }
            : s,
      ),
    },
  };
}

/** Preview only this path, without exposing or publishing the draft. */
export function connectionPreview(
  snapshot: Snapshot,
  sourceId: string,
  targetId: string,
): Snapshot {
  const ids = new Set([sourceId, targetId]);
  return {
    ...snapshot,
    firstSceneId: sourceId,
    scenes: snapshot.scenes
      .filter((s) => ids.has(s.id))
      .map((s) => ({ ...s, links: s.links.filter((a) => ids.has(a.to)) })),
  };
}
