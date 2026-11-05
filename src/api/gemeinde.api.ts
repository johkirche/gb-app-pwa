import { queryDirectus } from '@/api/files.api';
import type { GemeindeRow } from '@/utils/gemeinden';

/**
 * The Gemeinden a reader can say they belong to: the `gemeinde` collection in
 * Directus, in the order the organisation gave them.
 *
 * Nothing here asks for `status`, not even as a filter: readers hold no read on
 * that field, and Directus refuses a whole request that names one. Their policy
 * shows them published rows and no others, so the filter is already there. An
 * admin sees the drafts as well.
 *
 * Throws when the list cannot be read: an empty list is an answer, a failed
 * request is not.
 */
export function fetchGemeinden(): Promise<GemeindeRow[]> {
    return queryDirectus<GemeindeRow>(
        '/items/gemeinde',
        { fields: 'id,name,city,coordinates', sort: 'sort,name', limit: '200' },
        'list the Gemeinden',
    );
}
