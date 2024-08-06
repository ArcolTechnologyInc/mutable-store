import { LiveObject } from "@liveblocks/client";
import { ElementId, FileFormat } from "../fileFormat";
import { Project } from "../project";
import { Element } from "./element";
import { ArcolObject, ArcolObjectStore } from "../arcolObjectStore";
import { Vec3 } from "../projectTypes";

export class Sketch extends ArcolObject<ElementId, Element> {
  constructor(
    project: Project,
    protected node: LiveObject<FileFormat.Sketch>
  ) {
    super(project.getStore() as unknown as ArcolObjectStore<ElementId, any>, node);
  }

  get type() {
    return "sketch" as const;
  }

  get translate(): Vec3 {
    return this.node.get("translate") as Vec3;
  }

  set translate(value: Vec3) {
    this.set("translate", value);
  }

  get color(): `#${string}` {
    return this.node.get("color");
  }

  set color(value: `#${string}`) {
    this.set("color", value);
  }

  toDebugObj() {
    return {
      ...super.toDebugObj(),
      translate: this.translate,
      color: this.color,
    }
  }
}
