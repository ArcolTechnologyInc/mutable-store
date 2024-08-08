import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { getGlobal } from "../global";
import stringify from "json-stringify-pretty-compact";
import { Project } from "../project";
import { Element } from "../elements/element";
import { ElementId } from "../fileFormat";

type ElementRow = {
  id: ElementId,
  type: string,
  indent: number,
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

type ElementTreeProps = {
  elements: ElementRow[],
  selection: Selection,
  setSelection: (selection: Selection) => void,
}

function ElementTree({ elements, selection, setSelection }: ElementTreeProps) {
  const rows = elements.map((element, i) =>
    <div key={element.id}
      className="elementRow"
      style={{
        marginLeft: `${element.indent * 30}px`,
        backgroundColor: i % 2 === 0 ? "#f0f0f0" : "#ffffff",
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
          setSelection({ [element.id]: true });
        }
      }}
    >
      <span>{`${element.type}: ${element.id}`}</span>
      <span>{selection[element.id] ? '✅' : ''}</span>
    </div>
  );

  return <div>
    {rows}
  </div>
}

export function App() {
  const project = getGlobal().project;

  const [snapshot, setSnapshot] = useState<StoreSnapshot | null>(null);
  useEffect(() => {
    setSnapshot(computeSnapshot(project));
    return project.getStore().subscribeObjectChange((change) => {
      setSnapshot(computeSnapshot(project));
    })
  }, [project]);

  const [selection, setSelection] = useState<Selection>({});
  const selected = Object.keys(selection)
    .map((id) => project.getById(id as ElementId))
    .filter((x): x is Element => x !== null);
  const canExtrude = selected.length === 1 && selected[0]?.type === "sketch";

  const onCreateSketch = () => {
    project.getStore().makeChanges(() => {
      getGlobal().project.createSketch();
    });
  };

  const onCreateExtrusion = useCallback(() => {
    const element = selected[0];
    if (element?.type === "sketch") {
      project.getStore().makeChanges(() => {
        project.createExtrusion(element);
      });
    }
  }, [selected])

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
        </div>
        <textarea value={snapshot.stringified} style={{ width: 500, height: 500 }} readOnly />
      </div>
    </div>
  );
}
