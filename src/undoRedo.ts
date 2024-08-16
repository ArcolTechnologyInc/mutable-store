import { ArcolObject, ArcolObjectFields, ArcolObjectStore, ChangeOrigin, ObjectChange } from "./arcolObjectStore";
import { Editor } from "./editor";
import { ElementSelection, useAppState } from "./global";

type AnyObject = ArcolObject<any, any>;
type AnyObjectStore = ArcolObjectStore<any, any>;

// When "op" is "create" or "delete", properties includes all of the object.
type CreateChange = { op: "create", properties: ArcolObjectFields<any> };
type DeleteChange = { op: "delete", properties: ArcolObjectFields<any> };
type UpdateChange = { op: "update", properties: Partial<ArcolObjectFields<any>> };

type HistoryEntry = {
  store: AnyObjectStore | null,
  changes: Record<string, CreateChange | DeleteChange | UpdateChange>,
  // Null means no selection change. Empty selection is an empty object.
  selection: ElementSelection | null;

  // Whether the redo stack was empty when this entry was created.
  redoStackWasEmpty: boolean;
};

function sortChanges(changes: Record<string, CreateChange | DeleteChange | UpdateChange>): {
  createChanges: Record<string, CreateChange>,
  deleteChanges: Record<string, DeleteChange>,
  updateChanges: Record<string, UpdateChange>,
} {
  const sorted = {
    createChanges: {} as Record<string, CreateChange>,
    deleteChanges: {} as Record<string, DeleteChange>,
    updateChanges: {} as Record<string, UpdateChange>,
  }
  for (const id in changes) {
    const change = changes[id];
    if (change.op === "create") {
      sorted.createChanges[id] = change;
    } else if (change.op === "delete") {
      sorted.deleteChanges[id] = change;
    } else {
      sorted.updateChanges[id] = change;
    }
  }
  return sorted;
}

// Apply the changes in the entry to the store and return the reverse operation.
function applyChanges(entry: HistoryEntry): HistoryEntry {
  const store = entry.store;
  let reverseEntry: HistoryEntry = {
    store,
    changes: {},
    selection: null,
    // It doesn't actually matter what this value is here.
    redoStackWasEmpty: true,
  };

  store?.makeChanges(() => {
    const { createChanges, deleteChanges, updateChanges } = sortChanges(entry.changes);

    const objectsToAdd = [];
    for (const id in deleteChanges) {
      const obj = store.getById(id);
      // Make sure we're not recreating an object that already exists. I don't think there's
      // a way for this to happen in practice because the only way to recreate an object is
      // to undo a deletion, which cannot happen concurrently.
      if (obj) {
        continue;
      }

      const recreated = store.objectFromFields(deleteChanges[id].properties);
      objectsToAdd.push(recreated);
      reverseEntry.changes[id] = { op: "create", properties: deleteChanges[id].properties };
    }

    store.addObjects(objectsToAdd);

    for (const id in updateChanges) {
      const obj = store.getById(id);
      // The object whose update we're undoing might have been deleted in the meantime.
      if (!obj) {
        continue;
      }

      reverseEntry.changes[id] = { op: "update" as const, properties: {} };
      for (const key in updateChanges[id].properties) {
        const currentValue = obj.get(key);
        obj.set(key, updateChanges[id].properties[key]);
        // We're placing the current values of the properties in the redo entry, in case they
        // have changed since the creation.
        reverseEntry.changes[id].properties[key] = currentValue;
      }
    }

    for (const id in createChanges) {
      const obj = store.getById(id);
      // The object whose creation we're undoing might have been deleted in the meantime.
      if (!obj) {
        continue;
      }

      const properties = obj.getFields();
      store.removeObject(obj);
      // We're placing the current values of the object in the redo entry, in case they have
      // changed since the creation.
      reverseEntry.changes[id] = { op: "delete", properties };
    }
  });

  if (entry.selection) {
    const currentSelection = useAppState.getState().selection;
    useAppState.setState({ selection: entry.selection });
    reverseEntry.selection = currentSelection;
  }

  return reverseEntry;
}

/**
 * While it's useful to put selection in the undo/redo stack, we don't want selection changes to
 * necessarily clear the redo stack. We want to be able to support the following use case:
 * - Undo a bunch of times to restore the document to a previous state.
 * - User selects something from that previous state.
 * - Redo to get back to the current state and paste that thing.
 *
 * In this case, we don't want the selection change to clear the redo stack, nor "insert" those
 * selection change entries at that point in history.
 */
function isIgnorableSelectionChangeEntry(entry: HistoryEntry) {
  return !entry.redoStackWasEmpty && entry.selection != null && Object.keys(entry.changes).length === 0;
}

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

  constructor(private editor: Editor) {
    useAppState.subscribe((state, prevState) => {
      if (state.selection !== prevState.selection) {
        this.onSelectionChange(prevState.selection);
      }
    })
  }

  public commit() {
    // Change that have been made may have created deferred work that generates derived changes. We
    // want this to be part of the same undo stack, since they were conceptually part of the same
    // batch of change from the same user operation.
    this.editor.runDeferredWork();

    if (this.pendingChanges) {
      this.undoStack.push(this.pendingChanges);
      this.pendingChanges = null;
    }
  }

  public undo() {
    this.commit();
    const entry = this.undoStack.pop();

    if (!entry) {
      return;
    }

    // Changes to the document made via undo should not trigger the listener that places changes
    // in the undo stack.
    this.startIgnoringChanges();

    const redoEntry = applyChanges(entry);

    if (!isIgnorableSelectionChangeEntry(entry)) {
      this.redoStack.push(redoEntry);
    }

    this.stopIgnoringChanges();
  }

  public redo() {
    const entry = this.redoStack.pop();
    if (!entry) {
      return;
    }

    // Most of the time, `pendingChanges` will already be empty because we clear the redo stack on
    // change so if the redo-stack is non-empty, there shouldn't be pending changes. However,
    // selection changes set `pendingChanges` without clearing the redo stack.
    this.pendingChanges = null;

    while (
      this.undoStack.length > 0 &&
      isIgnorableSelectionChangeEntry(this.undoStack[this.undoStack.length - 1])
    ) {
      this.undoStack.pop();
    }

    // Changes to the document made via redo should not trigger the listener that places changes
    // in the undo stack.
    this.startIgnoringChanges();

    const undoEntry = applyChanges(entry);
    this.undoStack.push(undoEntry);

    this.stopIgnoringChanges();
  }

  public startIgnoringChanges() {
    this.ignoreChanges = true;
  }

  public stopIgnoringChanges() {
    this.ignoreChanges = false;
  }

  public onChange(store: AnyObjectStore, obj: AnyObject, origin: ChangeOrigin, change: ObjectChange) {
    if (this.ignoreChanges || origin === "remote") {
      return;
    }

    if (this.pendingChanges) {
      if (this.pendingChanges.store == null) {
        this.pendingChanges.store = store;
      } else if (this.pendingChanges.store !== store) {
        // Don't mix changes from different stores in the same history entry.
        this.commit();
        this.pendingChanges = { store, changes: {}, selection: null, redoStackWasEmpty: true };
      }
    } else {
      this.pendingChanges = { store, changes: {}, selection: null, redoStackWasEmpty: true };
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
      this.pendingChanges = {
        store: null,
        changes: {},
        selection: previousSelection,
        redoStackWasEmpty: this.redoStack.length === 0
      };
    } else {
      this.pendingChanges.selection = previousSelection;
    }
  }
}
