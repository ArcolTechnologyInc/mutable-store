import { Room } from "@liveblocks/client";
import { ProjectStore } from "./project";
import { UndoHistory } from "./undoRedo";
import { create } from "zustand";
import { ElementId } from "./fileFormat";

export type ElementSelection = {
  [id: ElementId]: boolean,
}

type AppState = {
  room: Room;
  project: ProjectStore;
  undoTracker: UndoHistory;
  selection: ElementSelection;
}

export const useAppState = create<AppState>(() => ({
  room: null as any,
  project: null as any,
  undoTracker: null as any,
  selection: {},
}));

export function getAppState() {
  return useAppState.getState();
}
