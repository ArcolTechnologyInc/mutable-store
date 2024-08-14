import { LiveObject, Room } from "@liveblocks/client";
import { ElementId, FileFormat } from "./fileFormat";
import { Sketch } from "./elements/sketch";
import { ArcolObjectStore, ObjectListener } from "./arcolObjectStore";
import { Extrusion } from "./elements/extrusion";
import { Group } from "./elements/group";
import { Level } from "./elements/level";
import { Element } from "./elements/element";
import { generateKeyBetween } from "fractional-indexing";

export type ElementListener = ObjectListener<Element>;

export class ProjectStore extends ArcolObjectStore<ElementId, Element> {
  private root: Level | null = null;

  constructor(
    room: Room,
    liveblocksRoot: LiveObject<FileFormat.Project>
  ) {
    super(room, liveblocksRoot.get("elements"));

    this.initialize();

    for (const obj of this.objects.values()) {
      if (obj.type === "level") {
        this.root = obj;
      }
    }

    if (!this.root) {
      throw new Error("Document without root level.")
    }
  }

  public getRootLevel() {
    return this.root!;
  }

  public subscribeElementChange(listener: ElementListener) {
    return this.subscribeObjectChange(listener);
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
      backingSketch: backingSketch.id,
    } satisfies FileFormat.Extrusion);
    const extrusion = new Extrusion(this, node)
    this.addObject(extrusion);

    // It's consistent with our current app that there's a bi-directional link between the sketch
    // and the extrusion, but this decision should be revisited.
    backingSketch.setParent(extrusion);
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
