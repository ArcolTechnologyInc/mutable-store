import { LiveMap, LiveObject } from "@liveblocks/client"

/**
 * Type branding. Allows you to create truly distinct types (_not_ type aliases)
 * backed by simple JavaScript primitives such as `number` and `string`.
 *
 * This does not affect generated JavaScript -- it only affects compile time
 * behavior. One classic use case is for id types.
 */
export type Brand<T, BrandString extends string> = T & {
  readonly [B in BrandString as `__${B}_brand`]: never;
};

export type ElementId = Brand<string, "element-id">;

export namespace FileFormat {
  export type Vec3 = [number, number, number];

  export type ObjectShared<I> = {
    id: I;
    parentId: I | null;
    // Absence of parentIndex means the children of the parent are unsorted.
    parentIndex?: string;
  }

  export type ElementShared = ObjectShared<ElementId>;

  export type Sketch = ElementShared & {
    type: "sketch";
    translate: Vec3;
    color: `#${string}`;
  }

  export type Extrusion = ElementShared & {
    type: "extrusion";
    height: number;
    backingSketch: ElementId;
  }

  export type Group = ElementShared & {
    type: "group";
  }

  export type Level = ElementShared & {
    type: "level";
  }

  export type Element = Sketch | Extrusion | Group | Level;

  export type Project = {
    name: ElementId;
    elements: LiveMap<ElementId, LiveObject<Element>>;
  }
}
