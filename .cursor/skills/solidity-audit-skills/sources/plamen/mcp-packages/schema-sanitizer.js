#!/usr/bin/env node
/**
 * MCP compatibility proxy.
 *
 * Responsibilities:
 * - sanitize tool schemas (oneOf/allOf/anyOf/$defs/$ref)
 * - bridge framed MCP stdio <-> newline-delimited JSON stdio
 * - force JS entrypoints to execute via Node on Windows
 *
 * Codex speaks framed MCP stdio. Some Python MCP servers in this stack still
 * read/write newline-delimited JSON on stdio, so they need a transport shim.
 */

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node schema-sanitizer.js <command> [args...]');
  process.exit(1);
}

let command = args[0];
let commandArgs = args.slice(1);

// On Windows, launching a .js file directly can invoke the shell file association
// instead of Node. If the target is a JS entrypoint, force execution via Node.
if (/\.(c?m?js)$/i.test(command)) {
  commandArgs = [command, ...commandArgs];
  command = process.execPath;
}

// Spawn the actual MCP server
const child = spawn(command, commandArgs, {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env,
  shell: false
});

let parentBuf = Buffer.alloc(0);
let childBuf = Buffer.alloc(0);

function sanitizeMessage(msg) {
  if (msg.result && msg.result.tools && Array.isArray(msg.result.tools)) {
    msg.result.tools = msg.result.tools.map(tool => {
      if (tool.inputSchema) {
        tool.inputSchema = sanitizeSchema(tool.inputSchema);
      }
      if (tool.outputSchema) {
        tool.outputSchema = sanitizeSchema(tool.outputSchema);
      }
      return tool;
    });
  }
  return msg;
}

function writeFramedToParent(msg) {
  const body = JSON.stringify(sanitizeMessage(msg));
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function writeJsonLineToChild(msg) {
  child.stdin.write(JSON.stringify(msg) + '\n');
}

function processParentInput(chunk) {
  parentBuf = Buffer.concat([parentBuf, chunk]);

  while (true) {
    const headerEnd = parentBuf.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return;
    }

    const header = parentBuf.subarray(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      parentBuf = parentBuf.subarray(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (parentBuf.length < bodyStart + contentLength) {
      return;
    }

    const body = parentBuf.subarray(bodyStart, bodyStart + contentLength).toString('utf8');
    parentBuf = parentBuf.subarray(bodyStart + contentLength);

    try {
      writeJsonLineToChild(JSON.parse(body));
    } catch {
      // Drop malformed parent messages instead of poisoning the child stream.
    }
  }
}

function processChildOutput(chunk) {
  childBuf = Buffer.concat([childBuf, chunk]);

  while (true) {
    if (childBuf.length === 0) {
      return;
    }

    if (childBuf.indexOf(Buffer.from('Content-Length:')) === 0) {
      const headerEnd = childBuf.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }

      const header = childBuf.subarray(0, headerEnd).toString('utf8');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        childBuf = childBuf.subarray(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (childBuf.length < bodyStart + contentLength) {
        return;
      }

      const body = childBuf.subarray(bodyStart, bodyStart + contentLength).toString('utf8');
      childBuf = childBuf.subarray(bodyStart + contentLength);

      try {
        writeFramedToParent(JSON.parse(body));
      } catch {
        process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
      }
      continue;
    }

    const newline = childBuf.indexOf('\n');
    if (newline === -1) {
      return;
    }

    const line = childBuf.subarray(0, newline).toString('utf8').trim();
    childBuf = childBuf.subarray(newline + 1);
    if (!line) {
      continue;
    }

    try {
      writeFramedToParent(JSON.parse(line));
    } catch {
      // Child logs should go to stderr; ignore stray stdout text.
    }
  }
}

/**
 * Recursively strip oneOf/allOf/anyOf from a JSON Schema object.
 * Strategy:
 * - Top-level oneOf/anyOf: pick the first non-null variant
 * - Top-level allOf: merge all sub-schemas
 * - Property-level: same treatment recursively
 */
function sanitizeSchema(schema, defs) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(s => sanitizeSchema(s, defs));

  // Resolve $ref references using $defs
  if (schema['$ref'] && defs) {
    const refPath = schema['$ref'].replace('#/$defs/', '');
    const resolved = defs[refPath];
    if (resolved) {
      return sanitizeSchema({ ...resolved }, defs);
    }
  }

  // Capture $defs from root schema for ref resolution
  const localDefs = schema['$defs'] || defs;

  const result = { ...schema };

  // Remove $defs from output (already inlined via $ref resolution)
  delete result['$defs'];

  // Handle top-level anyOf (from z.optional / z.union)
  if (result.anyOf) {
    const variants = result.anyOf.filter(v => v.type !== 'null' && v.type !== undefined || v.properties);
    if (variants.length === 1) {
      // Single non-null variant — unwrap it
      const unwrapped = sanitizeSchema(variants[0], localDefs);
      delete result.anyOf;
      Object.assign(result, unwrapped);
    } else if (variants.length > 1) {
      // Multiple variants — pick the object one if exists, otherwise first
      const objVariant = variants.find(v => v.type === 'object' || v.properties);
      const picked = sanitizeSchema(objVariant || variants[0], localDefs);
      delete result.anyOf;
      Object.assign(result, picked);
    } else {
      // All null variants — just make it any type
      delete result.anyOf;
    }
  }

  // Handle top-level oneOf (from z.discriminatedUnion)
  if (result.oneOf) {
    // Pick the first variant that looks like an object schema
    const objVariant = result.oneOf.find(v => v.type === 'object' || v.properties);
    if (objVariant) {
      const picked = sanitizeSchema(objVariant, localDefs);
      delete result.oneOf;
      Object.assign(result, picked);
    } else {
      const picked = sanitizeSchema(result.oneOf[0], localDefs);
      delete result.oneOf;
      Object.assign(result, picked);
    }
  }

  // Handle top-level allOf (from z.intersection)
  if (result.allOf) {
    delete result.allOf;
    for (const sub of schema.allOf) {
      const sanitized = sanitizeSchema(sub, localDefs);
      // Merge properties
      if (sanitized.properties) {
        result.properties = { ...(result.properties || {}), ...sanitized.properties };
      }
      if (sanitized.required) {
        result.required = [...new Set([...(result.required || []), ...sanitized.required])];
      }
      if (sanitized.type && !result.type) {
        result.type = sanitized.type;
      }
    }
  }

  // Recurse into properties
  if (result.properties) {
    for (const [key, value] of Object.entries(result.properties)) {
      result.properties[key] = sanitizeSchema(value, localDefs);
    }
  }

  // Recurse into items (arrays)
  if (result.items) {
    result.items = sanitizeSchema(result.items, localDefs);
  }

  // Recurse into additionalProperties
  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = sanitizeSchema(result.additionalProperties, localDefs);
  }

  return result;
}

process.stdin.on('data', processParentInput);
child.stdout.on('data', processChildOutput);

child.on('close', (code) => process.exit(code || 0));
child.on('error', (err) => {
  console.error('Failed to start MCP server:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => child.kill());
process.on('SIGINT', () => child.kill());
