import { LiveObject } from "@liveblocks/client";
import { ArcolObject, ArcolObjectStore } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { Project } from "../project";
import { Element, elementLocalFieldsDefaults } from "./element";

export class Extrusion extends ArcolObject<ElementId, Element> {
  // Should only be called from `Project`.
  constructor(
    project: Project,
    node: LiveObject<FileFormat.Extrusion>
  ) {
    super(project.getStore() as unknown as ArcolObjectStore<ElementId, any>, node);
    Object.assign(this.fields, elementLocalFieldsDefaults);
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
