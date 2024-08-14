import { LiveObject } from "@liveblocks/client";
import { ArcolObject, ArcolObjectStore } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, elementLocalFields, elementLocalFieldsDefaults } from "./element";

export class Level extends ArcolObject<ElementId, Element> {
  static LocalFields = elementLocalFields;

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Level>
  ) {
    super(project, node, Level.LocalFields);
    Object.assign(this.fields, { type: "level" }, elementLocalFieldsDefaults);
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
