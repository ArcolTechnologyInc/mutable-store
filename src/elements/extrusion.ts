import { LiveObject } from "@liveblocks/client";
import { ArcolObject, applyArcolObjectMixins } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, HidableMixin } from "./element";
import { HierarchyMixin } from "../hierarchyMixin";

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

applyArcolObjectMixins(Extrusion, [HierarchyMixin, HidableMixin]);

export interface Extrusion extends HierarchyMixin<ElementId, Element>, HidableMixin {}