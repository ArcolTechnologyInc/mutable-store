import { Room } from "@liveblocks/client";
import { Project } from "./project";

const global = {} as {
  room: Room;
  project: Project;
}

export function getGlobal() {
  return global;
}
