import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import stringify from "json-stringify-pretty-compact";
import { ProjectStore } from "../project";
import { Element } from "../elements/element";
import { ElementId } from "../fileFormat";
import { ElementSelection, getAppState, getEditor, getSelectedElements, useAppState, useSelectionProperty } from "../global";

type ElementRow = {
  id: ElementId,
  type: string,
  indent: number,
  hidden: boolean;
  color: string;
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
      hidden: !!element.hidden,
      color: element.type === "sketch" ? element.color : "",
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

  const onClickRow = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      const updated = { ...selection };
      if (selection[element.id]) {
        delete updated[element.id];
      } else {
        updated[element.id] = true;
      }
      useAppState.setState({ selection: updated });
      // Shift-select selects text
      window.getSelection()?.removeAllRanges();
    } else {
      if (selection[element.id]) {
        useAppState.setState({ selection: {} });
      } else {
        useAppState.setState({ selection: { [element.id]: true } });
      }
    }
    getEditor().undoTracker.commit();
  }

  const onClickVisibility = (e: React.MouseEvent) => {
    getEditor().store.makeChanges(() => {
      const el = getEditor().store.getById(element.id);
      if (el) {
        el.hidden = !element.hidden;
      }
    });
    getEditor().undoTracker.commit();
    e.stopPropagation();
  }

  const onClickDelete = (e: React.MouseEvent) => {
    getEditor().store.makeChanges(() => {
      getEditor().store.getById(element.id)?.delete();
    });
    getEditor().undoTracker.commit();
    e.stopPropagation();
  }

  const onClickUp = (e: React.MouseEvent) => {
    getEditor().store.makeChanges(() => {
      const el = getEditor().store.getById(element.id);
      if (el) {
        el.moveToParentAtIndex(el.parent!, el.indexInParent() - 1);
      }
    });
    getEditor().undoTracker.commit();
    e.stopPropagation();
  }

  const onClickDown = (e: React.MouseEvent) => {
    getEditor().store.makeChanges(() => {
      const el = getEditor().store.getById(element.id);
      if (el) {
        el.moveToParentAtIndex(el.parent!, el.indexInParent() + 1);
      }
    });
    getEditor().undoTracker.commit();
    e.stopPropagation();
  }

  return (
    <div key={element.id}
      className="elementRow"
      style={{
        marginLeft: `${element.indent * 30}px`,
        backgroundColor: index % 2 === 0 ? "#f0f0f0" : "#ffffff",
      }}
      onClick={onClickRow}
    >
      <div style={{ fontFamily: "monospace", opacity: element.hidden ? 0.3 : 1.0 }}>
        <span>{`${element.type}: ${element.id}`}</span>
        {element.type === "sketch" ? <span style={{ color: element.color, padding: "5px" }}>◼</span> : null}
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

function ColorInput() {
  const [color, setColor] = useSelectionProperty<string>("color");
  const [inputValue, setInputValue] = useState<string | null>(null);

  const onSubmit = () => {
    if (inputValue != null && /^#([A-Fa-f0-9]{6})$/.test(inputValue)) {
      setColor(inputValue.toLowerCase());
      setInputValue(null);
    }
  }

  if (color == null) {
    return;
  }

  return <div style={{ display: "flex" }}>
    <div style={{ width: 20, height: 20, backgroundColor: color.value, border: "2px solid black" }}/>
    <input
      type="text"
      value={inputValue == null ? (color.isMixed ? "Mixed" : color.value) : inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onBlur={onSubmit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onSubmit();
        }
      }}
    />
  </div>
}

export function App() {
  const editor = useAppState(state => state.editor);

  useEffect(() => {
    document.addEventListener("keydown", (e) => {
      if (e.metaKey && e.key === "z") {
        if (e.shiftKey) {
          editor.undoTracker.redo();
        } else {
          editor.undoTracker.undo();
        }
        e.preventDefault();
      }
    })
  }, [editor]);

  const [liveblocksPaused, setLiveblocksPaused] = useState(false);
  const [snapshot, setSnapshot] = useState<StoreSnapshot | null>(null);
  useEffect(() => {
    setSnapshot(computeSnapshot(editor.store));
    return editor.store.subscribeObjectChange(() => {
      setSnapshot(computeSnapshot(editor.store));
    })
  }, [editor]);

  const selection = useAppState((state) => state.selection);
  const selected = getSelectedElements(selection);
  const canExtrude = selected.length === 1 && selected[0]?.type === "sketch";
  const canGroup = selected.length >= 1;
  const canUngroup = selected.length === 1 && selected[0]?.type === "group";

  const onCreateSketch = () => {
    editor.store.makeChanges(() => {
      const sketch = getEditor().store.createSketch();
      useAppState.setState({ selection: { [sketch.id]: true } });
    });
    getEditor().undoTracker.commit();
  };

  const onCreateExtrusion = useCallback(() => {
    const element = selected[0];
    if (element?.type === "sketch") {
      getEditor().store.makeChanges(() => {
        const parent = element.parent!;
        const index = element.indexInParent();
        const extrusion = getEditor().store.createExtrusion(element);
        extrusion.moveToParentAtIndex(parent, index);
        useAppState.setState({ selection: { [extrusion.id]: true } });
      });
      getEditor().undoTracker.commit();
    }
  }, [selected])

  const onGroup = useCallback(() => {
    getEditor().store.makeChanges(() => {
      const group = getEditor().store.createGroup();
      // TODO: Should determine the parent of the group via least common ancestor.
      group.setParent(selected[0].parent!);
      for (const element of selected) {
        element.setParent(group);
      }
      useAppState.setState({ selection: { [group.id]: true } });
    });
    getEditor().undoTracker.commit();
  }, [selected]);

  const onUngroup = useCallback(() => {
    const element = selected[0];
    if (element?.type === "group") {
      getEditor().store.makeChanges(() => {
        const selection: ElementSelection = {};
        const parent = element.parent;
        if (parent) {
          for (const child of element.children) {
            child.setParent(parent);
            selection[child.id] = true;
          }
        }
        element.delete();
        useAppState.setState({ selection });
      });
      getEditor().undoTracker.commit();
    }
  }, [selected]);

  if (!snapshot) {
    return null;
  }

  return (
    <div style={{ width: "1200px" }}>
      <div style={{ float: "left", width: "55%" }}>
        <ElementTree elements={snapshot.flatElements} />
      </div>
      <div style={{ float: "right", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          {!liveblocksPaused && <button onClick={() => {
            getAppState().room.disconnect(); setLiveblocksPaused(true);
          } }>Pause Liveblocks</button>}
          {liveblocksPaused && <button onClick={() => {
            getAppState().room.connect(); setLiveblocksPaused(false);
          } }>Resume Liveblocks</button>}
        </div>
        <div>
          <button onClick={onCreateSketch}>Create Sketch</button>
        </div>
        <div>
          {canExtrude && <button onClick={onCreateExtrusion}>Extrude Sketch</button>}
          {canGroup && <button onClick={onGroup}>Group</button>}
          {canUngroup && <button onClick={onUngroup}>Ungroup</button>}
        </div>
        <ColorInput />
        <textarea value={snapshot.stringified} style={{ width: 500, height: 500 }} readOnly />
      </div>
    </div>
  );
}
