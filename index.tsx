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
    publicApiKey: "pk_prod_otxknoBvauIbYjjn2d31efI7gOCT4cRbe6faTEc300WDeilp-cjkOQ7CSitfjshn"
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
