/** Does a configuration (have) satisfy a table's / row's option conditions (want)? Shared by server and client code. */
export const fitsOptions = (want: Record<string, string>, have: Record<string, string>) => Object.entries(want).every(([k, v]) => have[k] === v);
