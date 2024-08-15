import { ArcolObject } from "../arcolObjectStore";
import { ElementId } from "../fileFormat";
import { Extrusion } from "./extrusion";
import { Group } from "./group";
import { Level } from "./level";
import { Sketch } from "./sketch";

export type Element = Sketch | Extrusion | Group | Level;

// https://www.typescriptlang.org/docs/handbook/mixins.html
type GConstructor<T = {}> = new (...args: any[]) => T;
type ArcolObjectBase = GConstructor<ArcolObject<ElementId, Element>> & { LocalFields: {}, LocalFieldsDefaults: {} };
type MixinClass = GConstructor<any> & { MixinLocalFields: {}, MixinLocalFieldsDefaults: {} };

export function applyArcolObjectMixins(derivedCtor: ArcolObjectBase, constructors: MixinClass[]) {
  constructors.forEach((baseCtor) => {
    Object.assign(derivedCtor.LocalFields, baseCtor.MixinLocalFields);
    Object.assign(derivedCtor.LocalFieldsDefaults, baseCtor.MixinLocalFieldsDefaults);
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
          Object.create(null)
      );
    });
  });
}

export class HidableMixin {
  static MixinLocalFields = { hidden: true };
  static MixinLocalFieldsDefaults = { hidden: false };

  get hidden(): boolean {
    // Getters don't support `get(this: ArcolObject<ElementId, Element>)` syntax :(
    return (this as unknown as ArcolObject<ElementId, Element>).getFields().hidden;
  }

  set hidden(value: boolean) {
    // Setters don't support `set(this: ArcolObject<ElementId, Element>)` syntax :(
    (this as unknown as ArcolObject<ElementId, Element>).set("hidden", value);
  }
};
