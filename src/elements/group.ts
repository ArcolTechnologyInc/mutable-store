import { LiveObject } from "@liveblocks/client";
import { ArcolObject, ArcolObjectStore } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { Project } from "../project";
import { Element, elementLocalFields, elementLocalFieldsDefaults } from "./element";

export class Group extends ArcolObject<ElementId, Element> {
  static LocalFields = elementLocalFields;

  // Should only be called from `Project`.
  constructor(
    project: Project,
    protected node: LiveObject<FileFormat.Group>
  ) {
    super(project.getStore() as unknown as ArcolObjectStore<ElementId, any>, node, Group.LocalFields);
    Object.assign(this.fields, elementLocalFieldsDefaults);
  }

  get type() {
    return "group" as const;
  }

  get hidden(): boolean {
    return this.fields.hidden;
  }

  set hidden(value: boolean) {
    this.set("hidden", value);
  }
}
