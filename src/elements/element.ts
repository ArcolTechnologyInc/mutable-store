import { applyArcolObjectMixins, ArcolObject } from "../arcolObjectStore";
import { ElementId } from "../fileFormat";
import { Extrusion } from "./extrusion";
import { Group } from "./group";
import { Level } from "./level";
import { Sketch } from "./sketch";

export type Element = Sketch | Extrusion | Group | Level;

class MixinBase {
  get arcolObject(): ArcolObject<ElementId, Element> {
    return this as unknown as ArcolObject<ElementId, Element>;
  }
}

export class HidableMixin extends MixinBase {
  static MixinLocalFields = { hidden: true as const };
  static MixinLocalFieldsDefaults = { hidden: false };

  get hidden(): string {
    // should cause an error
    return this.arcolObject.getFields().hidden;
  }

  set hidden(value: string) {
    // should cause an error
    this.arcolObject.set("hidden", value);
  }
};

// Also we accidentally clobber existing mixin values

export class HideableDuplicateMixin {
  static MixinLocalFields = { hidden: true as const };
  static MixinLocalFieldsDefaults = { hidden: "qwerty" };

  get hidden(): boolean {
    return (this as unknown as ArcolObject<ElementId, Element>).getFields().hidden;
  }

  set hidden(value: boolean) {
    (this as unknown as ArcolObject<ElementId, Element>).set("hidden", value);
  }
};

export class DuplicatedFields extends ArcolObject<ElementId, Element> {
  static LocalFields = {};
  static LocalFieldsDefaults = {};
}
applyArcolObjectMixins(DuplicatedFields, [HidableMixin, HideableDuplicateMixin]);

