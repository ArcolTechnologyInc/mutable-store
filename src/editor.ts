import { ProjectStore } from "./project";
import { UndoHistory } from "./undoRedo";
import { ElementRelations } from "./elementRelations";
import { LiveObject, Room } from "@liveblocks/client";
import { FileFormat } from "./fileFormat";
import { ChangeManager } from "./changeManager";

export class Editor {
  public readonly undoTracker: UndoHistory;
  public readonly changeManager: ChangeManager;
  public readonly project: ProjectStore;
  public readonly relations: ElementRelations;

  constructor(
    room: Room,
    liveblocksRoot: LiveObject<FileFormat.Project>,
  ) {
    this.undoTracker = new UndoHistory(this);
    this.changeManager = new ChangeManager(room);

    this.relations = new ElementRelations(room, liveblocksRoot, this.changeManager,
      { onChange: (obj, change, origin) => this.undoTracker.onChange(this.relations, obj, change, origin) },
    );

    this.project = new ProjectStore(room, liveblocksRoot, this.changeManager,
      [this.relations.observerA, this.relations.observerB],
      { onChange: (obj, change, origin) => this.undoTracker.onChange(this.project, obj, change, origin) },
    );
  }

  public onFrame() {
    // Asynchronous work should not be part of the undo/redo stack, because it's not user-initiated.
    // If it's a problem that the changes cannot be undone, the nature of that asynchronous change
    // should be revisited.
    this.undoTracker.ignoreUndoRedoScope(() => {
      this.project.runDeferredWork();
    });
  }

  public runDeferredWork() {
    this.project.runDeferredWork();
  }

  public makeChanges<T>(cb: () => T): T {
    return this.changeManager.makeChanges(cb);
  }
}
