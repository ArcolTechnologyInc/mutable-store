import { Room } from "@liveblocks/client";
import { ProjectStore } from "./project";
import { UndoHistory } from "./undoRedo";

const global = {} as {
  room: Room;
  project: ProjectStore;
  undoTracker: UndoHistory;
}

export function getGlobal() {
  return global;
}
