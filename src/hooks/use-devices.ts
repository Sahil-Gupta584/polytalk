import { useState, useEffect } from 'react';

export function useDevices() {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // If labels are empty, permission hasn't been granted yet
        const hasLabels = devices.some(d => d.label !== '');
        setHasPermission(hasLabels);

        setMics(devices.filter(d => d.kind === 'audioinput'));
        setSpeakers(devices.filter(d => d.kind === 'audiooutput'));
      } catch (err) {
        console.error("Failed to enumerate devices", err);
      }
    }
    
    loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
  }, []);

  // Expose a way to explicitly request permission to populate labels
  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the tracks immediately, we just wanted permission
      stream.getTracks().forEach(t => t.stop());
      setHasPermission(true);
      
      // Reload devices now that we have permission
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMics(devices.filter(d => d.kind === 'audioinput'));
      setSpeakers(devices.filter(d => d.kind === 'audiooutput'));
    } catch (err) {
      console.error("Failed to get microphone permission", err);
    }
  };

  return { mics, speakers, hasPermission, requestPermission };
}
