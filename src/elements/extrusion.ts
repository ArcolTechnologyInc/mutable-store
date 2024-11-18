import { LiveObject } from "@liveblocks/client";
import { ArcolObject, applyArcolObjectMixins } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, HideableMixin } from "./element";
import { HierarchyMixin } from "../hierarchyMixin";

export class Extrusion extends ArcolObject<ElementId, Element> {
  static LocalFieldsWithDefaults = {
    ...HideableMixin.LocalFieldsWithDefaults,
  };

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Extrusion>
  ) {
    super(project, node, Extrusion.LocalFieldsWithDefaults);
    Object.assign(this.fields, { type: "extrusion" }, Extrusion.LocalFieldsWithDefaults);
  }

  get type() {
    return "extrusion" as const;
  }

  public getFields(): FileFormat.Sketch  {
    return this.fields as FileFormat.Sketch;
  }

  get height(): FileFormat.Extrusion["height"] {
    return this.fields.height;
  }

  set height(value: FileFormat.Extrusion["height"]) {
    this.setAny("height", value);
  }
}

applyArcolObjectMixins(Extrusion, [HierarchyMixin, HideableMixin]);

export interface Extrusion extends HierarchyMixin<ElementId, Element>, HideableMixin {}