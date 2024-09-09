import { generateKeyBetween } from "fractional-indexing";
import { ArcolObject, ArcolObjectStore, ChangeOrigin, ObjectChange, ObjectObserver } from "./arcolObjectStore";
import { FileFormat } from "./fileFormat";

/**
 * Allows creating a parent-child relationship using the parentId and parentIndex fields.
 *
 * Stores that contain objects that extend HierarchyMixin are expected to:
 * - Have all objects in the store extend HierarchyMixin
 * - Implement HierarchyObserver to updated the cached values. It should probably be the first
 *   observer to run considering that subsequent observers are likely to read the children list.
 */
export class HierarchyMixin<I extends string, T extends ArcolObject<I, T> & HierarchyMixin<I, T>> {
  static MixinLocalFieldsWithDefaults = {};

  /**
   * Unsorted list of children of this object. Updated by ArcolObjectStore.
   */
  private _childrenSet!: Set<I>;
  private get childrenSet() {
    // Mixins can't run field initializers, so initialize in a getter.
    if (!this._childrenSet) {
      this._childrenSet = new Set();
    }
    return this._childrenSet;
  }

  /**
   * Most of the time, when the API consumer wants to access the children of an object, they want
   * the sorted list, which is determined by the fractional parentIndex of the children.
   */
  private cachedChildren: T[] | null = null;

  get self(): T {
    return this as unknown as T;
  }

  get parentId(): FileFormat.HierarchyMixin<I>["parentId"] {
    return this.self.getFields().parentId;
  }

  get parentIndex(): FileFormat.HierarchyMixin<I>["parentIndex"] {
    return this.self.getFields().parentIndex;
  }

  get parent(): T | null {
    return this.parentId ? this.self.getStore().getById(this.parentId) : null;
  }

  get children(): T[] {
    if (!this.cachedChildren) {
      this.cachedChildren = [];
      for (const childId of this.childrenSet) {
        const child = this.self.getStore().getById(childId);
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
        return a.parentIndex < b.parentIndex ? -1 : 1;
      });
    }
    return this.cachedChildren;
  }

  public lastChild(): T | null {
    return this.children[this.children.length - 1];
  }

  public setParent(parent: T) {
    this.self.setAny("parentId", parent.id);
    this.self.setAny("parentIndex", generateKeyBetween(parent.lastChild()?.parentIndex, null));
  }

  /**
   * Move this object to be the nth child of the parent. index === 0 => first child.
   */
  public moveToParentAtIndex(parent: T, index: number) {
    const currentIndex = this.indexInParent();
    if (currentIndex === -1 || index === currentIndex) {
      return;
    }

    this.self.setAny("parentId", parent.id);
    const clampedIndex = Math.min(index, parent.children.length);

    if (clampedIndex > currentIndex) {
      this.self.setAny("parentIndex", generateKeyBetween(
        parent.children[clampedIndex]?.parentIndex,
        parent.children[clampedIndex + 1]?.parentIndex)
      );
    } else {
      this.self.setAny("parentIndex", generateKeyBetween(
        parent.children[clampedIndex - 1]?.parentIndex,
        parent.children[clampedIndex]?.parentIndex)
      );
    }
  }

  public indexInParent(): number {
    return this.parent?.children.indexOf(this as unknown as T) ?? -1;
  }

  /**
   * To be called from `ArcolObjectStore` only.
   * We could make this a symbol private to this field to enforce it more strongly, but I think it's
   * not worth the readability hit.
   */
  public _internalAddChild(child: ArcolObject<I, T>) {
    this.childrenSet.add(child.id);
    this.cachedChildren = null;
  }

  /**
   * To be called from `ArcolObjectStore` only.
   */
  public _internalRemoveChild(child: ArcolObject<I, T>) {
    this.childrenSet.delete(child.id);
    this.cachedChildren = null;
  }

  /**
   * To be called from `ArcolObjectStore` only.
   */
  public _internalClearChildrenCache() {
    this.cachedChildren = null;
  }
}

/**
 * On changes to the hierarchy fields, updated the corresponding cached values.
 */
export class HierarchyObserver<
    I extends string,
    T extends ArcolObject<I, T> & HierarchyMixin<I, T>
> implements ObjectObserver<T> {

  constructor(private store: ArcolObjectStore<I, T>) { }

  public onChange(obj: T, _origin: ChangeOrigin, change: ObjectChange) {
    if (change.type === "create") {
      obj.parent?._internalAddChild(obj);
    } else if (change.type === "delete") {
      obj.parent?._internalRemoveChild(obj);
    } else if (change.type === "update") {
      if (change.property === "parentId") {
        if (change.oldValue) {
          this.store.getById(change.oldValue)?._internalRemoveChild(obj);
        }
        if (obj.parentId) {
          this.store.getById(obj.parentId)?._internalAddChild(obj);
        }
      } else if (change.property === "parentIndex") {
        obj.parent?._internalClearChildrenCache();
      }
    }
  }
}
