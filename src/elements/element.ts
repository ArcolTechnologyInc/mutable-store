import { ArcolObject } from "../arcolObjectStore";
import { ElementId } from "../fileFormat";
import { Extrusion } from "./extrusion";
import { Group } from "./group";
import { Level } from "./level";
import { Sketch } from "./sketch";

export type Element = Sketch | Extrusion | Group | Level;

export class HidableMixin {
  static MixinLocalFields = { hidden: true as const };
  static MixinLocalFieldsDefaults = { hidden: false };

  get hidden(): boolean {
    return (this as unknown as ArcolObject).getFields().hidden;
  }

  set hidden(value: boolean) {
    (this as unknown as ArcolObject).set("hidden", value);
  }
};
