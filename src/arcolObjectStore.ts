import { LiveMap, LiveObject, Room, StorageUpdate } from "@liveblocks/client";
import { FileFormat } from "./fileFormat";
import { generateKeyBetween } from "fractional-indexing";
import { deepEqual } from "./lib/deepEqual";

export class ArcolObject<
  I extends string,
  T extends ArcolObject<I, T>
> {
  private childrenSet = new Set<I>();
  private cachedChildren: T[] | null = null;

  // The reason we store the fields in a separate object rather than just using the backing
  // LiveObject as the source of truth is twofold:
  // - The LiveBlocks .subscribe API doesn't provide the "before" value for updates.
  // - We want to be able to store non-synced properties on objects.
  protected fields: FileFormat.ObjectShared<I> & { [key: string]: any };

  constructor(
    protected store: ArcolObjectStore<I, T>,
    protected node: LiveObject<any>,
  ) {
    this.fields = node.toObject();
  }

  get id() {
    return this.fields.id;
  }

  get parentId() {
    return this.fields.parentId;
  }

  get parentIndex() {
    return this.fields.parentIndex;
  }

  get parent(): T | null {
    return this.parentId ? this.store.getById(this.parentId) : null;
  }

  get children(): T[] {
    if (!this.cachedChildren) {
      this.cachedChildren = [];
      for (const childId of this.childrenSet) {
        const child = this.store.getById(childId);
        if (child) {
          this.cachedChildren.push(child);
        }
      }
      this.cachedChildren.sort((a, b) => {
        // Ideally we don't end up with two identical parent indices, but if it does happen, at
        // least try to have a consistent sort order by using the ID as fallback.
        if (a.parentIndex === b.parentIndex) {
          if (a.id < b.id) {
            return -1;
          }
        }
        return a.parentIndex < b.parentIndex ? -1 : 1
      });
    }
    return this.cachedChildren;
  }

  public delete() {
    this.store.removeObject(this as any);
  }

  public lastChild(): T | null {
    return this.children[this.children.length - 1];
  }

  public setParent(parent: T) {
    this.set("parentId", parent.id);
    this.set("parentIndex", generateKeyBetween(parent.lastChild()?.parentIndex, null));
  }

  // Move this object to be the nth child of the parent. index === 0 => first child.
  public moveToParentAtIndex(parent: T, index: number) {
    this.set("parentId", parent.id);
    const clampedIndex = Math.min(index, parent.children.length);
    console.log("moveToParentAtIndex", index, clampedIndex);
    this.set("parentIndex", generateKeyBetween(
      parent.children[clampedIndex - 1]?.parentIndex,
      parent.children[clampedIndex]?.parentIndex)
    );
  }

  public indexInParent(): number {
    return this.parent?.children.indexOf(this as any) ?? -1;
  }

  public toDebugObj() {
    return { ...this.fields };
  }

  public get(key: string) {
    return this.fields[key];
  }

  public set(key: string, value: any) {
    if (!this.store.makingChanges()) {
      console.warn("All mutations to Arcol objects must be wrapped in a makeChanges call.")
      return;
    }

    const oldValue = this.fields[key];
    this.node.set(key, value);
    this.fields[key] = value;
    this.store._internalOnFieldSet(this as any, key as string, oldValue, value);
  }

  // To be called from `ArcolObjectStore` only.
  // We could make this a symbol private to this field to enforce it more strongly, but I think it's
  // not worth the readability hit.
  public _internalAddChild(child: ArcolObject<I, T>) {
    this.childrenSet.add(child.id);
    this.cachedChildren = null;
  }

  // To be called from `ArcolObjectStore` only.
  public _internalRemoveChild(child: ArcolObject<I, T>) {
    this.childrenSet.delete(child.id);
    this.cachedChildren = null;
  }

  // To be called from `ArcolObjectStore` only.
  public _internalClearChildrenCache() {
    this.cachedChildren = null;
  }

  // To be called from `ArcolObjectStore` only.
  public _internalUpdateField(key: string, value: any) {
    this.fields[key] = value;
  }
}

type ObjectChange =
  | { type: "create" | "delete" }
  // It would be nice to include the "before" value, but LiveBlocks's subscribe API doesn't provide
  // it, so we would have to store a copy of each property ourselves.
  | { type: "update", property: string }

export type ObjectListener<T> = (obj: T, changes: ObjectChange & {
  origin: "local" | "remote",
}) => void;

export class ArcolObjectStore<I extends string, T extends ArcolObject<I, T>> {
  private objects = new Map<I, T>;
  private listeners = new Set<ObjectListener<T>>();
  private makeChangesRefCount = 0;

