import { mspectConnector } from './mspect.connector.js';
import { wiretapConnector } from './wiretap.connector.js';
import { grimnirConnector } from './grimnir.connector.js';
import { v0idConnector } from './v0id.connector.js';
import { shodanConnector } from './shodan.connector.js';

/**
 * Registry of all available recon connectors, keyed by id.
 * @type {Record<string, import('./types.js').Connector>}
 */
export const connectors = {
  [mspectConnector.id]: mspectConnector,
  [wiretapConnector.id]: wiretapConnector,
  [grimnirConnector.id]: grimnirConnector,
  [v0idConnector.id]: v0idConnector,
  [shodanConnector.id]: shodanConnector,
};

/**
 * Resolve a connector by id.
 * @param {string} id
 * @returns {import('./types.js').Connector | undefined}
 */
export function getConnector(id) {
  return connectors[id];
}

/**
 * Public metadata for every connector (safe to expose to the client).
 * @returns {Array<{ id: string, label: string, title: string, inputLabel: string, placeholder: string }>}
 */
export function listConnectorMeta() {
  return Object.values(connectors).map(({ id, label, title, inputLabel, placeholder }) => ({
    id,
    label,
    title,
    inputLabel,
    placeholder,
  }));
}
