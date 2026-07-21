/**
 * @typedef {object} ConnectorResult
 * @property {string[]} lines Human-readable feed lines for the console output.
 * @property {object} data Structured result payload (cached in query_logs).
 */

/**
 * @typedef {object} Connector
 * @property {string} id Stable identifier (e.g. "mspect").
 * @property {string} label Display label (e.g. "µspect").
 * @property {string} title Panel title.
 * @property {string} inputLabel Label for the query input field.
 * @property {string} placeholder Placeholder for the query input field.
 * @property {(query: string) => Promise<ConnectorResult>} run Execute the connector.
 */

export {};
