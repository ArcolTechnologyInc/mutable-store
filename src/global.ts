import { Room } from "@liveblocks/client";
import { ProjectStore } from "./project";
import { Element } from "./elements/element";
import { UndoHistory } from "./undoRedo";
import { create } from "zustand";
import { ElementId } from "./fileFormat";
import { useCallback, useEffect, useState } from "react";
import { Editor } from "./editor";

export type ElementSelection = {
  [id: ElementId]: true,
}

type AppState = {
  room: Room;
  editor: Editor;
  selection: ElementSelection;
}

export const useAppState = create<AppState>(() => ({
  room: null as any,
  editor: null as any,
  selection: {},
}));

export function getAppState() {
  return useAppState.getState();
}

export function getEditor() {
  return getAppState().editor;
}

export function getSelectedElements(selection: ElementSelection) {
  return Object.keys(selection)
    .map((id) => getEditor().store.getById(id as ElementId))
    .filter((x): x is Element => x !== null);
}

type SelectionProperty<T> = { value: T, isMixed: boolean } | null;

export function useSelectionProperty<T>(propertyName: string): [SelectionProperty<T>, (val: T) => void] {
  const editor = useAppState(state => state.editor);
  const selection = useAppState(state => state.selection);

  const [value, setValue] = useState<SelectionProperty<T>>(null);

  const updateValue = (selectedElements: Element[]) => {
    if (selectedElements.length === 0) {
      setValue(null);
      return;
    }

    if (!(propertyName in selectedElements[0])) {
      setValue(null);
      return;
    }

    const first = selectedElements[0].get(propertyName);
    for (let i = 1; i < selectedElements.length; i++) {
      const element = selectedElements[i];
      if (!(propertyName in element)) {
        setValue(null);
        return;
      }
      if ((element as any)[propertyName] !== first) {
        setValue({ value: first, isMixed: true });
        return;
      }
    }
    setValue({ value: first, isMixed: false });
  }

  // We don't use `useSyncExternalStore` because it doesn't seem to easily support subscribing to
  // a set of IDs that can change. It feels like it's designed to sync to a whole store, not just
  // part of one.
  useEffect(() => {
    updateValue(getSelectedElements(selection));
    return editor.store.subscribeObjectChange((obj, _origin, change) => {
      if (!Object.keys(selection).some((id) => obj.id === id)) {
        return;
      }
      if (change.type !== "update" || change.property === propertyName) {
        updateValue(getSelectedElements(selection));
      }
    });
  }, [selection]);

  const onSetValue = useCallback((value: T) => {
    editor.store.makeChanges(() => {
      const selectedElements = getSelectedElements(selection);
      for (const element of selectedElements) {
        if (propertyName in element) {
          element.set(propertyName, value);
        }
      }
    });
  }, [selection]);

  return [value, onSetValue];
}
