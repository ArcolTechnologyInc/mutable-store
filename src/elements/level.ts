import { LiveObject } from "@liveblocks/client";
import { ArcolObject, applyArcolObjectMixins } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { ProjectStore } from "../project";
import { Element, HidableMixin } from "./element";

export class Level extends ArcolObject {
  static LocalFields = {};
  static LocalFieldsDefaults = {};

  // Should only be called from `Project`.
  constructor(
    project: ProjectStore,
    node: LiveObject<FileFormat.Level>
  ) {
    super(project, node, Level.LocalFields);
    Object.assign(this.fields, { type: "level" }, Level.LocalFieldsDefaults);
  }

  get type() {
    return "level" as const;
  }
}

applyArcolObjectMixins(Level, [HidableMixin]);

export interface Level extends HidableMixin {}
