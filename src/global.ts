import { Room } from "@liveblocks/client";
import { ProjectStore } from "./project";
import { Element } from "./elements/element";
import { UndoHistory } from "./undoRedo";
import { create } from "zustand";
import { ElementId } from "./fileFormat";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type ElementSelection = {
  [id: ElementId]: true,
}

type AppState = {
  room: Room;
  project: ProjectStore;
  undoTracker: UndoHistory;
  selection: ElementSelection;
}

export const useAppState = create<AppState>(() => ({
  room: null as any,
  project: null as any,
  undoTracker: null as any,
  selection: {},
}));

export function getAppState() {
  return useAppState.getState();
}

export function getSelectedElements(selection: ElementSelection) {
  return Object.keys(selection)
    .map((id) => getAppState().project.getById(id as ElementId))
    .filter((x): x is Element => x !== null);
}

type SelectionProperty<T> = { value: T, isMixed: boolean } | null;

export function useSelectionProperty<T>(propertyName: string): [SelectionProperty<T>, (val: T) => void] {
  const project = useAppState(state => state.project);
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

    const first = (selectedElements[0] as any)[propertyName];
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

  useEffect(() => {
    const selectedElements = getSelectedElements(selection);
    updateValue(selectedElements);
    return project.subscribeObjectChange((obj, origin, change) => {
      if (change.type === "update" &&
          change.property === propertyName &&
          selectedElements.some((el) => el === obj)) {
        updateValue(selectedElements);
      }
    })
  }, [selection]);

  const onSetValue = useCallback((value: T) => {
    project.makeChanges(() => {
      const selectedElements = getSelectedElements(selection);
      for (const element of selectedElements) {
        if (propertyName in element) {
          (element as any)[propertyName] = value;
        }
      }
    });
  }, [selection]);

  return [value, onSetValue];
}
