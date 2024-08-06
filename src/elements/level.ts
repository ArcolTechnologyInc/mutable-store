import { LiveObject } from "@liveblocks/client";
import { ArcolObject, ArcolObjectStore } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { Project } from "../project";
import { Element } from "./element";

export class Level extends ArcolObject<ElementId, Element> {
  constructor(
    project: Project,
    protected node: LiveObject<FileFormat.Level>
  ) {
    super(project.getStore() as unknown as ArcolObjectStore<ElementId, any>, node);
  }

  get type() {
    return "level" as const;
  }
}
