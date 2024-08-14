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

/**
 * Just a simple example of a file format.
 */
export namespace FileFormat {
  export type Vec3 = [number, number, number];

  /**
   * Note that this is making the `parent` relationship a first-class property of all objects.
   * Furthermore, all children as sorted, even in use cases where it probably doesn't matter too
   * much.
   *
   * I think the extra overhead of maintaining this relationship is worth it for the simplicity
   * of making all objects consistent, and for future proofing.
   */
  export type ObjectShared<I> = {
    id: I;
    type: string;
    parentId: I | null;
    parentIndex: string;
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
