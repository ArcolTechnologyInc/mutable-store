import { ArcolObject, ArcolObjectFields, ArcolObjectStore, ChangeOrigin, ObjectChange } from "./arcolObjectStore";
import { ElementSelection, useAppState } from "./global";

type AnyObject = ArcolObject<any, any>;
type AnyObjectStore = ArcolObjectStore<any, any>;

type HistoryEntry = {
  store: AnyObjectStore | null,
  changes: Record<string,
    // When "op" is "create" or "delete", this stores all the properties of the object.
    | { op: "create" | "delete", properties: ArcolObjectFields<any> }
    | { op: "update", properties: { [key: string]: any } }
  >,
  // Null means no selection change. Empty selection is an empty object.
  selection: ElementSelection | null;
};

/**
 * Undo/Redo is implemented by tracking changes to objects in the document via a listener
 * and recording the operations that were performed.
 *
 * Note that in a multiplayer context, it's always possible for the document to have changed
 * in ways that aren't tracked in the undo system, so the undo system should not assume invariants
 * about the document state.
 *
 * The undo system can be used with multiple stores such that the history tracks changes made in
 * any of them.
 */
export class UndoHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  private pendingChanges: HistoryEntry | null = null;

  private ignoreChanges = false;

  constructor(...stores: AnyObjectStore[]) {
    for (const store of stores) {
      store.subscribeObjectChange((obj, origin, change) => {
        this.onChange(store, obj, origin, change);
      })
    }
    useAppState.subscribe((state, prevState) => {
      if (state.selection !== prevState.selection) {
        this.onSelectionChange(prevState.selection);
      }
    })
  }

  public commit() {
    if (this.pendingChanges) {
      this.undoStack.push(this.pendingChanges);
      this.redoStack.length = 0;
      this.pendingChanges = null;
    }
  }

  public undo() {
    let entry;
    if (this.pendingChanges) {
      entry = this.pendingChanges;
      this.pendingChanges = null;
    } else {
      entry = this.undoStack.pop();
    }

    if (!entry) {
      return;
    }

    // Changes to the document made via undo should not trigger the listener that places changes
    // in the undo stack.
    this.startIgnoringChanges();

    const store = entry.store;
    let redoEntry: HistoryEntry = { store, changes: {}, selection: null };

    store?.makeChanges(() => {
      for (const id in entry.changes) {
        const change = entry.changes[id];
        const obj = store.getById(id);
        if (change.op === "create") {
          // The object whose creation we're undoing might have been deleted in the meantime.
          if (obj) {
            const properties = obj.getFields();
            store.removeObject(obj);
            // We're placing the current values of the object in the redo entry, in case they have
            // changed since the creation.
            redoEntry.changes[id] = { op: "create", properties };
          }
        } else if (change.op === "delete") {
          // Make sure we're not recreating an object that already exists. I don't think there's
          // a way for this to happen in practice because the only way to recreate an object is
          // to undo a deletion, which cannot happen concurrently.
          if (!obj) {
            const recreated = store.objectFromFields(change.properties);
            store.addObject(recreated);
            redoEntry.changes[id] = { op: "delete", properties: change.properties };
          }
        } else {
          // The object whose update we're undoing might have been deleted in the meantime.
          if (obj) {
            redoEntry.changes[id] = { op: "update" as const, properties: {} };
            for (const key in change.properties) {
              const currentValue = obj.get(key);
              obj.set(key, change.properties[key]);
              // We're placing the current values of the properties in the redo entry, in case they
              // have changed since the creation.
              redoEntry.changes[id].properties[key] = currentValue;
            }
          }
        }
      }
    });

    if (entry.selection) {
      const currentSelection = useAppState.getState().selection;
      useAppState.setState({ selection: entry.selection });
      redoEntry.selection = currentSelection;
    }
    this.redoStack.push(redoEntry);

    this.stopIgnoringChanges();
  }

  public redo() {
    const entry = this.redoStack.pop();
    if (!entry) {
      return;
    }

    // For safety only -- this.pendingChanges should already be null if the redo stack was non-empty.
    this.pendingChanges = null;

    // Changes to the document made via redo should not trigger the listener that places changes
    // in the undo stack.
    this.startIgnoringChanges();

    const store = entry.store;
    let undoEntry: HistoryEntry = { store, changes: {}, selection: null };

    store?.makeChanges(() => {
      for (const id in entry.changes) {
        const change = entry.changes[id];
        const obj = store.getById(id);
        if (change.op === "create") {
          // Make sure we're not recreating an object that already exists. I don't think there's
          // a way for this to happen in practice because another user can't redo.
          if (!obj) {
            const recreated = store.objectFromFields(change.properties);
            store.addObject(recreated);
            undoEntry.changes[id] = { op: "create", properties: change.properties };
          }
        } else if (change.op === "delete") {
          // The object whose deletion we're redoing might have been deleted in the meantime.
          if (obj) {
            const properties = obj.getFields();
            store.removeObject(obj);
            undoEntry.changes[id] = { op: "delete", properties };
          }
        } else {
          // The object whose update we're redoing might have been deleted in the meantime.
          if (obj) {
            undoEntry.changes[id] = { op: "update" as const, properties: {} };
            for (const key in change.properties) {
              const currentValue = obj.get(key);
              obj.set(key, change.properties[key]);
              undoEntry.changes[id].properties[key] = currentValue;
            }
          }
        }
      }
    });

    if (entry.selection) {
      const currentSelection = useAppState.getState().selection;
      useAppState.setState({ selection: entry.selection });
      undoEntry.selection = currentSelection;
    }
    this.undoStack.push(undoEntry);

    this.stopIgnoringChanges();
  }

  public startIgnoringChanges() {
    this.ignoreChanges = true;
  }

  public stopIgnoringChanges() {
    this.ignoreChanges = false;
  }

  private onChange(store: AnyObjectStore, obj: AnyObject, origin: ChangeOrigin, change: ObjectChange) {
    if (this.ignoreChanges || origin === "remote") {
      return;
    }

    if (this.pendingChanges) {
      if (this.pendingChanges.store == null) {
        this.pendingChanges.store = store;
      } else if (this.pendingChanges.store !== store) {
        // Don't mix changes from different stores in the same history entry.
        this.commit();
      }
    } else {
      this.pendingChanges = { store, changes: {}, selection: null };
    }

    this.redoStack.length = 0;

    const changes = this.pendingChanges.changes;
    if (change.type === "update") {
      if (!changes[obj.id]) {
        changes[obj.id] = { op: "update", properties: {} };
      }
      changes[obj.id].properties[change.property] = change.oldValue;
    } else {
      changes[obj.id] = { op: change.type, properties: obj.getFields() };
    }
  }

  private onSelectionChange(previousSelection: ElementSelection) {
    if (this.ignoreChanges) {
      return;
    }

    if (!this.pendingChanges) {
      this.pendingChanges = { store: null, changes: {}, selection: previousSelection };
    }
  }
}
