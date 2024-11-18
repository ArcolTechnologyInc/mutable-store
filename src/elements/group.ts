import { LiveObject } from "@liveblocks/client";
import { ArcolObject, applyArcolObjectMixins } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, HideableMixin } from "./element";
import { HierarchyMixin } from "../hierarchyMixin";

export class Group extends ArcolObject<ElementId, FileFormat.Group, Element> {
  static LocalFieldsWithDefaults = {
    ...HideableMixin.LocalFieldsWithDefaults,
  };

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Group>
  ) {
    super(project, node, Group.LocalFieldsWithDefaults);
    Object.assign(this.fields, { type: "group" }, Group.LocalFieldsWithDefaults);
  }

  get type() {
    return "group" as const;
  }
}

applyArcolObjectMixins(Group, [HierarchyMixin, HideableMixin]);

export interface Group extends HierarchyMixin<ElementId, Element>, HideableMixin {}
