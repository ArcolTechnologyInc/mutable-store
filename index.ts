import { LiveMap, LiveObject, createClient } from "@liveblocks/client";
import { Project } from "./src/project";
import { ElementId, FileFormat } from "./src/fileFormat";

async function init() {
  const client = createClient({
    publicApiKey: "pk_prod_otxknoBvauIbYjjn2d31efI7gOCT4cRbe6faTEc300WDeilp-cjkOQ7CSitfjshn"
  });
  const urlParams = new URLSearchParams(window.location.search);
  const roomName = urlParams.get("room") ?? "default-room";

  console.log(`Entering room "${roomName}"`);

  const levelId = crypto.randomUUID() as ElementId;
  const { room, leave } = client.enterRoom("my-room", {
    initialStorage: {
      name: roomName,
      elements: new LiveMap([
        [levelId, {
          type: "level",
          id: levelId,
          parentId: null,
        } satisfies FileFormat.Level],
      ]),
    }
  });
  const { root } = await room.getStorage();

  console.log(`Entered.`);

  const project = new Project(room, root as any);

  project.subscribeElementChange(() => {
    // Serialize the project
  });

  (window as any).client = client;
  (window as any).room = room;
  (window as any).root = root;
  (window as any).api = {
    createSketch: () => {
      return project.createSketch();
    }
  };
}

init();
