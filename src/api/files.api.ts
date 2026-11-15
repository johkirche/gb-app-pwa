import { useUserStore } from '@/stores/user';

import { demoUrl, getDemoKey } from '@/services/demoAccess';
import { directusConfig } from '@/services/directus';
import { sessionFetch } from '@/services/session';

/**
 * Files API
 *
 * Fetches files from Directus' assets endpoint, and answers the questions the
 * sync asks of its file library. Signing, renewing and telling a lost session
 * from a failed request are sessionFetch's (services/session.ts): a session that
 * ends under a request rejects with SESSION_ENDED_ERROR.
 */

/**
 * Fetch a file (PNG/JPG/SVG) from Directus. Throws SESSION_ENDED_ERROR when the
 * session did not survive the request.
 */
export async function fetchFile(
    fileId: string,
    options: { cache?: RequestCache } = {},
): Promise<Blob> {
    try {
        // A demo visitor has no session to ask Directus with; the demo endpoint
        // answers for the files of its own songs instead.
        const demoKey = getDemoKey();
        if (!useUserStore().authData && demoKey) {
            const response = await fetch(demoUrl(demoKey, `/assets/${fileId}`), options);
            if (!response.ok) {
                throw new Error(`Failed to fetch demo file: ${response.status}`);
            }
            return await response.blob();
        }

        const response = await sessionFetch(`${directusConfig.url}/assets/${fileId}`, options);
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        return await response.blob();
    } catch (error) {
        console.error('Error fetching file from Directus:', error);
        throw error;
    }
}

/** A file in Directus' file library, as far as the sync needs to know it. */
export interface DirectusFileInfo {
    id: string;
    /** When its content last changed: the stamp a re-download is decided by. */
    modifiedOn: string | null;
}

/**
 * The newest file in the library with this download name, or null when there
 * is none. Throws when the question cannot be answered (offline, no access):
 * the caller must tell "not there" from "could not ask", or a dropped
 * connection would read as the file having been taken down. A session that did
 * not survive the question throws SESSION_ENDED_ERROR, as in fetchFile.
 */
export async function findFileByName(filename: string): Promise<DirectusFileInfo | null> {
    const files = await queryDirectus<{
        id: string;
        modified_on?: string | null;
        uploaded_on?: string | null;
    }>(
        '/files',
        {
            'filter[filename_download][_eq]': filename,
            fields: 'id,modified_on,uploaded_on',
            sort: '-uploaded_on',
            limit: '1',
        },
        `look up ${filename}`,
    );
    const file = files[0];
    if (!file) return null;
    return { id: file.id, modifiedOn: file.modified_on ?? file.uploaded_on ?? null };
}

/**
 * Every file in one folder of the library, with the fields asked for. Throws
 * when the folder cannot be read, as findFileByName does: an empty list is an
 * answer, a failed request is not.
 */
export async function listFolderFiles<T>(folderId: string, fields: string[]): Promise<T[]> {
    return queryDirectus<T>(
        '/files',
        {
            'filter[folder][_eq]': folderId,
            fields: fields.join(','),
            // A folder of symbols, not a library: one page is all of it.
            limit: '200',
        },
        `list folder ${folderId}`,
    );
}

/** GET a list from Directus with the session. */
export async function queryDirectus<T>(
    path: string,
    query: Record<string, string>,
    what: string,
): Promise<T[]> {
    const response = await sessionFetch(
        `${directusConfig.url}${path}?${new URLSearchParams(query)}`,
    );
    if (!response.ok) {
        throw new Error(`Failed to ${what}: ${response.status}`);
    }

    const body = (await response.json()) as { data?: T[] };
    return body.data ?? [];
}
