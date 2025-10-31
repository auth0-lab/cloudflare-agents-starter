// Stub for node:path module in Cloudflare Workers test environment

export const sep = "/";
export const delimiter = ":";

export function basename(path, ext) {
  if (path === undefined) return "";
  if (typeof path !== "string") return "";

  const lastSlash = path.lastIndexOf("/");
  const base = lastSlash === -1 ? path : path.slice(lastSlash + 1);

  if (ext && base.endsWith(ext)) {
    return base.slice(0, -ext.length);
  }
  return base;
}

export function dirname(path) {
  if (path === undefined) return ".";
  if (typeof path !== "string") return ".";

  const lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) return ".";
  if (lastSlash === 0) return "/";
  return path.slice(0, lastSlash);
}

export function extname(path) {
  if (path === undefined) return "";
  if (typeof path !== "string") return "";

  const lastDot = path.lastIndexOf(".");
  const lastSlash = path.lastIndexOf("/");

  if (lastDot === -1 || lastDot < lastSlash) return "";
  return path.slice(lastDot);
}

export function join(...args) {
  return args
    .filter((arg) => arg && typeof arg === "string")
    .join("/")
    .replace(/\/+/g, "/");
}

export function resolve(...args) {
  let resolvedPath = "";

  for (let i = args.length - 1; i >= 0; i--) {
    const path = args[i];
    if (path && typeof path === "string") {
      resolvedPath = path + "/" + resolvedPath;
      if (path[0] === "/") break;
    }
  }

  return resolvedPath || "/";
}

export function normalize(path) {
  if (path === undefined) return ".";
  if (typeof path !== "string") return ".";

  return path.replace(/\/+/g, "/");
}

export function isAbsolute(path) {
  if (path === undefined) return false;
  if (typeof path !== "string") return false;

  return path[0] === "/";
}

export function relative(from, to) {
  return to;
}

export function parse(path) {
  if (path === undefined) {
    return { root: "", dir: "", base: "", ext: "", name: "" };
  }
  if (typeof path !== "string") {
    return { root: "", dir: "", base: "", ext: "", name: "" };
  }

  const ext = extname(path);
  const base = basename(path);
  const name = base.slice(0, base.length - ext.length);
  const dir = dirname(path);

  return {
    root: path[0] === "/" ? "/" : "",
    dir,
    base,
    ext,
    name,
  };
}

export function format(pathObject) {
  return pathObject.dir + "/" + pathObject.base;
}

export default {
  sep,
  delimiter,
  basename,
  dirname,
  extname,
  join,
  resolve,
  normalize,
  isAbsolute,
  relative,
  parse,
  format,
};
