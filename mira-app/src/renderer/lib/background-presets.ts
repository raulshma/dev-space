/**
 * Background presets for icons and buttons.
 * Includes creative CSS styles like glassmorphism, gradients, and neon effects.
 */

export interface BackgroundPreset {
  id: string;
  name: string;
  style: React.CSSProperties;
  previewClass?: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'none',
    name: 'None',
    style: {},
  },
  {
    id: 'glass-light',
    name: 'Glass Light',
    style: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    },
  },
  {
    id: 'glass-dark',
    name: 'Glass Dark',
    style: {
      background: 'rgba(0, 0, 0, 0.2)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    },
  },
  {
    id: 'sunset-gradient',
    name: 'Sunset',
    style: {
      background: 'linear-gradient(135deg, #ff5f6d 0%, #ffc371 100%)',
      color: 'white',
      border: 'none',
    },
  },
  {
    id: 'ocean-gradient',
    name: 'Ocean',
    style: {
      background: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
      color: 'white',
      border: 'none',
    },
  },
  {
    id: 'neon-purple',
    name: 'Neon Purple',
    style: {
      background: 'rgba(147, 51, 234, 0.1)',
      border: '1px solid rgba(147, 51, 234, 0.5)',
      boxShadow: '0 0 10px rgba(147, 51, 234, 0.3)',
      color: '#c084fc',
    },
  },
  {
    id: 'neon-green',
    name: 'Neon Green',
    style: {
      background: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid rgba(34, 197, 94, 0.5)',
      boxShadow: '0 0 10px rgba(34, 197, 94, 0.3)',
      color: '#4ade80',
    },
  },
  {
    id: 'mesh-vibrant',
    name: 'Mesh Vibrant',
    style: {
      backgroundColor: '#ff99ee',
      backgroundImage: `
        radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%),
        radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%),
        radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%)
      `,
      color: 'white',
      border: 'none',
    },
  },
];

export function getBackgroundStyle(presetId: string): React.CSSProperties {
  const preset = BACKGROUND_PRESETS.find(p => p.id === presetId);
  return preset ? preset.style : {};
}
