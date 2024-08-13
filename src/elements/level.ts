import { LiveObject } from "@liveblocks/client";
import { ArcolObject, ArcolObjectStore } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { Project } from "../project";
import { Element, elementLocalFields, elementLocalFieldsDefaults } from "./element";

export class Level extends ArcolObject<ElementId, Element> {
  static LocalFields = elementLocalFields;

  // Should only be called from `Project`.
  constructor(
    project: Project,
    protected node: LiveObject<FileFormat.Level>
  ) {
    super(project.getStore() as unknown as ArcolObjectStore<ElementId, any>, node, Level.LocalFields);
    Object.assign(this.fields, elementLocalFieldsDefaults);
  }

  get type() {
    return "level" as const;
  }

  get hidden(): boolean {
    return this.fields.hidden;
  }

  set hidden(value: boolean) {
    this.set("hidden", value);
  }
}
