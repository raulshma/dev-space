import { useState } from 'react'

interface ElectronVersions {
  electron: string
  chrome: string
  node: string
}

declare global {
  interface Window {
    electron?: {
      process: {
        versions: ElectronVersions
      }
    }
  }
}

function Versions(): React.JSX.Element {
  const [versions] = useState<ElectronVersions>(
    window.electron?.process.versions ?? { electron: '', chrome: '', node: '' }
  )

  return (
    <ul className="versions">
      <li className="electron-version">Electron v{versions.electron}</li>
      <li className="chrome-version">Chromium v{versions.chrome}</li>
      <li className="node-version">Node v{versions.node}</li>
    </ul>
  )
}

export default Versions
