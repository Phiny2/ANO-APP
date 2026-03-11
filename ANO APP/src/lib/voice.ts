export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function speakText(text: string) {
  if (!speechSupported() || !text.trim()) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.rate = 0.96;
  utterance.pitch = 1;
  utterance.lang = document.body.dataset.language === 'sn'
    ? 'sn-ZW'
    : document.body.dataset.language === 'nd'
      ? 'nd-ZW'
      : 'en-ZW';
  window.speechSynthesis.speak(utterance);
}

export function stopSpeech() {
  if (!speechSupported()) {
    return;
  }

  window.speechSynthesis.cancel();
}
