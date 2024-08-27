import { LiveObject } from "@liveblocks/client";
import { ArcolObject, applyArcolObjectMixins } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, HidableMixin } from "./element";
import { HierarchyMixin } from "../hierarchyMixin";

export class Group extends ArcolObject<ElementId, Element> {
  static LocalFields = {};
  static LocalFieldsDefaults = {};

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Group>
  ) {
    super(project, node, Group.LocalFields);
    Object.assign(this.fields, { type: "group" }, Group.LocalFieldsDefaults);
  }

  get type() {
    return "group" as const;
  }
}

applyArcolObjectMixins(Group, [HierarchyMixin, HidableMixin]);

export interface Group extends HierarchyMixin<ElementId, Element>, HidableMixin {}
