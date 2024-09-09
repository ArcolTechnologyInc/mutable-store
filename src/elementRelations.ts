import { LiveObject, Room } from "@liveblocks/client";
import { ElementId, FileFormat } from "./fileFormat";
import { Relation, RelationsStore } from "./relationsStore";
import { Element } from "./elements/element";
import { ObjectObserver, StoreName } from "./arcolObjectStore";
import { ChangeManager } from "./changeManager";

export class ElementRelation extends Relation<ElementId, ElementId, ElementRelation> {
}

export class ElementRelations extends RelationsStore<ElementId, ElementId, ElementRelation> {
  constructor(
    room: Room,
    liveblocksRoot: LiveObject<FileFormat.Project>,
    changeManager: ChangeManager,
    undoTrackerObserver: ObjectObserver<ElementRelation>,
  ) {
    super(room, liveblocksRoot.get("elementRelations"), changeManager);

    this.initialize();

    this.subscribeObjectChange((obj, origin, change) => {
      undoTrackerObserver.onChange(obj, origin, change);
    });
  }

  get name() {
    return "element-relations" as StoreName;
  }

  public addElementRelation(elementA: Element, elementB: Element) {
    const key = `${elementA.id}<>${elementB.id}`;
    const node = new LiveObject({ id: key });
    const relation = new ElementRelation(this, node);
    this.addObject(relation);
    return relation;
  }

  public removeElementRelation(a: ElementId, b: ElementId) {
    const relation = this.objects.get(`${a}<>${b}`);
    if (relation) {
      this.removeObject(relation);
    }
  }

  public objectFromLiveObject(node: LiveObject<any>): ElementRelation {
    return new ElementRelation(this, node);
  }
}
