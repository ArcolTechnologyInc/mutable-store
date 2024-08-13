import { useCallback, useState, useSyncExternalStore } from "react";
import { getGlobal } from "../global";
import stringify from "json-stringify-pretty-compact";
import { Project } from "../project";
import { Element } from "../elements/element";
import { ElementId } from "../fileFormat";

type ElementRow = {
  id: ElementId,
  type: string,
  indent: number,
  hidden: boolean;
}

type StoreSnapshot = {
  stringified: string,
  flatElements: ElementRow[],
}

type Selection = {
  [id: ElementId]: boolean,
}

function computeSnapshot(project: Project): StoreSnapshot {
  const flatElements: ElementRow[] = [];

  const traverse = (element: Element, indent: number) => {
    flatElements.push({
      id: element.id,
      type: element.type,
      indent,
      hidden: element.hidden,
    });
    for (const child of element.children) {
      traverse(child, indent + 1);
    }
  }

  traverse(project.getRootLevel(), 0);

  return {
    stringified: stringify(project.getStore().debugObjects(), { maxLength: 80 }),
    flatElements,
  }
}

function useProject(): StoreSnapshot {
  return useSyncExternalStore(getGlobal().project.getStore().subscribeObjectChange, () =>
    computeSnapshot(getGlobal().project),
  );
}

function useElement(elementId: ElementId): Element | null {
  return useSyncExternalStore(
    (onStoreChanged) => {
      return getGlobal().project.subscribeElementChange((element) => {
        if (element.id === elementId) {
          onStoreChanged();
        }
      });
    },
    () => getGlobal().project.getById(elementId),
  );
}

type ElementRowProps = {
  index: number,
  element: ElementRow,
  selection: Selection,
  setSelection: (selection: Selection) => void,
}

function ElementRow({ element, index, selection, setSelection }: ElementRowProps) {
  const onClickVisibility = (e: React.MouseEvent) => {
    getGlobal().project.getStore().makeChanges(() => {
      const el = getGlobal().project.getById(element.id);
      if (el) {
        el.hidden = !element.hidden;
      }
    });
    e.stopPropagation();
  }

  const onClickDelete = (e: React.MouseEvent) => {
    getGlobal().project.getStore().makeChanges(() => {
      getGlobal().project.getById(element.id)?.delete();
    });
    e.stopPropagation();
  }

  const onClickUp = (e: React.MouseEvent) => {
    getGlobal().project.getStore().makeChanges(() => {
      const el = getGlobal().project.getById(element.id);
      if (el) {
        el.moveToParentAtIndex(el.parent!, el.indexInParent() - 1);
      }
    });
    e.stopPropagation();
  }

  const onClickDown = (e: React.MouseEvent) => {
    getGlobal().project.getStore().makeChanges(() => {
      const el = getGlobal().project.getById(element.id);
      if (el) {
        el.moveToParentAtIndex(el.parent!, el.indexInParent() + 1);
      }
    });
    e.stopPropagation();
  }

  return (
    <div key={element.id}
      className="elementRow"
      style={{
        marginLeft: `${element.indent * 30}px`,
        backgroundColor: index % 2 === 0 ? "#f0f0f0" : "#ffffff",
      }}
      onClick={(e) => {
        if (e.shiftKey) {
          setSelection({
            ...selection,
            [element.id]: selection[element.id] ? false : true,
          });
          // Shift-select selects text
          window.getSelection()?.removeAllRanges();
        } else {
          if (selection[element.id]) {
            setSelection({});
          } else {
            setSelection({ [element.id]: true });
          }
        }
      }}
    >
      <div style={{ fontFamily: "monospace", opacity: element.hidden ? 0.3 : 1.0 }}>
        <span>{`${element.type}: ${element.id}`}</span>
        <span style={{ cursor: "pointer", padding: '5px' }} onClick={onClickVisibility}>
          {element.hidden ? '🌥️' : '️🌤️'}
        </span>
        <span style={{ cursor: "pointer", padding: '5px' }} onClick={onClickUp}>⬆️</span>
        <span style={{ cursor: "pointer", padding: '5px' }} onClick={onClickDown}>⬇️</span>
        <span style={{ cursor: "pointer", padding: '5px' }} onClick={onClickDelete}>🗑️</span>
      </div>
      <span>{selection[element.id] ? '✅' : ''}</span>
    </div>
  );
}

type ElementTreeProps = {
  elements: ElementRow[],
  selection: Selection,
  setSelection: (selection: Selection) => void,
}

function ElementTree({ elements, selection, setSelection }: ElementTreeProps) {
  return <div>
    {elements.map((element, i) => (
      <ElementRow
        key={element.id}
        index={i}
        element={element}
        selection={selection}
        setSelection={setSelection}
      />
    ))}
  </div>
}

export function App() {
  const project = getGlobal().project;
  const snapshot = useProject();

  const [selection, setSelection] = useState<Selection>({});
  const selected = Object.keys(selection)
    .map((id) => project.getById(id as ElementId))
    .filter((x): x is Element => x !== null);
  const canExtrude = selected.length === 1 && selected[0]?.type === "sketch";
  const canGroup = selected.length >= 1;
  const canUngroup = selected.length === 1 && selected[0]?.type === "group";

  const onCreateSketch = () => {
    project.getStore().makeChanges(() => {
      getGlobal().project.createSketch();
    });
  };

  const onCreateExtrusion = useCallback(() => {
    const element = selected[0];
    if (element?.type === "sketch") {
      project.getStore().makeChanges(() => {
        const parent = element.parent!;
        const index = element.indexInParent();
        const extrusion = project.createExtrusion(element);
        extrusion.moveToParentAtIndex(parent, index);
      });
    }
  }, [selected])

  const onGroup = useCallback(() => {
    project.getStore().makeChanges(() => {
      const group = project.createGroup();
      // TODO: Should determine the parent of the group via least common ancestor.
      group.setParent(selected[0].parent!);
      for (const element of selected) {
        element.setParent(group);
      }
    });
  }, [selected]);

  const onUngroup = useCallback(() => {
    const element = selected[0];
    if (element?.type === "group") {
      project.getStore().makeChanges(() => {
        const parent = element.parent;
        if (parent) {
          for (const child of element.children) {
            child.setParent(parent);
          }
        }
        element.delete();
      });
    }
  }, [selected]);

  if (!snapshot) {
    return null;
  }

  return (
    <div style={{ width: "1100px" }}>
      <div style={{ float: "left", width: "50%" }}>
        <ElementTree elements={snapshot.flatElements} selection={selection} setSelection={setSelection} />
      </div>
      <div style={{ float: "right", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          <button onClick={() => { getGlobal().room.disconnect() } }>Pause Liveblocks</button>
          <button onClick={() => { getGlobal().room.connect() } }>Resume Liveblocks</button>
        </div>
        <div>
          <button onClick={onCreateSketch}>Create Sketch</button>
          {canExtrude && <button onClick={onCreateExtrusion}>Extrude Sketch</button>}
          {canGroup && <button onClick={onGroup}>Group</button>}
          {canUngroup && <button onClick={onUngroup}>Ungroup</button>}
        </div>
        <textarea value={snapshot.stringified} style={{ width: 500, height: 500 }} readOnly />
      </div>
    </div>
  );
}
