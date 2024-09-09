import { Room } from "@liveblocks/client";

/**
 * Any local mutation to objects in any store must be wrapped in a `makeChanges()` call. This
 * ensures batching, but also allows us to distinguish between local and remote changes.
 */
export class ChangeManager {
  private makeChangesRefCount = 0;

  constructor(
    private room: Room,
  ) {}

  public makingChanges(): boolean {
    return this.makeChangesRefCount > 0;
  }

  public makeChanges<T>(cb: () => T): T {
    this.makeChangesRefCount++;
    if (this.makeChangesRefCount > 1) {
      return cb();
    }

    const ret = this.room.batch(() => {
      return cb();
    })

    // Don't let changes accumulate in LiveBlock's history -- we're managing our own undo/redo.
    this.room.history.clear();

    this.makeChangesRefCount--;
    return ret;
  }
}
