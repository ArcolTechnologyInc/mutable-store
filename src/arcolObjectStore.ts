import { LiveMap, LiveObject, Room } from "@liveblocks/client";
import { FileFormat } from "./fileFormat";

export class ArcolObject<I extends string, T extends ArcolObject<I, T>> {
  private childrenSet = new Set<I>();
  private cachedChildren: T[] = [];

  constructor(
    protected store: ArcolObjectStore<I, T>,
    protected node: LiveObject<FileFormat.ObjectShared<I>>,
  ) {
  }

  get id() {
    return this.node.get("id");
  }

  get parentId() {
    return this.node.get("parentId");
  }

  get parentIndex() {
    return this.node.get("parentIndex");
  }

  get parent(): T | null {
    return this.parentId ? this.store.getById(this.parentId) : null;
  }

  get children(): T[] {
    return this.cachedChildren;
  }

  public setParent(parent: T) {
    this.store.reparent(this, parent);
    this.set("parentId", parent.id);
  }

  protected set(key: string, value: any) {
    if (!this.store.makingChanges()) {
      console.warn("All mutations to Arcol objects must be wrapped in a makeChanges call.")
      return;
    }

    (this.node as LiveObject<any>).set(key, value);
  }

  // To be called from `ArcolObjectStore` only.
  public _internalAddChild(child: ArcolObject<I, T>) {
    this.childrenSet.add(child.id);
    this.updateCachedChildren();
  }

  // To be called from `ArcolObjectStore` only.
  public _internalRemoveChild(child: ArcolObject<I, T>) {
    this.childrenSet.delete(child.id);
    this.updateCachedChildren();
  }

  private updateCachedChildren() {
    this.cachedChildren = [];
    for (const childId of this.childrenSet) {
      const child = this.store.getById(childId);
      if (child) {
        this.cachedChildren.push(child);
      }
    }
    this.cachedChildren.sort((a, b) => (a.parentIndex ?? "").localeCompare(b.parentIndex ?? ""));
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
    // Populate objects from the initial state.
    for (const [id, node] of this.rootNode) {
      const object = this.objectFromLiveObject(node);
      if (id === object.id) {
        this.objects.set(id as I, object);
      } else {
        console.error("Error when loading document: object key does not match object id.");
      }
    }

    room.subscribe(rootNode, (nodesUpdates) => {
      for (const nodeUpdate of nodesUpdates) {
        // Check for new objects being added or deleted.
        if (nodeUpdate.type === "LiveMap" && nodeUpdate.node === this.rootNode) {
          for (const key in nodeUpdate.updates) {
            const object = this.objects.get(key as I);
            if (object && nodeUpdate.updates[key].type === "delete") {
              this.objects.delete(key as I);
              this.notifyListeners(object, "delete");
            } else if (object) {
              console.error("Error receiving update: object changed for the same key.");
            } else {
              const object = this.objectFromLiveObject(nodeUpdate.node.get(key) as LiveObject<any>);
              if (key === object.id) {
                this.objects.set(key as I, object);
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
        const object = this.objects.get(id);
        if (object) {
          for (const key in nodeUpdate.updates) {
            this.notifyListeners(object, "update", key);
          }
        } else {
          console.error("Error receiving update: object not found.");
        }
      }
    }, { isDeep: true })
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

  public addObject(id: I, node: LiveObject<any>, obj: T) {
    if (!this.makingChanges()) {
      console.warn("All mutations to Arcol objects must be wrapped in a makeChanges call.")
      return;
    }

    this.objects.set(id, obj);
    this.rootNode.set(id, node);
  }

  public reparent(node: ArcolObject<I, T>, newParent: T) {
    if (!this.makingChanges()) {
      console.warn("All mutations to Arcol objects must be wrapped in a makeChanges call.")
      return;
    }

    node.parent?._internalRemoveChild(node);
    newParent._internalAddChild(node);
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
}
