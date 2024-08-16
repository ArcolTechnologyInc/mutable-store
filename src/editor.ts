import { ChangeOrigin, ObjectChange } from "./arcolObjectStore";
import { ElementObserver, ProjectStore } from "./project";
import { UndoHistory } from "./undoRedo";
import { Element } from "./elements/element";
import { ElementId } from "./fileFormat";

class DeleteEmptyExtrusionObserver implements ElementObserver {
  private elementsToCheck = new Set<ElementId>();

  constructor(private editor: Editor) {}

  public onChange(obj: Element, _origin: ChangeOrigin, change: ObjectChange) {
    if (obj.type === "sketch") {
      if (obj.parent?.type === "extrusion" && change.type === "delete") {
        this.elementsToCheck.add(obj.parent.id);
      }
      if (change.type === "update" && change.property === "parentId") {
        const oldParent = this.editor.store.getById(change.oldValue);
        if (oldParent?.type === "extrusion") {
          this.elementsToCheck.add(oldParent.id);
        }
      }
    }
  }

  public runDeferredWork() {
    for (const id of this.elementsToCheck) {
      const element = this.editor.store.getById(id);
      if (element?.type === "extrusion" && element.children.length === 0) {
        this.editor.store.removeObject(element)
      }
    }
    this.elementsToCheck.clear();
  }
}

export class Editor {
  public readonly store: ProjectStore;
  public readonly undoTracker: UndoHistory;

  private observers: ElementObserver[] = [
    { onChange: (obj, origin, change) => this.undoTracker.onChange(this.store, obj, origin, change) },
    new DeleteEmptyExtrusionObserver(this),
  ];

  constructor(store: ProjectStore) {
    this.store = store;
    this.undoTracker = new UndoHistory(this);

    this.store.subscribeObjectChange((obj, origin, change) => {
      for (const observer of this.observers) {
        observer.onChange(obj, origin, change);
      }
    });
  }

  public onFrame() {
    this.runDeferredWork();
  }

  public runDeferredWork() {
    this.store.makeChanges(() => {
      for (const observer of this.observers) {
        observer.runDeferredWork?.();
      }
    });
  }
}