  constructor(
    private room: Room,
    private rootNode: LiveMap<string, LiveObject<any>>,
    private objectFromLiveObject: (node: LiveObject<any>) => T,
  ) {
  }

  public initialize() {
    // Populate objects from the initial state.
    for (const [id, node] of this.rootNode) {
      const object = this.objectFromLiveObject(node);
      if (id === object.id) {
        this.objects.set(id as I, object);
      } else {
        console.error("Error when loading document: object key does not match object id.");
      }
    }

    for (const object of this.objects.values()) {
      object.parent?._internalAddChild(object);
    }

    this.room.subscribe(this.rootNode, (nodesUpdates) => {
      if (!this.makingChanges()) {
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

  public addObject(id: I, node: LiveObject<any>, object: T) {
    if (!this.makingChanges()) {
      console.warn("All mutations to Arcol objects must be wrapped in a makeChanges call.")
      return;
    }

    this.rootNode.set(id, node);
    this.objects.set(id, object);
    object.parent?._internalAddChild(object);
    this.notifyListeners(object, "create");
  }

  public removeObject(object: T) {
    if (!this.makingChanges()) {
      console.warn("All mutations to Arcol objects must be wrapped in a makeChanges call.")
      return;
    }

    for (const child of object.children) {
      this.removeObject(child);
    }

    object.parent?._internalRemoveChild(object);
    this.objects.delete(object.id);
    this.rootNode.delete(object.id);
    this.notifyListeners(object, "delete");
  }

  public makeChanges<T>(cb: () => T): T {
    this.makeChangesRefCount++;
    if (this.makeChangesRefCount > 1) {
      return cb();
    }

    const ret = this.room.batch(() => {
      return cb();
    })

    this.makeChangesRefCount--;
    return ret;
  }

  public makingChanges(): boolean {
    return this.makeChangesRefCount > 0;
  }

  public debugObjects() {
    return this.getObjects().map((obj) => obj.toDebugObj());
  }

  // To be called from ArcolObject only.
  public _internalOnFieldSet(object: T, key: string, oldValue: any, newValue: any) {
    // TODO: Need to think some more about whether it's preferable to no-op when the value doesn't
    // change.
    if (deepEqual(oldValue, newValue)) {
      return;
    }

    if (key === "parentId") {
      this.getById(oldValue as I)?._internalRemoveChild(object);
      this.getById(newValue as I)?._internalAddChild(object);
    } else if (key === "parentIndex") {
      object.parent?._internalClearChildrenCache();
    }
    this.notifyListeners(object, "update", key);
  }

  private onRemoteChanges(nodesUpdates: StorageUpdate[]) {
    for (const nodeUpdate of nodesUpdates) {
      // Check for new objects being added or deleted.
      if (nodeUpdate.type === "LiveMap" && nodeUpdate.node === this.rootNode) {
        for (const key in nodeUpdate.updates) {
          const object = this.getById(key as I);
          if (object && nodeUpdate.updates[key].type === "delete") {
            object.parent?._internalRemoveChild(object);
            this.objects.delete(key as I);
            this.notifyListeners(object, "delete");
          } else if (object) {
            console.error("Error receiving update: object changed for the same key.");
          } else {
            const object = this.objectFromLiveObject(nodeUpdate.node.get(key) as LiveObject<any>);
            if (key === object.id) {
              this.objects.set(key as I, object);
              object.parent?._internalAddChild(object);
              this.notifyListeners(object, "create");
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
          const oldValue = object.get(key);
          const newValue = nodeUpdate.node.get(key);

          if (deepEqual(oldValue, newValue)) {
            continue;
          }

          if (key === "parentId") {
            this.getById(oldValue as I)?._internalRemoveChild(object);
            const newParent = newValue ? this.getById(newValue as I) : null;
            newParent?._internalAddChild(object);
          } else if (key === "parentIndex") {
            object.parent?._internalClearChildrenCache();
          }
          object._internalUpdateField(key, newValue);

          this.notifyListeners(object, "update", key);
        }
      } else {
        console.error("Error receiving update: object not found.");
      }
    }
  }

  private notifyListeners(object: T, type: "create" | "delete"): void
  private notifyListeners(object: T, type: "update", property: string): void
  private notifyListeners(object: T, type: "create" | "delete" | "update", property?: string): void {
    for (const listener of this.listeners) {
      listener(object, {
        type,
        property,
        origin: this.makingChanges() ? "local" : "remote",
      } as ObjectChange & { origin: "local" | "remote" });
    }
  }
}
