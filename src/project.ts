import { LiveObject, Room } from "@liveblocks/client";
import { ElementId, FileFormat } from "./fileFormat";
import { Sketch } from "./elements/sketch";
import { ArcolObjectFields, ArcolObjectStore, ChangeOrigin, ObjectChange, ObjectObserver, StoreName } from "./arcolObjectStore";
import { Extrusion } from "./elements/extrusion";
import { Group } from "./elements/group";
import { Level } from "./elements/level";
import { Element } from "./elements/element";
import { generateKeyBetween } from "fractional-indexing";
import { HierarchyObserver } from "./hierarchyMixin";
import { ChangeManager } from "./changeManager";

export type ElementObserver = ObjectObserver<Element>;

/**
 * A more strongly typed version of {@link ObjectChange}.
 *
 * It uses mapped types and index access types to produce a union of all the possible changes for
 * a given object type.
 *
 * e.g.
 *   TypedObjectChange<{ k1: V1, k2: V2, ... }> =
 *     | { type: "create" | "delete" }
 *     | { type: "update", property: "k1", oldValue: V1 }
 *     | { type: "update", property: "k2", oldValue: V2 }
 *     ...
 */
type TypedObjectChange<T extends ArcolObjectFields> =
  | { type: "create" | "delete" }
  | { [K in keyof T]: { type: "update", property: K, oldValue: T[K] } }[keyof T]

/**
 * A more strongly typed version of {@link ObjectListener} for `Element`. The argument to the
 * callback is a single `params` object which repeats the `type` from `obj.type`. This allows
 * narrowing both `obj` and `change` based on the `type` of the `Element`.
 *
 * In more concrete terms, it allows the following to give the desired types:
 * ```
 *   if (params.type === "someElementType") {
 *     if (params.change.type === "update") {
 *       // params.change.property is a union of the possible fields of `someElementType`
 *       if (params.change.property) {
 *         // params.change.value is the type of the field [params.change.property] in `someElementType`
 *       }
 *     }
 *   }
 * ```
 *
 * The weird `T extends any` syntax is called "Distributive Conditional Types" and allows writing
 * generic that maps a union type to a different union of types.
 * https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types
 */
type ElementListener<T extends Element = Element> = (params: T extends any ? {
  type: T["type"],
  obj: T,
  change: TypedObjectChange<ReturnType<T["getFields"]>>,
  origin: ChangeOrigin,
} : never) => void

// This is just here as a test that our TypeScript types are able to perform the desired narrowing.
function foo(l: ElementListener) {}
foo((params) => {
    if (params.type === "sketch") {
        const obj: Sketch = params.obj;
        if (params.change.type === "update") {
          const property: "id" | "type" | "parentId" | "parentIndex" | "translate" | "color" = params.change.property;
          if (params.change.property === "translate") {
            const old: FileFormat.Vec3 = params.change.oldValue
            void old;
          }
          void property;
        }
    }
})


class DeleteEmptyExtrusionObserver implements ElementObserver {
  private elementsToCheck = new Set<ElementId>();

  constructor(private store: ProjectStore) {}

  public onChange(obj: Element, change: ObjectChange) {
    if (obj.type === "sketch") {
      if (obj.parent?.type === "extrusion" && change.type === "delete") {
        this.elementsToCheck.add(obj.parent.id);
      }
      if (change.type === "update" && change.property === "parentId") {
        const oldParent = this.store.getById(change.oldValue);
        if (oldParent?.type === "extrusion") {
          this.elementsToCheck.add(oldParent.id);
        }
      }
    }
  }

  public runDeferredWork() {
    for (const id of this.elementsToCheck) {
      const element = this.store.getById(id);
      if (element?.type === "extrusion" && element.children.length === 0) {
        this.store.removeObject(element)
      }
    }
    this.elementsToCheck.clear();
  }
}

export class ProjectStore extends ArcolObjectStore<ElementId, Element> {
  private root: Level | null = null;

  private observers: ElementObserver[];

  constructor(
    room: Room,
    liveblocksRoot: LiveObject<FileFormat.Project>,
    changeManager: ChangeManager,
    relationsObservers: ObjectObserver<Element>[],
    undoTrackerObserver: ElementObserver,
  ) {
    super(room, liveblocksRoot.get("elements"), changeManager);

    this.initialize();

    for (const obj of this.objects.values()) {
      if (obj.type === "level") {
        this.root = obj;
      }
      obj.parent?._internalAddChild(obj);
    }

    if (!this.root) {
      throw new Error("Document without root level.")
    }

    this.observers = [
      new HierarchyObserver(this),
      ...relationsObservers,
      undoTrackerObserver,
      new DeleteEmptyExtrusionObserver(this),
    ];

    this.subscribeObjectChange((obj, change, origin) => {
      for (const observer of this.observers) {
        observer.onChange(obj, change, origin);
      }
    });
  }

  get name() {
    return "elements-store" as StoreName;
  }

  public getRootLevel() {
    return this.root!;
  }

  public runDeferredWork() {
    this.changeManager.makeChanges(() => {
      for (const observer of this.observers) {
        observer.runDeferredWork?.();
      }
    });
  }

  public subscribeElementChange(listener: ElementListener): () => void {
    return this.subscribeObjectChange((obj, change, origin) => {
      listener({ type: obj.type, obj, change, origin } as any);
    });
  }

  public removeElement(element: Element) {
    const removeRecursive = (element: Element) => {
      if (!this.objects.has(element.id)) {
        return;
      }

      for (const child of element.children) {
        this.removeObject(child);
      }
      this.removeObject(element);
    }

    removeRecursive(element);
  }

  public createSketch(): Sketch {
    const id = crypto.randomUUID() as ElementId;
    const node = new LiveObject({
      type: "sketch",
      id,
      parentId: this.root!.id,
      parentIndex: generateKeyBetween(this.root!.lastChild()?.parentIndex, null),
      translate: [0, 0, 0],
      color: "#888888",
    } satisfies FileFormat.Sketch);
    const sketch = new Sketch(this, node);
    this.addObject(sketch);
    return sketch;
  }

  public createExtrusion(backingSketch: Sketch): Extrusion {
    const id = crypto.randomUUID() as ElementId;
    const node = new LiveObject({
      type: "extrusion",
      id,
      parentId: backingSketch.parentId,
      parentIndex: generateKeyBetween(backingSketch.parent!.lastChild()?.parentIndex, null),
      height: 0,
    } satisfies FileFormat.Extrusion);
    const extrusion = new Extrusion(this, node);
    this.addObject(extrusion);
    return extrusion;
  }

  public createGroup(): Group {
    const id = crypto.randomUUID() as ElementId;
    const node = new LiveObject({
      type: "group",
      id,
      parentId: this.root!.id,
      parentIndex: generateKeyBetween(this.root!.lastChild()?.parentIndex, null),
    } satisfies FileFormat.Group);
    const group = new Group(this, node);
    this.addObject(group);
    return group;
  }

  public objectFromLiveObject(node: LiveObject<FileFormat.Element>): Element {
    const type = node.get("type");
    let element: Element;
    if (type === "sketch") {
      element = new Sketch(this, node as LiveObject<FileFormat.Sketch>);
    } else if (type === "extrusion") {
      element = new Extrusion(this, node as LiveObject<FileFormat.Extrusion>);
    } else if (type === "group") {
      element = new Group(this, node as LiveObject<FileFormat.Group>);
    } else if (type === "level") {
      element = new Level(this, node as LiveObject<FileFormat.Level>);
    } else {
      throw new Error(`Unreachable: ${type}`);
    }

    return element;
  }
}
