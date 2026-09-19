/**
 * Normalizes a RomM server URL:
 * - Adds http:// or https:// if missing
 * - Uses http:// for local/private addresses (192.168.x.x, 10.x.x.x, localhost, etc.)
 * - Uses https:// for everything else
 * - Strips trailing slashes
 * @overload
 * @param {string} input Server address entered by the user.
 * @returns {string} Trimmed address with an HTTP scheme.
 */
/**
 * @overload
 * @param {null} [input] Absent server address.
 * @returns {null|undefined} The absent value unchanged.
 */
/**
 * @param {string|null} [input] Server address, if supplied.
 */
const normalizeUrl = (input) => {
  if (input === null || input === undefined || input === "") {
    return input;
  }

  let url = input.trim();
  if (!url) {
    return url;
  }

  url = url.replace(/\/+$/u, "");

  if (/^https?:\/\//u.test(url.toLowerCase())) {
    return url;
  }

  const [host] = url.split(/[:/]/u);
  const hostname = host.toLowerCase();

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".lan");

  const scheme = isLocal ? "http://" : "https://";
  return scheme + url;
};

export default normalizeUrl;
