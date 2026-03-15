import { useEffect, useState } from "react";

function normalizeDeviceLabel(label: string) {
	return label
		.replace(/^Default\s*-\s*/i, "")
		.replace(/^Communications\s*-\s*/i, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

function dedupeDevices(devices: MediaDeviceInfo[]) {
	const seen = new Set<string>();

	return devices.filter((device) => {
		const normalizedLabel = normalizeDeviceLabel(device.label || "");
		const key = normalizedLabel || `${device.kind}:${device.deviceId}`;

		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
}

export function useDevices() {
	const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
	const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
	const [hasPermission, setHasPermission] = useState(false);

	useEffect(() => {
		async function loadDevices() {
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();

				const hasLabels = devices.some((device) => device.label !== "");
				setHasPermission(hasLabels);

				setMics(
					dedupeDevices(
						devices.filter((device) => device.kind === "audioinput"),
					),
				);
				setSpeakers(
					dedupeDevices(
						devices.filter((device) => device.kind === "audiooutput"),
					),
				);
			} catch (err) {
				console.error("Failed to enumerate devices", err);
			}
		}

		loadDevices();
		navigator.mediaDevices.addEventListener("devicechange", loadDevices);
		return () =>
			navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
	}, []);

	const requestPermission = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			stream.getTracks().forEach((track) => {
				track.stop();
			});
			setHasPermission(true);

			const devices = await navigator.mediaDevices.enumerateDevices();
			setMics(
				dedupeDevices(devices.filter((device) => device.kind === "audioinput")),
			);
			setSpeakers(
				dedupeDevices(
					devices.filter((device) => device.kind === "audiooutput"),
				),
			);
		} catch (err) {
			console.error("Failed to get microphone permission", err);
		}
	};

	return { mics, speakers, hasPermission, requestPermission };
}
