import { LiveObject } from "@liveblocks/client";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, HidableMixin, applyArcolObjectMixins } from "./element";
import { ArcolObject } from "../arcolObjectStore";
import { Vec3 } from "../projectTypes";

export class Sketch extends ArcolObject<ElementId, Element> {
  static LocalFields = {};
  static LocalFieldsDefaults = {};

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Sketch>
  ) {
    super(project, node, Sketch.LocalFields);
    Object.assign(this.fields, { type: "sketch" }, Sketch.LocalFieldsDefaults);
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
}

applyArcolObjectMixins(Sketch, [HidableMixin]);

export interface Sketch extends HidableMixin {}
