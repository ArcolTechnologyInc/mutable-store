import { LiveObject, Room } from "@liveblocks/client";
import { ElementId, FileFormat } from "./fileFormat";
import { Sketch } from "./elements/sketch";
import { ArcolObjectStore, ObjectListener } from "./arcolObjectStore";
import { Extrusion } from "./elements/extrusion";
import { Group } from "./elements/group";
import { Level } from "./elements/level";
import { Element } from "./elements/element";

export type ElementListener = ObjectListener<Element>;

export class Project {
  private store: ArcolObjectStore<ElementId, Element>;
  private root: Level | null = null;

  constructor(
    private room: Room,
    private liveblocksRoot: LiveObject<FileFormat.Project>
  ) {
    this.store = new ArcolObjectStore<ElementId, Element>(
      room,
      liveblocksRoot.get("elements"),
      this.makeElementFromLiveObject
    );

    for (const obj of this.store.getObjects()) {
      if (obj.type === "level") {
        this.root = obj;
      }
    }

    if (!this.root) {
      throw new Error("Document with root level.")
    }
  }

  public getStore() {
    return this.store;
  }

  public subscribeElementChange(listener: ElementListener) {
    return this.store.subscribeObjectChange(listener);
  }

  public createSketch() {
    const id = crypto.randomUUID() as ElementId;
    const node = new LiveObject({
      type: "sketch",
      id,
      parentId: this.root!.id,
      translate: [0, 0, 0],
      color: "#888888",
    } satisfies FileFormat.Sketch);
    this.store.addObject(id, node, new Sketch(this, node));
  }

  public createExtrusion(backingSketch: Sketch) {
    const id = crypto.randomUUID() as ElementId;
    const node = new LiveObject({
      type: "extrusion",
      id,
      parentId: this.root!.id,
      height: 0,
      backingSketch: backingSketch.id,
    } satisfies FileFormat.Extrusion);
    this.store.addObject(id, node, new Extrusion(this, node));
  }

  public createGroup() {
    const id = crypto.randomUUID() as ElementId;
    const node = new LiveObject({
      type: "group",
      id,
      parentId: this.root!.id,
    } satisfies FileFormat.Group);
    this.store.addObject(id, node, new Group(this, node));
  }

  private makeElementFromLiveObject(node: LiveObject<FileFormat.Element>): Element {
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