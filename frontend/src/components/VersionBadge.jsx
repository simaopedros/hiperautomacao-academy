import React from 'react';

function VersionBadge() {
  const version = process.env.REACT_APP_VERSION;
  const display = version ? `v${version}` : 'v0.0.0-dev';

  return (
    <div
      aria-label="version"
      className="fixed bottom-2 right-3 z-[9999] select-none pointer-events-none px-2 py-1 rounded-md text-[11px] leading-none bg-black/30 text-gray-300 backdrop-blur-sm shadow-sm"
      style={{
        // Ensure subtle contrast on both light/dark themes
        border: '1px solid rgba(255,255,255,0.12)'
      }}
    >
      {display}
    </div>
  );
}

export default VersionBadge;