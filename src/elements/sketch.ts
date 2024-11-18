import { LiveObject } from "@liveblocks/client";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, HideableMixin } from "./element";
import { HierarchyMixin } from "../hierarchyMixin";
import { ArcolObject, applyArcolObjectMixins } from "../arcolObjectStore";

export class Sketch extends ArcolObject<ElementId, Element> {
  static LocalFieldsWithDefaults = {
    ...HideableMixin.LocalFieldsWithDefaults,
  };

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Sketch>
  ) {
    super(project, node, Sketch.LocalFieldsWithDefaults);
    Object.assign(this.fields, { type: "sketch" }, Sketch.LocalFieldsWithDefaults);
  }

  get type() {
    return "sketch" as const;
  }

  public getFields(): FileFormat.Sketch  {
    return this.fields as FileFormat.Sketch;
  }

  get translate(): FileFormat.Sketch["translate"] {
    return this.fields.translate;
  }

  set translate(value: FileFormat.Sketch["translate"]) {
    this.setAny("translate", value);
  }

  get color(): FileFormat.Sketch["color"] {
    return this.fields.color;
  }

  set color(value: FileFormat.Sketch["color"]) {
    this.setAny("color", value);
  }
}

applyArcolObjectMixins(Sketch, [HierarchyMixin, HideableMixin]);

export interface Sketch extends HierarchyMixin<ElementId, Element>, HideableMixin {}
