import { LiveObject } from "@liveblocks/client";
import { ArcolObject, ArcolObjectStore } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, elementLocalFields, elementLocalFieldsDefaults } from "./element";

export class Extrusion extends ArcolObject<ElementId, Element> {
  static LocalFields = elementLocalFields;

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Extrusion>
  ) {
    super(project, node, Extrusion.LocalFields);
    Object.assign(this.fields, { type: "extrusion" }, elementLocalFieldsDefaults);
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

  get hidden(): boolean {
    return this.fields.hidden;
  }

  set hidden(value: boolean) {
    this.set("hidden", value);
  }
}
