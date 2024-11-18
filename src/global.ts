import { Room } from "@liveblocks/client";
import { Element } from "./elements/element";
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
    .map((id) => getEditor().project.getById(id as ElementId))
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

    const first = selectedElements[0].getAny(propertyName);
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
    return editor.project.subscribeObjectChange((obj, change) => {
      if (!Object.keys(selection).some((id) => obj.id === id)) {
        return;
      }
      if (change.type !== "update" || change.property === propertyName) {
        updateValue(getSelectedElements(selection));
      }
    });
  }, [selection]);

  const onSetValue = useCallback((value: T) => {
    editor.makeChanges(() => {
      const selectedElements = getSelectedElements(selection);
      for (const element of selectedElements) {
        if (propertyName in element) {
          element.setAny(propertyName, value);
        }
      }
    });
  }, [selection]);

  return [value, onSetValue];
}

export function useRelationsFrom(elementId: ElementId): [{ [id: ElementId]: true }, (a: ElementId, b: ElementId, relation: boolean) => void] {
  const editor = useAppState(state => state.editor);

  const [relations, setRelations] = useState<{ [id: ElementId]: true }>({});

  const updateRelations = () => {
    const relations: { [id: ElementId]: true } = {};
    for (const relation of editor.relations.getRelationsFromA(elementId)) {
      relations[relation.keyB] = true;
    }
    setRelations(relations);
  }

  useEffect(() => {
    updateRelations();
    return editor.relations.subscribeObjectChange((obj, change) => {
      if (obj.keyA === elementId || obj.keyB === elementId) {
        updateRelations();
      }
    });
  }, [elementId, editor]);

  const onSetRelation = (a: ElementId, b: ElementId, relation: boolean) => {
    editor.makeChanges(() => {
      if (relation) {
        const elementA = editor.project.getById(a);
        const elementB = editor.project.getById(b);
        if (elementA && elementB) {
          editor.relations.addElementRelation(elementA, elementB);
        }
      } else {
        editor.relations.removeElementRelation(a, b);
      }
    });
  };
  return [relations, onSetRelation]
}
