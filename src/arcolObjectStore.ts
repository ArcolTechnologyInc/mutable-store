import { LiveMap, LiveObject, Room, StorageUpdate } from "@liveblocks/client";
import { Brand, FileFormat } from "./fileFormat";
import { deepEqual } from "./lib/deepEqual";
import { ChangeManager } from "./changeManager";

export type ArcolObjectFields = { [key: string]: any };

/**
 * ---------------------------
 * Listener/observer types
 * ---------------------------
 */

export type ChangeOrigin = "local" | "remote"
export type ObjectChange =
  | { type: "create" | "delete" }
  | { type: "update", property: string, oldValue: any }

export type ObjectListener<T> = (obj: T, change: ObjectChange, origin: ChangeOrigin) => void;

/**
 * Similar to `ObjectListener`, but as an object and with an optional `runDeferredWork`.
 */
export interface ObjectObserver<T> {
  onChange: (obj: T, change: ObjectChange, origin: ChangeOrigin) => void;

  /**
   * A sufficiently common pattern is to set a dirty flag in `onChange` and then do the work later.
   */
  runDeferredWork?: () => void;
}

/**
 * -----------------------
 * Mixin utilities
 * -----------------------
 *
 * Different types of objects often share subsets of fields, and associated logic (e.g. methods,
 * cached values, etc). We use mixins as a way to share this code.
 *
 * Mixins are not a first-class concept in JavaScript/TypeScript and achieved by dynamically
 * creating class constructors. However, they are considered common and recommended practice.
 * https://www.typescriptlang.org/docs/handbook/mixins.html
 *
 * Still, we use them only because this is a really core part of Arcol. We would normally still
 * prefer to use other patterns (e.g. composition) in most regular product code to keep things simple.
 *
 * You can think of mixins as a partial class. All mixins still inherit from `ArcolObject`
 * conceptually, but don't do so directly because TypeScript doesn't support diamond inheritance.
 * Instead, we have to resort to casts or (this: T) typing.
 *

Example:

```
export class SharedPropertyMixin {
  static MixinLocalFields = { mySharedProperty: true };
  static MixinLocalFieldsDefaults = { mySharedProperty: ... };

  get mySharedProperty(): T {
    // Getters don't support `get(this: ArcolObject<...>)` syntax :(
    return (this as unknown as ArcolObject<...>).getFields().mySharedProperty;
  }

  set mySharedProperty(value: T) {
    // Setters don't support `set(this: ArcolObject<...>)` syntax :(
    (this as unknown as ArcolObject<...>).set("mySharedProperty", value);
  }

  public helper(this: ArcolObject<...>, arg: number) { ... }
};
```

 */


// Gets the constructor type of a class.
type GConstructor<T = {}> = new (...args: any[]) => T;

// The fields defined in mixins could be local fields, and we need to aggregate the list of local fields.
// That's why all mixins are required to declare their local fields in static properties so we can
// aggregate them.
type ArcolObjectBase<T extends object> = GConstructor<ArcolObject<any, any>> & {
  LocalFieldsWithDefaults: T,
};
type MixinClass<T extends object> = GConstructor<any> & {
  LocalFieldsWithDefaults?: T,
};

// Copied from the TypeScript docs with modifications.
export function applyArcolObjectMixins<
  MixinLocalFields extends object,
  BaseLocalFields extends Record<keyof MixinLocalFields, any>
