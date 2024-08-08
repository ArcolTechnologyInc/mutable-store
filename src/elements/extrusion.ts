import { LiveObject } from "@liveblocks/client";
import { ArcolObject, ArcolObjectStore } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { Project } from "../project";
import { Element } from "./element";

export class Extrusion extends ArcolObject<ElementId, FileFormat.Extrusion, Element> {
  constructor(
    project: Project,
    node: LiveObject<FileFormat.Extrusion>
  ) {
    super(project.getStore() as unknown as ArcolObjectStore<ElementId, any>, node);
  }

  get type() {
    return "extrusion" as const;
  }

  get height(): number {
    return this.fields.height;
  }

  set height(value: number) {
    this.set("height", value);
  }

  public toDebugObj() {
    return {
      ...super.toDebugObj(),
      type: this.type,
      height: this.height,
    }
  }
}
