import { LiveObject, Room } from "@liveblocks/client";
import { ElementId, FileFormat } from "./fileFormat";
import { Sketch } from "./elements/sketch";
import { ArcolObjectStore, ObjectChange, ObjectListener, ObjectObserver, StoreName } from "./arcolObjectStore";
import { Extrusion } from "./elements/extrusion";
import { Group } from "./elements/group";
import { Level } from "./elements/level";
import { Element } from "./elements/element";
import { generateKeyBetween } from "fractional-indexing";
import { HierarchyObserver } from "./hierarchyMixin";
import { ChangeManager } from "./changeManager";

export type ElementListener = ObjectListener<Element>;
export type ElementObserver = ObjectObserver<Element>;

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
