import { useEffect, useState } from 'react';
import { speakText, speechSupported, stopSpeech } from '../lib/voice';

interface VoiceGuideButtonProps {
  text: string;
  disabled?: boolean;
  label?: string;
}

function VoiceGuideButton({ text, disabled = false, label = 'Read aloud' }: VoiceGuideButtonProps) {
  const [active, setActive] = useState(false);

  useEffect(() => () => stopSpeech(), []);

  if (!speechSupported()) {
    return null;
  }

  return (
    <button
      className="secondary-button"
      disabled={disabled}
      type="button"
      onClick={() => {
        if (active) {
          stopSpeech();
          setActive(false);
          return;
        }

        speakText(text);
        setActive(true);
        window.setTimeout(() => setActive(false), 2400);
      }}
    >
      {active ? 'Stop voice' : label}
    </button>
  );
}

export default VoiceGuideButton;
