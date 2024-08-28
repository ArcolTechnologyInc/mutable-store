import { LiveObject } from "@liveblocks/client";
import { ArcolObject, applyArcolObjectMixins } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, HideableMixin } from "./element";
import { HierarchyMixin } from "../hierarchyMixin";

export class Level extends ArcolObject<ElementId, Element> {
  static LocalFieldsWithDefaults = {};

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Level>
  ) {
    super(project, node, Level.LocalFieldsWithDefaults);
    Object.assign(this.fields, { type: "level" }, Level.LocalFieldsWithDefaults);
  }

  get type() {
    return "level" as const;
  }
}

applyArcolObjectMixins(Level, [HierarchyMixin, HideableMixin]);

export interface Level extends HierarchyMixin<ElementId, Element>, HideableMixin {}
