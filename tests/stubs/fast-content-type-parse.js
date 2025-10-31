// Stub for fast-content-type-parse in Cloudflare Workers test environment

export function safeParse(contentType) {
  if (!contentType || typeof contentType !== "string") {
    return {
      type: undefined,
      parameters: {},
    };
  }

  const parts = contentType.split(";");
  const type = parts[0]?.trim();
  const parameters = {};

  for (let i = 1; i < parts.length; i++) {
    const param = parts[i].trim();
    const [key, value] = param.split("=");
    if (key && value) {
      parameters[key.trim()] = value.trim().replace(/^"|"$/g, "");
    }
  }

  return {
    type,
    parameters,
  };
}

export function parse(contentType) {
  const result = safeParse(contentType);
  if (!result.type) {
    throw new Error("Invalid content type");
  }
  return result;
}

export default {
  safeParse,
  parse,
};
