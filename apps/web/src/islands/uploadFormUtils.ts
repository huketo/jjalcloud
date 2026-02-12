export interface UploadPreview {
	url: string;
	name: string;
	size: string;
	width: number;
	height: number;
}

export interface UploadStatus {
	type: "error" | "success";
	message: string;
}

export function getInitialUploadStatus(
	initialError?: string,
	initialSuccess?: string,
): UploadStatus | null {
	if (initialError) {
		return { type: "error", message: initialError };
	}

	if (initialSuccess) {
		return { type: "success", message: initialSuccess };
	}

	return null;
}

export function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes";

	const unit = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const index = Math.floor(Math.log(bytes) / Math.log(unit));

	return `${parseFloat((bytes / unit ** index).toFixed(2))} ${sizes[index]}`;
}

async function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = (event) => {
			if (typeof event.target?.result === "string") {
				resolve(event.target.result);
				return;
			}

			reject(new Error("Failed to read file as data URL"));
		};

		reader.onerror = () => {
			reject(new Error("Failed to read file"));
		};

		reader.readAsDataURL(file);
	});
}

async function getImageDimensions(
	dataUrl: string,
): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const image = new Image();

		image.onload = () => {
			resolve({ width: image.naturalWidth, height: image.naturalHeight });
		};

		image.onerror = () => {
			resolve({ width: 0, height: 0 });
		};

		image.src = dataUrl;
	});
}

export async function createUploadPreview(file: File): Promise<UploadPreview> {
	const dataUrl = await readFileAsDataUrl(file);
	const { width, height } = await getImageDimensions(dataUrl);

	return {
		url: dataUrl,
		name: file.name,
		size: formatFileSize(file.size),
		width,
		height,
	};
}
