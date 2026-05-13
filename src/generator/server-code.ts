import { OpenAPIV3 } from 'openapi-types';
import { CliOptions, McpToolDefinition } from '../types/index.js';
import { extractToolsFromApi } from '../parser/extract-tools.js';
import { determineBaseUrl } from '../utils/index.js';
import {
  generateToolDefinitionMap,
  generateCallToolHandler,
  generateListToolsHandler,
} from '../utils/code-gen.js';
import { generateExecuteApiToolFunction } from '../utils/security.js';

/**
 * Generates the TypeScript code for the MCP server
 *
 * @param api OpenAPI document
 * @param options CLI options
 * @param serverName Server name
 * @param serverVersion Server version
 * @returns Generated TypeScript code
 */
export function generateMcpServerCode(
  api: OpenAPIV3.Document,
  options: CliOptions,
  serverName: string,
  serverVersion: string
): McpToolDefinition[] {
  // Extract tools from API
  const tools = extractToolsFromApi(api, options.defaultInclude ?? true);

  // Determine base URL
  const determinedBaseUrl = determineBaseUrl(api, options.baseUrl);

  // Generate code for tool definition map
  const toolDefinitionMapCode = generateToolDefinitionMap(tools, api.components?.securitySchemes);

  // Generate code for API tool execution
  const executeApiToolFunctionCode = generateExecuteApiToolFunction(
    api.components?.securitySchemes
  );

  // Generate code for request handlers
  const callToolHandlerCode = generateCallToolHandler();
  const listToolsHandlerCode = generateListToolsHandler();

  // Determine which transport to include
  let transportImport = '';
  let transportCode = '';

  switch (options.transport) {
    case 'web':
      transportImport = `\nimport { setupWebServer } from "./web-server.js";`;
      transportCode = `// Set up Web Server transport
  try {
    await setupWebServer(server, ${options.port || 3000});
  } catch (error) {
    console.error("Error setting up web server:", error);
    process.exit(1);
  }`;
      break;
    case 'streamable-http':
      transportImport = `\nimport { setupStreamableHttpServer } from "./streamable-http.js";`;
      transportCode = `// Set up StreamableHTTP transport
  try {
    await setupStreamableHttpServer(server, ${options.port || 3000});
  } catch (error) {
    console.error("Error setting up StreamableHTTP server:", error);
    process.exit(1);
  }`;
      break;
    default: // stdio
      transportImport = '';
      transportCode = `// Set up stdio transport
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(\`\${SERVER_NAME} MCP Server (v\${SERVER_VERSION}) running on stdio\${API_BASE_URL ? \`, proxying API at \${API_BASE_URL}\` : ''}\`);
  } catch (error) {
    console.error("Error during server startup:", error);
    process.exit(1);
  }`;
      break;
  }

  // Generate the full server code
  return tools;
}
