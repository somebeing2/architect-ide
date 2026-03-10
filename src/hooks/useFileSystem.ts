import { useState, useCallback } from 'react';

export interface WorkspaceState {
    directoryName: string | null;
    files: File[];
}

export function useFileSystem() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requestWorkspace = useCallback(async (): Promise<WorkspaceState | null> => {
        setLoading(true);
        setError(null);
        try {
            // Show directory picker
            const dirHandle = await window.showDirectoryPicker({
                mode: 'read',
            });

            const files: File[] = [];

            // Iterate over the directory
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    try {
                        const file = await entry.getFile();
                        files.push(file);
                    } catch (e) {
                        console.warn(`Could not read file ${entry.name}`, e);
                    }
                }
            }

            setLoading(false);
            return {
                directoryName: dirHandle.name,
                files
            };

        } catch (err: any) {
            setLoading(false);
            if (err.name !== 'AbortError') {
                setError(err.message || 'Failed to open directory');
                throw err;
            }
            return null;
        }
    }, []);

    return { requestWorkspace, loading, error };
}
