import { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Install Android App"
        title="Install on Android"
        className={
          compact
            ? 'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#0C4A6E] dark:text-[#7DD3FC] bg-white dark:bg-[#112233] border border-[#CBE2F5] dark:border-[#1E3750] hover:bg-[#E0F2FE] dark:hover:bg-[#163049] transition-colors cursor-pointer'
            : 'w-full min-h-[40px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] dark:bg-[#0EA5E9] dark:text-[#08131E] dark:hover:bg-[#38BDF8] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Smartphone className="w-4 h-4 shrink-0" aria-hidden="true" />
        {!compact && <span>{isInstallable ? 'Install Android App' : 'Install on Phone'}</span>}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F2537]/50 dark:bg-black/65 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuide(false);
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[#112233] border border-[#CBE2F5] dark:border-[#1E3750] rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#F2F8FD] dark:bg-[#0D1C2B] border-b border-[#D4E7F7] dark:border-[#1E3750]">
              <h3
                id="pwa-install-guide-title"
                className="text-sm font-semibold text-[#0F2537] dark:text-[#EDF6FF]"
              >
                {isIOS ? 'Install on iPhone / iPad' : 'Install ClearTerm on Android'}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#4B6780] dark:text-[#93B4CF] hover:text-[#0F2537] dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm text-[#33516B] dark:text-[#B8D2E8]">
              {isIOS ? (
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    Open this page in <strong>Safari</strong> and tap the <strong>Share</strong> icon.
                  </li>
                  <li>
                    Scroll down and select <strong>Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong>Add</strong> to launch ClearTerm fullscreen with offline support.
                  </li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    Open the app URL directly in <strong>Chrome on Android</strong>
                    {isAndroid ? '' : ' (or Edge / Chrome on desktop)'}.
                  </li>
                  <li>
                    Tap the browser menu (<strong>⋮</strong>) in the top-right corner.
                  </li>
                  <li>
                    Tap <strong>Install app</strong> or <strong>Add to Home screen</strong> to run ClearTerm offline as a standalone Android app in portrait or landscape.
                  </li>
                </ol>
              )}

              <p className="text-xs text-[#607D96] dark:text-[#7496B5] pt-2 border-t border-[#E6F1FA] dark:border-[#1A3046]">
                Your expenses, income, and savings goals stay saved offline on your device.
              </p>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="min-h-[40px] px-4 py-2 text-xs font-medium text-white bg-[#0284C7] hover:bg-[#0369A1] rounded-lg transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
