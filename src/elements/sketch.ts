import { LiveObject } from "@liveblocks/client";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, elementLocalFields, elementLocalFieldsDefaults } from "./element";
import { ArcolObject, ArcolObjectStore } from "../arcolObjectStore";
import { Vec3 } from "../projectTypes";

export class Sketch extends ArcolObject<ElementId, Element> {
  static LocalFields = elementLocalFields;

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Sketch>
  ) {
    super(project, node, Sketch.LocalFields);
    Object.assign(this.fields, { type: "sketch" }, elementLocalFieldsDefaults);
  }

  get type() {
    return "sketch" as const;
  }

  get translate(): Vec3 {
    return this.fields.translate;
  }

  set translate(value: Vec3) {
    this.set("translate", value);
  }

  get color(): `#${string}` {
    return this.fields.color;
  }

  set color(value: `#${string}`) {
    this.set("color", value);
  }

  get hidden(): boolean {
    return this.fields.hidden;
  }

  set hidden(value: boolean) {
    this.set("hidden", value);
  }
}
