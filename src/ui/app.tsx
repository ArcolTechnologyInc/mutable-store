import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import stringify from "json-stringify-pretty-compact";
import { ProjectStore } from "../project";
import { Element } from "../elements/element";
import { ElementId } from "../fileFormat";
import { getAppState, useAppState } from "../global";

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

function computeSnapshot(project: ProjectStore): StoreSnapshot {
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
    stringified: stringify(project.debugObjects(), { maxLength: 80 }),
    flatElements,
  }
}

type ElementRowProps = {
  index: number,
  element: ElementRow,
}

function ElementRow({ element, index }: ElementRowProps) {
  const selection = useAppState((state) => state.selection);

  const onClickVisibility = (e: React.MouseEvent) => {
    getAppState().project.makeChanges(() => {
      const el = getAppState().project.getById(element.id);
      if (el) {
        el.hidden = !element.hidden;
      }
    });
    getAppState().undoTracker.commit();
    e.stopPropagation();
  }

  const onClickDelete = (e: React.MouseEvent) => {
    getAppState().project.makeChanges(() => {
      getAppState().project.getById(element.id)?.delete();
    });
    getAppState().undoTracker.commit();
    e.stopPropagation();
  }

  const onClickUp = (e: React.MouseEvent) => {
    getAppState().project.makeChanges(() => {
      const el = getAppState().project.getById(element.id);
      if (el) {
        el.moveToParentAtIndex(el.parent!, el.indexInParent() - 1);
      }
    });
    getAppState().undoTracker.commit();
    e.stopPropagation();
  }

  const onClickDown = (e: React.MouseEvent) => {
    getAppState().project.makeChanges(() => {
      const el = getAppState().project.getById(element.id);
      if (el) {
        el.moveToParentAtIndex(el.parent!, el.indexInParent() + 1);
      }
    });
    getAppState().undoTracker.commit();
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
          useAppState.setState({
            selection: {
              ...selection,
              [element.id]: selection[element.id] ? false : true,
            },
          });
          // Shift-select selects text
          window.getSelection()?.removeAllRanges();
        } else {
          if (selection[element.id]) {
            useAppState.setState({ selection: {} });
          } else {
            useAppState.setState({ selection: { [element.id]: true } });
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
}

function ElementTree({ elements }: ElementTreeProps) {
  return <div>
    {elements.map((element, i) => (
      <ElementRow
        key={element.id}
        index={i}
        element={element}
      />
    ))}
  </div>
}

export function App() {
  const project = getAppState().project;
  const undoTracker = getAppState().undoTracker;

  useEffect(() => {
    document.addEventListener("keydown", (e) => {
      if (e.metaKey && e.key === "z") {
        if (e.shiftKey) {
          undoTracker.redo();
        } else {
          undoTracker.undo();
        }
        e.preventDefault();
      }
    })
  }, []);

  const [snapshot, setSnapshot] = useState<StoreSnapshot | null>(null);
  useEffect(() => {
    setSnapshot(computeSnapshot(project));
    return project.subscribeObjectChange(() => {
      setSnapshot(computeSnapshot(project));
    })
  }, [project]);

  const selection = useAppState((state) => state.selection);
  const selected = Object.keys(selection)
    .map((id) => project.getById(id as ElementId))
    .filter((x): x is Element => x !== null);
  const canExtrude = selected.length === 1 && selected[0]?.type === "sketch";
  const canGroup = selected.length >= 1;
  const canUngroup = selected.length === 1 && selected[0]?.type === "group";

  const onCreateSketch = () => {
    project.makeChanges(() => {
      getAppState().project.createSketch();
    });
    undoTracker.commit();
  };

  const onCreateExtrusion = useCallback(() => {
    const element = selected[0];
    if (element?.type === "sketch") {
      project.makeChanges(() => {
        const parent = element.parent!;
        const index = element.indexInParent();
        const extrusion = project.createExtrusion(element);
        extrusion.moveToParentAtIndex(parent, index);
      });
      undoTracker.commit();
    }
  }, [selected])

  const onGroup = useCallback(() => {
    project.makeChanges(() => {
      const group = project.createGroup();
      // TODO: Should determine the parent of the group via least common ancestor.
      group.setParent(selected[0].parent!);
      for (const element of selected) {
        element.setParent(group);
      }
    });
    undoTracker.commit();
  }, [selected]);

  const onUngroup = useCallback(() => {
    const element = selected[0];
    if (element?.type === "group") {
      project.makeChanges(() => {
        const parent = element.parent;
        if (parent) {
          for (const child of element.children) {
            child.setParent(parent);
          }
        }
        element.delete();
      });
      undoTracker.commit();
    }
  }, [selected]);

  if (!snapshot) {
    return null;
  }

  return (
    <div style={{ width: "1100px" }}>
      <div style={{ float: "left", width: "50%" }}>
        <ElementTree elements={snapshot.flatElements} />
      </div>
      <div style={{ float: "right", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          <button onClick={() => { getAppState().room.disconnect() } }>Pause Liveblocks</button>
          <button onClick={() => { getAppState().room.connect() } }>Resume Liveblocks</button>
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
