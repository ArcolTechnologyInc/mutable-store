import * as React from "react";
import { createRoot } from "react-dom/client";

import { LiveMap, LiveObject, createClient } from "@liveblocks/client";
import { Project } from "./src/project";
import { ElementId, FileFormat } from "./src/fileFormat";
import { App } from "./src/ui/app";
import { getGlobal } from "./src/global";
import { generateKeyBetween } from "fractional-indexing";

async function init() {
  const client = createClient({
    // Rudi's personal account key, whatever if it gets leaked.
    publicApiKey: "pk_dev_bz-E8idsnxtmBvO1Ag2vEJMfyCONfM1jcD7p7QfLtaXUHUaG3eUE-R13-8slYn3t"
  });
  const urlParams = new URLSearchParams(window.location.search);
  const roomName = urlParams.get("room") ?? crypto.randomUUID();
  urlParams.set("room", roomName);
  history.replaceState(null, "", "?" + urlParams.toString());

  console.log(`Entering room "${roomName}"`);

  const levelId = crypto.randomUUID() as ElementId;
  const { room, leave } = client.enterRoom(roomName, {
    initialStorage: {
      name: roomName,
      elements: new LiveMap([
        [levelId, new LiveObject({
          type: "level",
          id: levelId,
          parentId: null,
          parentIndex: generateKeyBetween(null, null),
        } satisfies FileFormat.Level)],
      ]),
    }
  });
  const { root } = await room.getStorage();

  console.log(`Entered.`);

  const project = new Project(room, root as any);

  getGlobal().room = room;
  getGlobal().project = project;

  const reactRoot = createRoot(document.getElementById("root")!);
  reactRoot.render(<App />)
}

init();
