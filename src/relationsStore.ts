import { LiveObject } from "@liveblocks/client";
import { ArcolObject, ArcolObjectStore, ObjectChange, ObjectObserver } from "./arcolObjectStore";
import { FileFormat } from "./fileFormat";

/**
 * A relation represents a one-way connection from two objects A -> B. The id is expected to take
 * the form `guid<>guid` so that relations can be unique.
 *
 * Relations can have attached data, but you can't change the object IDs being connected without
 * creating a new relation.
 */
export class Relation<
  IA extends string,
  IB extends string,
  O extends Relation<IA, IB, O>
> extends ArcolObject<`${IA}<>${IB}`, O> {
  public readonly keyA: IA;
  public readonly keyB: IB;

  constructor(
    store: RelationsStore<IA, IB, O>,
    node: LiveObject<FileFormat.ObjectShared<string>>
  ) {
    super(store, node, {});
    const parts = this.id.split("<>");
    if (parts.length !== 2) {
      throw new Error("Invalid relation id");
    }
    this.keyA = parts[0] as IA;
    this.keyB = parts[1] as IB;
  }
}

/**
 * A relations store is a special type of store meant to represent a many-to-many relationship
 * between objects of two different (or the same) store.
 *
 * By listening to changes in the base object stores, we maintain an "index" of relations, as well
 * clean up invalid relations whether due to the deletion of an object locally or remotely.
 *
 * Note that this kind of client-side approach doesn't 100% guarantee that invalid relations no
 * longer exist: the clients could disconnect before it has the chance to send out the deletion
 * of a relation.
 */
export abstract class RelationsStore<
  IA extends string,
  IB extends string,
  O extends Relation<IA, IB, O>,
> extends ArcolObjectStore<`${IA}<>${IB}`, O> {
  private relationsFromA = new Map<IA, Set<O>>();
  private relationsFromB = new Map<IB, Set<O>>();

  // The owner of this class should put these observers in the respective stores whose objects
  // are being related.
  public readonly observerA: ObjectObserver<ArcolObject<IA, any>> =
    { onChange: this.onObjectChangeA.bind(this) };
  public readonly observerB: ObjectObserver<ArcolObject<IB, any>> =
    { onChange: this.onObjectChangeB.bind(this) };

  protected initialize() {
    super.initialize();

    for (const obj of this.objects.values()) {
      this.addRelation(obj);
    }

    // Update the internal indices when relations are added or removed. The listener should take
    // "precedence" over regular product listeners because it's important to update the store's
    // internal data structures before the product listeners are called.
    //
    // An alternative implementation could be to have abstract methods on `ArcolObjectStore` that
    // we override in this subclass, to _really_ ensure that we handle object changes here first
    // before other listeners.
    this.subscribeObjectChange((obj, change) => {
      if (change.type === "create") {
        this.addRelation(obj);
      } else if (change.type === "delete") {
        this.removeRelation(obj);
      }
    });
  }

  public getRelationsFromA(key: IA): Set<O> {
    return this.relationsFromA.get(key) || new Set();
  }

  public getRelationsFromB(key: IA): Set<O> {
    return this.relationsFromA.get(key) || new Set();
  }

  public getRelation(a: IA, b: IB): O | undefined {
    return this.objects.get(`${a}<>${b}`) as O | undefined;
  }

  public hasRelation(a: IA, b: IB): boolean {
    return !!this.getRelation(a, b);
  }

  private removeRelation(relation: O) {
    this.relationsFromA.get(relation.keyA)?.delete(relation);
    this.relationsFromB.get(relation.keyB)?.delete(relation);
  }

  private addRelation(relation: O) {
    let relationsA = this.relationsFromA.get(relation.keyA);
    if (!relationsA) {
      relationsA = new Set();
      this.relationsFromA.set(relation.keyA, relationsA);
    }
    relationsA.add(relation);

    let relationsB = this.relationsFromB.get(relation.keyB);
    if (!relationsB) {
      relationsB = new Set();
      this.relationsFromB.set(relation.keyB, relationsB);
    }
    relationsB.add(relation);
  }

  /**
   * Cleans up relations related to an object instance of type A when it is deleted.
   */
  private onObjectChangeA(obj: ArcolObject<IA, any>, change: ObjectChange) {
    if (change.type === "delete") {
      const relations = this.relationsFromA.get(obj.id);
      if (relations) {
        this.relationsFromA.delete(obj.id);
        for (const relation of relations) {
          this.relationsFromB.get(relation.keyB)?.delete(relation);
          this.removeObject(relation);
        }
      }
    }
  }

  /**
   * Cleans up relations related to an object instance of type B when it is deleted.
   */
  private onObjectChangeB(obj: ArcolObject<IB, any>, change: ObjectChange) {
    if (change.type === "delete") {
      const relations = this.relationsFromB.get(obj.id);
      if (relations) {
        this.relationsFromB.delete(obj.id);
        for (const relation of relations) {
          this.relationsFromB.get(relation.keyB)?.delete(relation);
          this.removeObject(relation);
        }
      }
    }
  }
}
