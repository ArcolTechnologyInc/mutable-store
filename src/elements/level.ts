import { LiveObject } from "@liveblocks/client";
import { ArcolObject } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element } from "./element";

export class Level extends ArcolObject<ElementId, Element> {

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Level>
  ) {
    super(project, node, {});
    Object.assign(this.fields, { type: "level" });
  }

  get type() {
    return "level" as const;
  }
}
