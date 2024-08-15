import { LiveObject } from "@liveblocks/client";
import { ArcolObject } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, HidableMixin, applyArcolObjectMixins } from "./element";

export class Extrusion extends ArcolObject<ElementId, Element> {
  static LocalFields = {};
  static LocalFieldsDefaults = {};

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Extrusion>
  ) {
    super(project, node, Extrusion.LocalFields);
    Object.assign(this.fields, { type: "extrusion" }, Extrusion.LocalFieldsDefaults);
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
}

applyArcolObjectMixins(Extrusion, [HidableMixin]);

export interface Extrusion extends HidableMixin {}