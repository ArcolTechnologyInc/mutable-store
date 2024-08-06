import { useEffect, useState, useSyncExternalStore } from "react"
import { getGlobalProject } from "../project"

export function App() {
  const globalProject = getGlobalProject()!;

  const [snapshot, setSnapshot] = useState("");
  useEffect(() => {
    setSnapshot(JSON.stringify(globalProject!.getRootLevel().toDebugObj(), null, 2));
    return globalProject!.getStore().subscribeObjectChange(() => {
      setSnapshot(JSON.stringify(globalProject!.getRootLevel().toDebugObj(), null, 2));
    })
  })

  return <textarea value={snapshot} style={{ width: 500, height: 500 }}></textarea>
}