>(derivedCtor: ArcolObjectBase<BaseLocalFields>, constructors: MixinClass<MixinLocalFields>[]) {
  constructors.forEach((baseCtor) => {
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

/**
 * Objects that are stored in `ArcolObjectStore` are expected to extend this class. These objects
 * wrap a `LiveObject` and provide a more convenient API for accessing and modifying the object's
 * fields, in addition to allowing for local (non-synced) fields, cached values and derived values.
 *
 * <I, T> are the same as the same as the generic parameters for `ArcolObjectStore`.
 */
export class ArcolObject<
  I extends string,
  T extends ArcolObject<I, T>
> {
  /**
   * Stores the values of the fields of the object.
   *
   * The reason we store the fields in a separate object rather than just using the backing
   * LiveObject as the source of truth is twofold:
   * - The LiveBlocks .subscribe API doesn't provide the "before" value for updates.
   * - We want to be able to store (local) non-synced properties on objects.
   *
   * Setters should call `.set`, NOT mutate `fields` directly.
   */
  public readonly id: I;
  protected fields: ArcolObjectFields;
  protected localFields: { [key: string]: true };

  constructor(
    protected store: ArcolObjectStore<I, T>,
    protected node: LiveObject<FileFormat.ObjectShared<I> & ArcolObjectFields>,
    /**
     * List of fields that should not be persisted.
     */
    localFieldsWithDefaults: { [key: string]: unknown },
  ) {
    const { id, ...fields } = node.toObject();
    this.id = id;
    this.fields = fields;
    this.localFields = {};
    for (const key in localFieldsWithDefaults) {
      this.localFields[key] = true;
    }
  }

  public getFields() {
    return this.fields;
  }

  public getStore() {
    return this.store;
  }

  public delete() {
    this.store.removeObject(this as any);
  }

  public toDebugObj() {
    return { ...this.fields };
  }

  public getAny(key: string): any {
    return this.fields[key];
  }

  public setAny(key: string, value: any) {
    if (!this.store.changeManager.makingChanges()) {
      console.warn("All mutations to Arcol objects must be wrapped in a makeChanges call.")
      return;
    }

    const oldValue = this.fields[key];

    if (!(key in this.localFields)) {
      this.node.set(key, value);
    }
    this.fields[key] = value;
    this.store._internalOnFieldSet(this as any, key as string, oldValue, value);
  }

  /**
   * To be called from `ArcolObjectStore` only.
   */
  public _internalUpdateField(key: string, value: any) {
    this.fields[key] = value;
  }

  /**
   * To be called from `ArcolObjectStore` only.
   */
  public _internalGetNode() {
    return this.node;
  }
}

export type StoreName = Brand<string, "store-name">;

/**
 * We have a general `ArcolObjectStore` class that can be instantiated because in Arcol, we have at
 * least two types of objects: Elements and board layers.
 *
 * <I> is the type of the object's ID. It's probably a string, but this allows us to use branded
 * string types.
 *
 * <T> is the type of the objects that we are putting in the store, probably a discriminated union
 * of all the different subtypes of objects.
 */
export abstract class ArcolObjectStore<I extends string, T extends ArcolObject<I, T>> {
  protected objects = new Map<I, T>;
  protected listeners = new Set<ObjectListener<T>>();

  constructor(
    private room: Room,
    /**
     * The container node for all the objects.
     */
    private rootNode: LiveMap<string, LiveObject<any>>,
    public changeManager: ChangeManager,
  ) {
  }

  abstract get name(): StoreName;

  protected initialize() {
    // Populate objects from the initial state.
    for (const [id, node] of this.rootNode) {
      const object = this.objectFromLiveObject(node);
      if (id === object.id) {
        this.objects.set(id as I, object);
      } else {
        console.error("Error when loading document: object key does not match object id.");
      }
    }

    this.room.subscribe(this.rootNode, (nodesUpdates) => {
      if (!this.changeManager.makingChanges()) {
        this.onRemoteChanges(nodesUpdates)
      }
    }, { isDeep: true });
  }

  public getById(id: I): T | null {
    return this.objects.get(id) ?? null;
  }

  public getObjects(): T[] {
    return Array.from(this.objects.values());
  }

  public subscribeObjectChange(listener: ObjectListener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    }
  }

  public addObject(object: T) {
    this.addObjects([object]);
  }

  public addObjects(objects: T[]) {
    if (!this.changeManager.makingChanges()) {
      console.warn("All mutations to Arcol objects must be wrapped in a makeChanges call.")
      return;
    }

    for (const object of objects) {
      this.rootNode.set(object.id, object._internalGetNode());
      this.objects.set(object.id, object);
    }

    for (const object of objects) {
      this.notifyListeners(object, "local", "create");
    }
  }

  public removeObject(object: T) {
    if (!this.objects.has(object.id)) {
      return;
    }

    this.objects.delete(object.id);
    this.rootNode.delete(object.id);
    this.notifyListeners(object, "local", "delete");
  }

  public debugObjects() {
    return this.getObjects().map((obj) => obj.toDebugObj());
  }

  /**
   * A function that creates an object from a LiveObject. This is called when receiving new
   * remote LiveObjects or when initially populating the store.
   */
  public abstract objectFromLiveObject(node: LiveObject<any>): T;

  public objectFromFields(id: I, fields: ArcolObjectFields): T {
    // We don't copy all the fields into the LiveObject because some of the fields are internal.
    // That's why we iterate over fields and set them individually instead.
    const node = new LiveObject(fields);
    node.set("id", id);
    const object = this.objectFromLiveObject(node);
    for (const field in fields) {
      object.setAny(field, fields[field]);
    }
    return object;
  }

  // To be called from ArcolObject only.
  public _internalOnFieldSet(object: T, key: string, oldValue: any, newValue: any) {
    // TODO: Need to think some more about whether it's preferable to no-op when the value doesn't
    // change.
    if (deepEqual(oldValue, newValue)) {
      return;
    }

    this.notifyListeners(object, "local", "update", key, oldValue);
  }

  private onRemoteChanges(nodesUpdates: StorageUpdate[]) {
    for (const nodeUpdate of nodesUpdates) {
      // Check for new objects being added or deleted.
      if (nodeUpdate.type === "LiveMap" && nodeUpdate.node === this.rootNode) {
        for (const key in nodeUpdate.updates) {
          const update = nodeUpdate.updates[key];
          const object = this.getById(key as I);

          // LiveMap updates are either "delete" or "update".
          if (update.type === "delete") {
            if (!object) {
              console.error("Error receiving update: object deleted that doesn't exist.");
              continue;
            }
            this.objects.delete(key as I);
            this.notifyListeners(object, "remote", "delete");
          } else if (object) {
            console.error("Error receiving update: object changed for the same key.");
          } else {
            const newObject = this.objectFromLiveObject(nodeUpdate.node.get(key) as LiveObject<any>);
            if (key === newObject.id) {
              this.objects.set(key as I, newObject);
              this.notifyListeners(newObject, "remote", "create");
            } else {
              console.error("Error receiving update: object key does not match object id.");
            }
          }
        }
        continue;
      }

      if (nodeUpdate.type !== "LiveObject") {
        continue;
      }

      const id = nodeUpdate.node.get("id") as I;
      if (!id) {
        continue;
      }
      const object = this.getById(id);
      if (object) {
        for (const key in nodeUpdate.updates) {
          const oldValue = object.getAny(key);
          const newValue = nodeUpdate.node.get(key);

          if (deepEqual(oldValue, newValue)) {
            continue;
          }

          object._internalUpdateField(key, newValue);
          this.notifyListeners(object, "remote", "update", key, oldValue);
        }
      } else {
        console.error("Error receiving update: object not found.");
      }
    }
  }

  private notifyListeners(object: T, origin: ChangeOrigin, type: "create" | "delete"): void
  private notifyListeners(object: T, origin: ChangeOrigin, type: "update", property: string, oldValue: any): void
  private notifyListeners(object: T, origin: ChangeOrigin, type: "create" | "delete" | "update", property?: string, oldValue?: any): void {
    const change = { type, property, oldValue } as ObjectChange;

    for (const listener of this.listeners) {
      listener(object, change, origin);
    }
  }
}
