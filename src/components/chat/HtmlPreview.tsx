// ---------------------------------------------------------------------------
// OpenBrowserClaw — HTML Preview component (sandboxed iframe)
// ---------------------------------------------------------------------------

import { useState, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Code, X, RotateCcw } from 'lucide-react';

interface Props {
  html: string;
  title?: string;
  height?: number;
}

export function HtmlPreview({ html, title = 'Preview', height = 400 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const clampedHeight = Math.min(Math.max(height, 150), 800);

  const handleReload = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      // Force reload by reassigning srcdoc
      const src = iframe.srcdoc;
      iframe.srcdoc = '';
      requestAnimationFrame(() => { iframe.srcdoc = src; });
    }
  }, []);

  const frameHeight = expanded ? '80vh' : `${clampedHeight}px`;

  return (
    <div className={`my-2 rounded-lg border border-base-300 overflow-hidden bg-base-100 ${expanded ? 'fixed inset-4 z-50 shadow-2xl flex flex-col' : ''}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-base-200/80 text-xs gap-2">
        <div className="flex items-center gap-2 font-semibold opacity-70">
          <span className="w-2 h-2 rounded-full bg-success inline-block" />
          {title}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={handleReload}
            title="Reload"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={() => setShowSource(!showSource)}
            title={showSource ? 'Hide source' : 'View source'}
          >
            <Code className="w-3 h-3" />
          </button>
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Minimize' : 'Expand'}
          >
            {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
          {expanded && (
            <button
              className="btn btn-ghost btn-xs btn-square"
              onClick={() => setExpanded(false)}
              title="Close"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {showSource ? (
        <pre className="text-xs p-3 overflow-auto bg-base-300/30 max-h-96 font-mono whitespace-pre-wrap">
          {html}
        </pre>
      ) : (
        <iframe
          ref={iframeRef}
          srcDoc={html}
          sandbox="allow-scripts allow-modals"
          title={title}
          className="w-full border-0 bg-white"
          style={{ height: frameHeight, minHeight: '150px' }}
        />
      )}
    </div>
  );
}
