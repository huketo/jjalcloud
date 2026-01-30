
/** @jsxImportSource hono/jsx/dom */
import { useState, useRef } from 'hono/jsx'

interface UploadFormProps {
    initialError?: string;
    initialSuccess?: string;
}

export const UploadForm = ({ initialError, initialSuccess }: UploadFormProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState<{ url: string; name: string; size: string } | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(
        initialError ? { type: 'error', message: initialError } :
            initialSuccess ? { type: 'success', message: initialSuccess } : null
    );

    const fileInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleFile = (file: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result && typeof e.target.result === 'string') {
                setPreview({
                    url: e.target.result,
                    name: file.name,
                    size: formatFileSize(file.size)
                });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const dt = (e as any).dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
            const file = dt.files[0];
            if (fileInputRef.current) {
                // Manually setting files is tricky in some browsers but works in modern ones
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInputRef.current.files = dataTransfer.files;
            }
            handleFile(file);
        }
    };

    const handleDragOver = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            handleFile(target.files[0]);
        }
    };

    const handleRemoveFile = () => {
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        if (!formRef.current) return;

        setIsUploading(true);
        setStatus({ type: 'success', message: 'Uploading to the cloud...' }); // Loading state really

        const formData = new FormData(formRef.current);

        try {
            const res = await fetch('/api/gif', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.error) {
                setStatus({ type: 'error', message: data.message || data.error });
                setIsUploading(false);
            } else {
                setStatus({ type: 'success', message: '✅ ' + data.message });
                // Reset form
                if (formRef.current) formRef.current.reset();
                setPreview(null);

                // Redirect
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Upload failed. Please try again.' });
            setIsUploading(false);
        }
    };

    return (
        <div class="w-full">
            {/* Messages */}
            {status && (
                <div class={`mb-6 p-4 rounded-md text-sm border ${
                    status.type === 'error' 
                        ? 'bg-status-error/10 border-status-error text-status-error' 
                        : 'bg-status-success/10 border-status-success text-status-success'
                }`}>
                    {status.type === 'success' && status.message === 'Uploading to the cloud...' ? (
                        <p style={{ color: 'var(--color-text-muted)' }}>{status.message}</p>
                    ) : (
                        status.message
                    )}
                </div>
            )}

            <form
                ref={formRef}
                action="/api/gif"
                method="post"
                enctype="multipart/form-data"
                onSubmit={handleSubmit}
            >
                {/* Upload Zone */}
                {!preview && (
                    <div class="mb-6">
                        <label 
                            class={`flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-bg-surface cursor-pointer transition-all duration-200 hover:border-brand-primary hover:bg-brand-primary-pale group ${isDragOver ? 'dragover border-brand-primary bg-brand-primary-pale' : ''}`}
                            for="gif-upload-input"
                            id="gif-upload"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onDragEnter={handleDragOver}
                        >
                            <div class="w-16 h-16 text-brand-primary-light mb-4">
                                <svg class="upload-zone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                                    <path d="M12 12v9" />
                                    <path d="m16 16-4-4-4 4" />
                                </svg>
                            </div>
                            <div class="text-lg font-medium text-text mb-1">Tap or Drag GIFs Here</div>
                            <div class="text-sm text-text-muted mb-4">
                                Supports .gif, .mp4, .webp up to 15MB
                            </div>
                            <span class="inline-flex items-center justify-center gap-2 px-3 py-1 text-sm font-medium rounded-md bg-bg-surface text-text border border-border transition-all hover:bg-bg-surface-hover hover:border-brand-primary-light">Browse Files</span>
                        </label>
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    id="gif-upload-input"
                    name="file"
                    accept="image/gif,video/mp4,image/webp"
                    class="hidden"
                    required
                    onChange={handleChange}
                />

                {/* Preview */}
                {preview && (
                    <div class="mb-6">
                        <div class="bg-bg-surface rounded-xl shadow-card overflow-hidden p-4 flex items-center gap-4">
                            <img
                                src={preview.url}
                                alt="Preview"
                                class="w-20 h-20 object-cover rounded-md"
                            />
                            <div class="flex-1">
                                <div class="font-medium mb-1">{preview.name}</div>
                                <div class="text-sm text-text-muted">{preview.size}</div>
                            </div>
                            <button
                                type="button"
                                onClick={handleRemoveFile}
                                class="p-2 rounded-full hover:bg-bg-primary-pale hover:text-brand-primary text-text-secondary bg-transparent transition-colors cursor-pointer border-none"
                                aria-label="Remove file"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ width: "20px", height: "20px" }}>
                                    <path d="M18 6 6 18" />
                                    <path d="m6 6 12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* GIF Title */}
                <div class="mb-6">
                    <label class="block text-sm font-medium text-brand-primary mb-2" for="title">
                        GIF Title
                    </label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        class="w-full box-border px-4 py-3 text-base text-text bg-bg-surface border-1 border-solid border-border-light rounded-xl transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80"
                        placeholder="Give it a catchy name..."
                        maxLength={100}
                    />
                </div>

                {/* Tags */}
                <div class="mb-6">
                    <label class="block text-sm font-medium text-brand-primary mb-2" for="tags">
                        Tags
                    </label>
                    <div class="relative">
                        <input
                            type="text"
                            id="tags"
                            name="tags"
                            class="w-full box-border px-4 py-3 pl-8 text-base text-text bg-bg-surface border-1 border-solid border-border-light rounded-xl transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80"
                            placeholder="# funny, cat, reaction..."
                        />
                    </div>
                    <p class="text-xs text-text-muted mt-1">
                        Separate tags with commas (max 10 tags)
                    </p>
                </div>

                {/* Description */}
                <div class="mb-6">
                    <label class="block text-sm font-medium text-brand-primary mb-2" for="alt">
                        Description (Optional)
                    </label>
                    <textarea
                        id="alt"
                        name="alt"
                        class="w-full box-border px-4 py-3 text-base text-text bg-bg-surface border-1 border-solid border-border-light rounded-md transition-all outline-none focus:border-brand-primary placeholder:text-text-muted/80 min-h-[100px] resize-y"
                        placeholder="Add some context..."
                        maxLength={300}
                    ></textarea>
                    <p class="text-xs text-text-muted mt-1">
                        Also used as alt text for accessibility
                    </p>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isUploading}
                    class="w-full box-border flex items-center justify-center gap-2 py-3 text-lg font-bold rounded-xl bg-gradient-to-br from-brand-primary to-brand-primary-dark text-text-inverse border-none shadow-md hover:shadow-lg hover:opacity-95 transform active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isUploading ? (
                        <>
                            <span class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                            Uploading...
                        </>
                    ) : (
                        <>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ width: "18px", height: "18px" }}>
                                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                                <path d="M12 12v9" />
                                <path d="m16 16-4-4-4 4" />
                            </svg>
                            Upload GIF
                        </>
                    )}
                </button>

                {/* Terms */}
                <p class="text-center mt-4 text-xs text-text-muted">
                    By uploading, you agree to our{" "}
                    <a href="/terms" class="text-brand-primary hover:underline">
                        Terms of Service
                    </a>
                    .
                </p>
            </form>
        </div>
    );
};
