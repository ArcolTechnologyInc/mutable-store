import { ArcolObject } from "../arcolObjectStore";
import { ElementId, FileFormat } from "../fileFormat";
import { Extrusion } from "./extrusion";
import { Group } from "./group";
import { Level } from "./level";
import { Sketch } from "./sketch";

export type Element = Sketch | Extrusion | Group | Level;

interface Hideable {
  hidden: boolean;
}

export class HideableMixin {
  static LocalFieldsWithDefaults = { hidden: false } satisfies Partial<Hideable>;

  get hidden(): Hideable["hidden"] {
    return (this as unknown as ArcolObject<ElementId, Element>).getFields().hidden;
  }

  set hidden(value: Hideable["hidden"]) {
    (this as unknown as ArcolObject<ElementId, Element>).set("hidden", value);
  }
};
